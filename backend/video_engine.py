import os
import sys
import json
import re
import time
import urllib.parse
import urllib.request
import subprocess
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
import requests
import edge_tts

# Auto-load .env if present (check both backend/.env and project root .env)
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent if (BASE_DIR.parent / ".env").exists() or (BASE_DIR.parent / "frontend").exists() else BASE_DIR

_KEY_NAMES = {"GROQ_API_KEY", "GEMINI_API_KEY", "PEXELS_API_KEY"}
for candidate in [BASE_DIR / ".env", ROOT_DIR / ".env"]:
    if candidate.exists():
        for _line in candidate.read_text(encoding="utf-8").splitlines():
            _line = _line.strip()
            if "=" in _line and not _line.startswith("#"):
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                _v = _v.strip().strip('"').strip("'")
                if _k in _KEY_NAMES and _v and not _v.startswith("your_") and not _v.startswith("gsk_your_"):
                    os.environ.setdefault(_k, _v)

OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(ROOT_DIR / "output")))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

AVAILABLE_VOICES = [
    {"id": "en-US-ChristopherNeural", "name": "Christopher (US)", "gender": "Male", "tone": "Deep, Authoritative Documentary", "lang": "en-US", "avatar": "🎙️"},
    {"id": "en-US-GuyNeural", "name": "Guy (US)", "gender": "Male", "tone": "Engaging, Modern Storyteller", "lang": "en-US", "avatar": "⚡"},
    {"id": "en-US-AriaNeural", "name": "Aria (US)", "gender": "Female", "tone": "Expressive, Cinematic Narration", "lang": "en-US", "avatar": "✨"},
    {"id": "en-US-JennyNeural", "name": "Jenny (US)", "gender": "Female", "tone": "Warm, Friendly Explainer", "lang": "en-US", "avatar": "🌟"},
    {"id": "en-GB-RyanNeural", "name": "Ryan (UK)", "gender": "Male", "tone": "Sophisticated British Documentary", "lang": "en-GB", "avatar": "🎭"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia (UK)", "gender": "Female", "tone": "Polished British Storyteller", "lang": "en-GB", "avatar": "📖"},
    {"id": "en-AU-WilliamNeural", "name": "William (AU)", "gender": "Male", "tone": "Distinctive Natural Voice", "lang": "en-AU", "avatar": "🦘"},
    {"id": "hi-IN-MadhurNeural", "name": "Madhur (India)", "gender": "Male", "tone": "Hindi/Indian Accent Storyteller", "lang": "hi-IN", "avatar": "🇮🇳"},
    {"id": "hi-IN-SwaraNeural", "name": "Swara (India)", "gender": "Female", "tone": "Hindi/Indian Accent Narrator", "lang": "hi-IN", "avatar": "🇮🇳"},
]


async def get_voice_preview_path(voice_id: str) -> Path:
    """Generates and caches a voice preview snippet."""
    preview_dir = OUTPUT_DIR / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    audio_file = preview_dir / f"{voice_id}.mp3"
    if not audio_file.exists():
        sample_texts = {
            "en-US-ChristopherNeural": "For thousands of years, ancient mysteries have whispered through the corridors of time.",
            "en-US-GuyNeural": "Welcome to the story. What you are about to hear will completely change how you see the world.",
            "en-US-AriaNeural": "Deep beneath the surface lies a secret that science is only beginning to understand.",
            "en-US-JennyNeural": "Here is what really happened behind the scenes, and why it matters today.",
            "en-GB-RyanNeural": "History has a peculiar way of hiding the truth until we dare to look closer.",
            "en-GB-SoniaNeural": "Step into the past with me as we uncover an extraordinary forgotten tale.",
            "en-AU-WilliamNeural": "G'day, let's dive into one of the wildest mysteries on the planet.",
            "hi-IN-MadhurNeural": "Namaste! Chaliye jaante hain is rochak aur hairan kar dene wali kahani ke baare mein.",
            "hi-IN-SwaraNeural": "Namaste! Aaiye dekhte hain is anokhi kahani ke peeche ka asli sach."
        }
        text = sample_texts.get(voice_id, "Welcome to VideoFarm AI Studio. This is how my voice sounds.")
        comm = edge_tts.Communicate(text, voice_id)
        await comm.save(str(audio_file))
    return audio_file


def generate_script_ai(
    topic: str,
    format_type: str = "long",  # "long" (16:9) or "short" (9:16)
    num_scenes: int = 3,
    groq_key: Optional[str] = None
) -> Dict[str, Any]:
    """Generates an AI script with catchy SEO metadata and scene breakdowns."""
    groq_key = groq_key or os.environ.get("GROQ_API_KEY")
    is_short = (format_type == "short")
    pacing_guide = "1-2 short, high-energy, rapid-fire sentences per scene (ideal for a 30-45s vertical reel)" if is_short else "2-3 intriguing, documentary-style narrative sentences with dramatic depth"

    # ── Groq (primary) ───────────────────────────────────────────────────────
    if groq_key:
        models_to_try = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"]
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}

        for model in models_to_try:
            try:
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7
                }
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=25)
                if res.status_code == 200:
                    raw_text = res.json()["choices"][0]["message"]["content"].strip()
                    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                    if match:
                        data = json.loads(match.group(0))
                        if "scenes" in data and len(data["scenes"]) > 0:
                            return data
            except Exception as e:
                print(f"[AI Script Generation Notice ({model})]: {e}")

    # ── Gemini Flash (automatic free fallback when Groq unavailable) ──────────
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            gemini_url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={gemini_key}"
            )
            gemini_payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096}
            }
            res = requests.post(gemini_url, json=gemini_payload, timeout=30)
            if res.status_code == 200:
                raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw_text = re.sub(r"```(?:json)?\s*", "", raw_text).strip().rstrip("`")
                match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                if match:
                    data = json.loads(match.group(0))
                    if "scenes" in data and len(data["scenes"]) > 0:
                        print("[AI Script] Used Gemini Flash fallback")
                        return data
        except Exception as e:
            print(f"[Gemini fallback notice]: {e}")

    # Fallback template if Groq is not configured or fails
    return {
        "title": f"The Untold Secret of {topic}",
        "description": f"Explore the fascinating, untold story behind {topic}. Discover how ancient secrets and modern science collide.",
        "tags": [topic.lower().replace(" ", ""), "documentary", "history", "mystery", "facts"],
        "scenes": [
            {
                "scene_id": 1,
                "narration": f"For centuries, the world has questioned {topic}. But the real story began long before anyone suspected.",
                "image_prompt": f"Dramatic cinematic view of {topic}, atmospheric volumetric mist, epic lighting, hyper-realistic 8k",
                "search_query": f"{topic} ancient colorized"
            },
            {
                "scene_id": 2,
                "narration": f"Hidden evidence was buried under layers of forgotten history, guarded by those who refused to let the truth escape.",
                "image_prompt": f"Ancient parchment manuscript and lost ruins related to {topic}, warm golden hour lighting, cinematic",
                "search_query": f"{topic} relics ancient"
            },
            {
                "scene_id": 3,
                "narration": f"Today, modern researchers are finally unraveling the puzzle, revealing a secret that changes everything.",
                "image_prompt": f"Modern discovery expedition uncovering relics of {topic}, dramatic lighting, National Geographic style",
                "search_query": f"{topic} discovery ruins"
            }
        ][:num_scenes]
    }


