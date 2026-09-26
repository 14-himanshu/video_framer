import os
import sys
import time
import uuid
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List
from threading import Thread

from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import video_engine

app = FastAPI(title="VideoFarm AI Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("./output")
OUTPUT_DIR.mkdir(exist_ok=True)
STATIC_DIR = Path("./static")
STATIC_DIR.mkdir(exist_ok=True)

# Mount static and output paths
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR.resolve())), name="output")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR.resolve())), name="static")

# In-memory jobs database
JOBS: Dict[str, Dict[str, Any]] = {}

# Load any existing completed jobs from output directories on startup
def load_historical_jobs():
    for job_folder in OUTPUT_DIR.iterdir():
        if job_folder.is_dir():
            script_file = job_folder / "script.json"
            video_file = job_folder / "final_video.mp4"
            if video_file.exists():
                job_id = job_folder.name
                meta = {
                    "job_id": job_id,
                    "topic": job_id,
                    "title": job_id,
                    "format": "long",
                    "status": "completed",
                    "progress": 100,
                    "step": "Completed",
                    "video_url": f"/output/{job_id}/final_video.mp4",
                    "file_size_mb": round(video_file.stat().st_size / (1024 * 1024), 2),
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(video_file.stat().st_mtime)),
                    "logs": ["Restored from output archive"]
                }
                if script_file.exists():
                    try:
                        sdata = json.loads(script_file.read_text(encoding="utf-8"))
                        meta["title"] = sdata.get("title", job_id)
                        meta["description"] = sdata.get("description", "")
                        meta["tags"] = sdata.get("tags", [])
                        meta["scenes_count"] = len(sdata.get("scenes", []))
                    except Exception:
                        pass
                JOBS[job_id] = meta

load_historical_jobs()


class ScriptRequest(BaseModel):
    topic: str
    format: str = "long"  # "long" or "short"
    num_scenes: int = 3


class VideoRenderRequest(BaseModel):
    topic: str
    format: str = "long"  # "long" or "short"
    num_scenes: int = 3
    voice: str = "en-US-ChristopherNeural"
    visual_source: str = "ai"  # "ai", "wikimedia", "unsplash"
    script: Optional[Dict[str, Any]] = None


class KeyUpdateRequest(BaseModel):
    groq_api_key: str


def run_pipeline_worker(job_id: str, request_data: VideoRenderRequest):
    def update_log(msg: str, percent: int, step: str):
        if job_id in JOBS:
            JOBS[job_id]["progress"] = percent
            JOBS[job_id]["step"] = step
            timestamp = time.strftime("%H:%M:%S")
            JOBS[job_id]["logs"].append(f"[{timestamp}] {msg}")

    try:
        JOBS[job_id]["status"] = "processing"
        result = video_engine.execute_video_pipeline(
            job_id=job_id,
            topic=request_data.topic,
            format_type=request_data.format,
            num_scenes=request_data.num_scenes,
            voice=request_data.voice,
            visual_source=request_data.visual_source,
            custom_script=request_data.script,
            log_fn=update_log
        )
        JOBS[job_id].update(result)
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["progress"] = 100
        JOBS[job_id]["step"] = "Completed"
    except Exception as e:
        timestamp = time.strftime("%H:%M:%S")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["step"] = "Error"
        JOBS[job_id]["error"] = str(e)
        JOBS[job_id]["logs"].append(f"[{timestamp}] [ERROR]: {str(e)}")
        print(f"[Worker Error in {job_id}]: {e}")


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>VideoFarm Studio loading...</h1>")


@app.get("/api/voices")
async def get_voices():
    return {"voices": video_engine.AVAILABLE_VOICES}


@app.get("/api/voice-preview/{voice_id}")
async def get_voice_preview(voice_id: str):
    try:
        path = video_engine.get_voice_preview_path(voice_id)
        if path.exists():
            return FileResponse(path, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="Preview not found")