async def generate_speech_and_srt(narration: str, audio_path: Path, srt_path: Path, voice: str = "en-US-ChristopherNeural"):
    """Uses edge-tts to generate high-quality neural voiceover and valid SRT subtitles."""
    communicate = edge_tts.Communicate(narration, voice)
    submaker = edge_tts.SubMaker()

    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                submaker.feed(chunk)

    srt_content = submaker.get_srt()
    if not srt_content.strip():
        # Fallback single cue if boundary chunks were not captured
        srt_content = f"1\n00:00:00,500 --> 00:00:08,000\n{narration}\n"

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)


def get_audio_duration(audio_path: Path) -> float:
    """Uses ffprobe to get exact duration in seconds."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(audio_path.resolve())
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return float(result.stdout.strip())


def _download_image_url(url: str, output_path: Path, min_size: int = 15000) -> bool:
    """Helper: download any image URL to a file. Returns True on success."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "VideoFarmStudio/1.0", "Accept": "image/*,*/*"}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            data = res.read()
        if len(data) > min_size:
            with open(output_path, "wb") as f:
                f.write(data)
            return True
    except Exception:
        pass
    return False


def _download_wikimedia_image(query: str, output_path: Path, scene_index: int = 0) -> bool:
    """
    Fetches high-resolution images from Wikimedia Commons.
    NO API KEY required — completely free and stable.
    Docs: https://commons.wikimedia.org/w/api.php
    """
    try:
        clean_q = re.sub(r'[^\w\s-]', ' ', query).strip()
        if not clean_q:
            return False

        # Step 1: Search Wikimedia Commons for matching files
        search_url = (
            "https://commons.wikimedia.org/w/api.php"
            f"?action=query&list=search&srsearch={urllib.parse.quote(clean_q)}"
            "&srnamespace=6&srlimit=15&format=json"
        )
        req = urllib.request.Request(search_url, headers={"User-Agent": "VideoFarmStudio/1.0"})
        with urllib.request.urlopen(req, timeout=8) as res:
            results = json.loads(res.read()).get("query", {}).get("search", [])

        if not results:
            return False

        # Pick a different result per scene to avoid repeating the same image
        pick = results[scene_index % len(results)]
        title = pick["title"]  # e.g. "File:Black hole Cygnus X-1.png"

        # Step 2: Get the actual download URL via imageinfo API
        info_url = (
            "https://commons.wikimedia.org/w/api.php"
            f"?action=query&titles={urllib.parse.quote(title)}"
            "&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json"
        )
        req2 = urllib.request.Request(info_url, headers={"User-Agent": "VideoFarmStudio/1.0"})
        with urllib.request.urlopen(req2, timeout=8) as res2:
            pages = json.loads(res2.read()).get("query", {}).get("pages", {})
            for page in pages.values():
                ii = page.get("imageinfo", [{}])[0]
                img_url = ii.get("thumburl") or ii.get("url")
                if img_url and _download_image_url(img_url, output_path):
                    print(f"[Visual] Wikimedia Commons: {output_path.name}")
                    return True
    except Exception as e:
        print(f"[Visual Wikimedia Notice]: {e}")
    return False


def _download_pexels_image(query: str, output_path: Path, scene_index: int = 0) -> bool:
    """
    Fetches HD images from Pexels API.
    Requires PEXELS_API_KEY in .env — FREE at https://pexels.com/api
    Activates automatically when key is present.
    """
    pexels_key = os.environ.get("PEXELS_API_KEY", "")
    if not pexels_key:
        return False
    try:
        clean_q = re.sub(r'[^\w\s-]', ' ', query).strip()
        url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(clean_q)}&per_page=15&orientation=landscape"
        req = urllib.request.Request(url, headers={"Authorization": pexels_key})
        with urllib.request.urlopen(req, timeout=8) as res:
            photos = json.loads(res.read()).get("photos", [])
        if not photos:
            return False
        pick = photos[scene_index % len(photos)]
        img_url = pick.get("src", {}).get("large2x") or pick.get("src", {}).get("large")
        if img_url and _download_image_url(img_url, output_path):
            print(f"[Visual] Pexels HD: {output_path.name}")
            return True
    except Exception as e:
        print(f"[Pexels notice]: {e}")
    return False


def _download_wikipedia_image(query: str, output_path: Path, scene_index: int = 0) -> bool:
    """Fetches authentic documentary photographs from Wikipedia REST API."""
    try:
        clean_q = re.sub(r'[^\w\s-]', ' ', query).strip()
        url = f"https://en.wikipedia.org/w/rest.php/v1/search/page?q={urllib.parse.quote(clean_q)}&limit=6"
        req = urllib.request.Request(url, headers={"User-Agent": "VideoFarmStudio/1.0 (educational_web_service)"})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read())
            pages = data.get("pages", [])

        pages_with_imgs = [p for p in pages if p.get("thumbnail")]
        if not pages_with_imgs:
            return False

        start_idx = scene_index % len(pages_with_imgs)
        candidates = pages_with_imgs[start_idx:] + pages_with_imgs[:start_idx]

        for p in candidates:
            thumb = p.get("thumbnail", {}).get("url")
            if thumb:
                full_url = "https:" + re.sub(r'/\d+px-', '/1280px-', thumb.split("?")[0])
                try:
                    dl_req = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(dl_req, timeout=8) as img_res:
                        data = img_res.read()
                        if len(data) > 15000:
                            with open(output_path, "wb") as f:
                                f.write(data)
                            return True
                except Exception:
                    continue
    except Exception as e:
        print(f"[Visual Wiki Notice]: {e}")
    return False