class ImageGenRequest(BaseModel):
    query: str
    prompt: Optional[str] = None
    is_vertical: bool = False
    source: str = "auto"
    scene_index: int = 0
    topic: Optional[str] = None


@app.post("/api/generate-scene-visual")
async def generate_single_visual(req: ImageGenRequest):
    temp_dir = OUTPUT_DIR / "temp_visuals"
    temp_dir.mkdir(parents=True, exist_ok=True)
    filename = f"vis_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
    out_path = temp_dir / filename
    video_engine.fetch_scene_visual(
        query=req.query,
        prompt=req.prompt or req.query,
        output_path=out_path,
        is_vertical=req.is_vertical,
        source=req.source,
        scene_index=req.scene_index,
        topic=req.topic or req.query
    )
    if out_path.exists():
        return {"success": True, "image_url": f"/output/temp_visuals/{filename}"}
    raise HTTPException(status_code=500, detail="Failed to fetch image")


@app.get("/api/status")
async def get_system_status():
    has_groq = bool(os.environ.get("GROQ_API_KEY"))
    groq_masked = ""
    if has_groq:
        k = os.environ.get("GROQ_API_KEY", "")
        groq_masked = f"{k[:7]}...{k[-4:]}" if len(k) > 11 else "Configured"

    return {
        "status": "online",
        "has_groq_key": has_groq,
        "groq_masked": groq_masked,
        "default_voice": "en-US-ChristopherNeural",
        "total_jobs": len(JOBS)
    }


@app.post("/api/generate-script")
async def api_generate_script(req: ScriptRequest):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    try:
        script = video_engine.generate_script_ai(
            topic=req.topic.strip(),
            format_type=req.format,
            num_scenes=req.num_scenes
        )
        return {"success": True, "script": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/render-video")
async def api_render_video(req: VideoRenderRequest, background_tasks: BackgroundTasks):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    job_id = f"vid_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    JOBS[job_id] = {
        "job_id": job_id,
        "topic": req.topic,
        "format": req.format,
        "voice": req.voice,
        "visual_source": req.visual_source,
        "status": "queued",
        "progress": 0,
        "step": "Queued",
        "logs": [f"[{time.strftime('%H:%M:%S')}] Job registered in queue"],
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    # Start background execution thread
    thread = Thread(target=run_pipeline_worker, args=(job_id, req), daemon=True)
    thread.start()

    return {"success": True, "job_id": job_id, "status": "queued"}


@app.get("/api/job/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]


@app.get("/api/jobs")
async def get_all_jobs():
    sorted_jobs = sorted(
        JOBS.values(),
        key=lambda j: j.get("created_at", ""),
        reverse=True
    )
    return {"jobs": sorted_jobs}


@app.get("/api/stream/{job_id}")
async def stream_job_progress(job_id: str):
    """Server-Sent Events (SSE) for realtime frontend telemetry."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        last_log_idx = 0
        while True:
            job = JOBS.get(job_id)
            if not job:
                break

            current_logs = job.get("logs", [])
            new_logs = current_logs[last_log_idx:]
            last_log_idx = len(current_logs)

            payload = {
                "job_id": job_id,
                "status": job.get("status"),
                "progress": job.get("progress", 0),
                "step": job.get("step", ""),
                "new_logs": new_logs,
                "video_url": job.get("video_url"),
                "error": job.get("error")
            }
            yield f"data: {json.dumps(payload)}\n\n"

            if job.get("status") in ("completed", "failed"):
                break

            await asyncio.sleep(1.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/update-groq-key")
async def update_groq_key(req: KeyUpdateRequest):
    key = req.groq_api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Key cannot be empty")
    os.environ["GROQ_API_KEY"] = key
    env_file = Path(".env")
    env_file.write_text(f"GROQ_API_KEY={key}\n", encoding="utf-8")
    return {"success": True, "message": "Groq API Key saved successfully"}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("🎬 VideoFarm AI Studio Starting on http://127.0.0.1:8000")
    print("=" * 60 + "\n")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