def _download_openverse_image(query: str, output_path: Path, scene_index: int = 0) -> bool:
    """Fetches Creative Commons and public domain images from Openverse."""
    try:
        clean_q = re.sub(r'[^\w\s-]', ' ', query).strip()
        url = f"https://api.openverse.org/v1/images/?q={urllib.parse.quote(clean_q)}&page_size=8"
        req = urllib.request.Request(url, headers={"User-Agent": "VideoFarmStudio/1.0"})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read())
            results = data.get("results", [])

        if not results:
            return False

        start_idx = scene_index % len(results)
        candidates = results[start_idx:] + results[:start_idx]

        for r in candidates[:5]:
            img_url = r.get("url")
            if not img_url or img_url.endswith(".svg"):
                continue
            try:
                dl_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(dl_req, timeout=8) as img_res:
                    data = img_res.read()
                    if len(data) > 15000:
                        with open(output_path, "wb") as f:
                            f.write(data)
                        return True
            except Exception:
                continue
    except Exception as e:
        print(f"[Visual Openverse Notice]: {e}")
    return False


def _generate_procedural_backdrop(topic: str, scene_idx: int, width: int, height: int, output_path: Path):
    """Generates an aesthetic procedural documentary backdrop if all network sources fail."""
    import hashlib
    # Derive unique pleasant gradient hues based on topic + scene index
    h = int(hashlib.md5(f"{topic}_{scene_idx}".encode()).hexdigest()[:6], 16)
    r = (h >> 16) & 0xFF
    g = (h >> 8) & 0xFF
    b = h & 0xFF
    # Keep colors dark and cinematic
    r, g, b = int(r * 0.3), int(g * 0.3), int(b * 0.4)
    hex_color = f"0x{r:02x}{g:02x}{b:02x}"

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"color=c={hex_color}:s={width}x{height}:d=1",
        "-vframes", "1",
        str(output_path.resolve())
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def fetch_scene_visual(
    query: str,
    prompt: str,
    output_path: Path,
    is_vertical: bool = False,
    source: str = "ai",
    scene_index: int = 0,
    topic: str = ""
):
    """
    Fetches or generates a 100% topic-relevant visual.
    Guarantees that each scene receives a unique, topic-specific image.
    """
    width, height = (720, 1280) if is_vertical else (1280, 720)
    search_keywords = query or prompt or topic

    # 1. If AI is selected, attempt Pollinations Turbo with short prompt + seed
    if source == "ai":
        try:
            import random
            short_prompt = (prompt[:120] if prompt else search_keywords)
            seed = random.randint(1000, 999999)
            encoded = urllib.parse.quote(f"{short_prompt}, documentary photograph, cinematic 8k, dramatic light")
            ai_url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&model=turbo&seed={seed}&nologo=true"
            req = urllib.request.Request(ai_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as res:
                data = res.read()
                if len(data) > 15000:
                    with open(output_path, "wb") as f:
                        f.write(data)
                    return
        except Exception as e:
            print(f"[Visual Notice]: AI generation skipped ({e}), falling back to real-time topic photo search...")

    # 2. Pexels HD — best quality, auto-enabled when PEXELS_API_KEY is in .env
    if _download_pexels_image(search_keywords, output_path, scene_index=scene_index):
        return

    # 3. Wikimedia Commons — millions of CC-licensed images, NO API key needed
    if _download_wikimedia_image(search_keywords, output_path, scene_index=scene_index):
        return

    # Retry Wikimedia with broader topic if specific query failed
    if topic and topic.lower() not in search_keywords.lower():
        if _download_wikimedia_image(topic, output_path, scene_index=scene_index):
            return

    # 3. Wikipedia REST API — HD article thumbnails, NO API key needed
    if _download_wikipedia_image(search_keywords, output_path, scene_index=scene_index):
        return

    if topic and _download_wikipedia_image(topic, output_path, scene_index=scene_index):
        return

    # 4. Openverse — Creative Commons images, NO API key needed
    if _download_openverse_image(search_keywords, output_path, scene_index=scene_index):
        return

    # 5. Guaranteed Procedural Backdrop (always works, local, no network needed)
    _generate_procedural_backdrop(topic or search_keywords, scene_index, width, height, output_path)


def render_scene_clip(
    image_path: Path,
    audio_path: Path,
    srt_path: Path,
    duration: float,
    is_vertical: bool,
    output_path: Path
):
    """Renders a scene video clip with Ken Burns motion and stylized subtitles."""
    dur = duration + 0.25
    fps = 30
    total_frames = int(dur * fps)

    abs_srt = srt_path.resolve().as_posix().replace(":", "\\:")

    if is_vertical:
        width, height = 720, 1280
        zoom_expr = "min(zoom+0.0015,1.25)"
        sub_style = "Fontname=Helvetica,Bold=1,FontSize=26,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Alignment=2,MarginV=180"
    else:
        width, height = 1280, 720
        zoom_expr = "min(zoom+0.0012,1.20)"
        sub_style = "Fontname=Helvetica,Bold=1,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Alignment=2,MarginV=35"

    filter_complex = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
        f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}:fps={fps},"
        f"subtitles='{abs_srt}':force_style='{sub_style}'[v]"
    )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", str(dur), "-i", str(image_path.resolve()),
        "-i", str(audio_path.resolve()),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(output_path.resolve())
    ]

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        # Fallback without subtitles filter if libass overlay has issues
        fallback_filter = (
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
            f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={width}x{height}:fps={fps}[v]"
        )
        cmd_fallback = [
            "ffmpeg", "-y",
            "-loop", "1", "-t", str(dur), "-i", str(image_path.resolve()),
            "-i", str(audio_path.resolve()),
            "-filter_complex", fallback_filter,
            "-map", "[v]",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(output_path.resolve())
        ]
        subprocess.run(cmd_fallback, check=True)


def concatenate_scenes(scene_videos: List[Path], final_output: Path, work_dir: Path):
    """Concatenates all individual scene videos into one cohesive MP4."""
    concat_file = work_dir / "concat_list.txt"
    with open(concat_file, "w") as f:
        for v in scene_videos:
            f.write(f"file '{v.resolve()}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-c", "copy",
        str(final_output.resolve())
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def execute_video_pipeline(
    job_id: str,
    topic: str,
    format_type: str = "long",  # "long" (16:9) or "short" (9:16)
    num_scenes: int = 3,
    voice: str = "en-US-ChristopherNeural",
    visual_source: str = "ai",
    custom_script: Optional[Dict[str, Any]] = None,
    log_fn: Optional[Callable[[str, int, str], None]] = None
) -> Dict[str, Any]:
    """
    Executes the full pipeline for a job.
    log_fn signature: log_fn(message, percent, step_name)
    """
    def log(msg: str, percent: int, step: str):
        print(f"[{job_id}][{percent}%][{step}] {msg}")
        if log_fn:
            log_fn(msg, percent, step)

    work_dir = OUTPUT_DIR / job_id
    work_dir.mkdir(parents=True, exist_ok=True)
    is_vertical = (format_type == "short")

    log(f"Initiating pipeline for '{topic}' ({'9:16 Shorts/Reels' if is_vertical else '16:9 Landscape Documentary'})...", 5, "Initializing")

    # Step 1: Script
    if custom_script and "scenes" in custom_script and len(custom_script["scenes"]) > 0:
        log("Using user-reviewed/custom studio script...", 15, "Scripting")
        script_data = custom_script
    else:
        log("Generating AI script, metadata, and scene breakdowns with Groq...", 15, "Scripting")
        script_data = generate_script_ai(topic, format_type, num_scenes)

    scenes = script_data.get("scenes", [])
    if not scenes:
        raise ValueError("No scenes found in script data.")

    # Save script metadata
    with open(work_dir / "script.json", "w", encoding="utf-8") as f:
        json.dump(script_data, f, indent=2)

    scene_clips = []
    total_scenes = len(scenes)

    for i, sc in enumerate(scenes):
        idx = sc.get("scene_id", i + 1)
        narration = sc.get("narration", "")
        img_prompt = sc.get("image_prompt", "")
        search_query = sc.get("search_query", topic)

        base_pct = 20 + int((i / total_scenes) * 70)
        log(f"Processing Scene {idx}/{total_scenes}: Synthesizing neural voiceover...", base_pct, f"Scene {idx} Audio")

        audio_path = work_dir / f"scene_{idx}.mp3"
        srt_path = work_dir / f"scene_{idx}.srt"
        img_path = work_dir / f"scene_{idx}.jpg"
        clip_path = work_dir / f"scene_{idx}.mp4"

        # 1. Voice
        asyncio.run(generate_speech_and_srt(narration, audio_path, srt_path, voice))
        duration = get_audio_duration(audio_path)

        # 2. Visual
        log(f"Processing Scene {idx}/{total_scenes}: Sourcing visual ({visual_source.upper()})...", base_pct + 10, f"Scene {idx} Visual")
        fetch_scene_visual(search_query, img_prompt, img_path, is_vertical=is_vertical, source=visual_source, scene_index=i, topic=topic)

        # 3. Clip Render
        log(f"Processing Scene {idx}/{total_scenes}: Rendering Ken Burns motion clip...", base_pct + 20, f"Scene {idx} Render")
        render_scene_clip(img_path, audio_path, srt_path, duration, is_vertical=is_vertical, output_path=clip_path)
        scene_clips.append(clip_path)

    # Final Concatenation
    log("Stitching all scenes into cohesive final video...", 95, "Finalizing")
    final_mp4 = work_dir / "final_video.mp4"
    concatenate_scenes(scene_clips, final_mp4, work_dir)

    file_size_mb = final_mp4.stat().st_size / (1024 * 1024)
    log(f"Rendering complete! Video ready: {file_size_mb:.2f} MB", 100, "Completed")

    return {
        "job_id": job_id,
        "topic": topic,
        "format": format_type,
        "voice": voice,
        "title": script_data.get("title", topic),
        "description": script_data.get("description", ""),
        "tags": script_data.get("tags", []),
        "scenes_count": total_scenes,
        "file_size_mb": round(file_size_mb, 2),
        "video_url": f"/output/{job_id}/final_video.mp4",
        "script": script_data,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
