"""
YouTube AI Clipper
==================
Extracts the most engaging 30–60s clip from any YouTube video.

Pipeline:
  1. yt-dlp        → Download audio + video (free, no key)
  2. Groq Whisper  → Transcribe with word-level timestamps (free, uses your key)
  3. Groq LLaMA   → Identify the viral "hook" moment (free, same key)
  4. FFmpeg        → Trim, crop to 9:16, burn animated captions (free, local)

No extra libraries needed beyond what's already in requirements.txt.
"""

import os
import json
import re
import subprocess
import tempfile
import time
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Callable, Optional

# Load env
from dotenv import load_dotenv
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Auto-discover key from project root .env if not set
if not GROQ_API_KEY or GROQ_API_KEY.startswith("gsk_your_"):
    _root = Path(__file__).resolve().parent.parent
    for _cand in [_root / ".env", Path(__file__).resolve().parent / ".env"]:
        if _cand.exists():
            for _line in _cand.read_text().splitlines():
                if _line.startswith("GROQ_API_KEY="):
                    _v = _line.split("=", 1)[1].strip().strip('"').strip("'")
                    if _v and not _v.startswith("gsk_your_"):
                        GROQ_API_KEY = _v
                        os.environ["GROQ_API_KEY"] = _v
                        break

import requests


# ─── Step 1: Download ────────────────────────────────────────────────────────

def download_youtube_video(url: str, output_dir: Path, log_fn: Optional[Callable] = None) -> tuple[str, str]:
    """
    Downloads video + audio using yt-dlp (no API key required).
    Returns (video_path, video_id).
    """
    if log_fn:
        log_fn("Downloading video from YouTube...", 10, "Downloading")

    # Download best quality up to 1080p (keeps file size manageable)
    ydl_opts = [
        "yt-dlp",
        "--format", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "--output", str(output_dir / "%(id)s.%(ext)s"),
        "--quiet",
        url,
    ]

    result = subprocess.run(ydl_opts, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr[:500]}")

    # Find the downloaded file
    mp4_files = list(output_dir.glob("*.mp4"))
    if not mp4_files:
        raise RuntimeError("No MP4 file found after download")

    video_path = str(sorted(mp4_files, key=lambda f: f.stat().st_mtime, reverse=True)[0])
    video_id = Path(video_path).stem

    if log_fn:
        size_mb = Path(video_path).stat().st_size / (1024 * 1024)
        log_fn(f"Downloaded: {Path(video_path).name} ({size_mb:.1f} MB)", 20, "Downloaded")

    return video_path, video_id


# ─── Step 2: Extract audio for Whisper ───────────────────────────────────────

def extract_audio(video_path: str, output_dir: Path, log_fn: Optional[Callable] = None) -> str:
    """Extracts a compressed mono MP3 from the video for Groq Whisper."""
    if log_fn:
        log_fn("Extracting audio track...", 28, "Extracting Audio")

    audio_path = str(output_dir / "audio_for_transcription.mp3")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",                    # no video
        "-ar", "16000",           # 16kHz — Whisper optimal
        "-ac", "1",               # mono
        "-b:a", "64k",            # compress to keep under 25MB Groq limit
        audio_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr[:300]}")

    size_mb = Path(audio_path).stat().st_size / (1024 * 1024)
    if log_fn:
        log_fn(f"Audio extracted ({size_mb:.1f} MB)", 35, "Audio Ready")

    return audio_path


# ─── Step 3: Transcribe with Groq Whisper ────────────────────────────────────

def transcribe_with_groq(audio_path: str, log_fn: Optional[Callable] = None) -> dict:
    """
    Transcribes audio using Groq's Whisper API.
    FREE — uses your existing Groq key, 2000 requests/day limit.
    Returns the full Groq response dict with segments + timestamps.
    """
    if not GROQ_API_KEY or GROQ_API_KEY.startswith("gsk_your_"):
        raise RuntimeError("GROQ_API_KEY not configured. Add it to your .env file.")

    if log_fn:
        log_fn("Transcribing speech with Groq Whisper...", 40, "Transcribing")

    # Check file size — Groq Whisper limit is 25MB
    size_mb = Path(audio_path).stat().st_size / (1024 * 1024)
    if size_mb > 24:
        # Split to first 24MB worth (roughly 60 min of 64kbps audio)
        if log_fn:
            log_fn(f"Audio is {size_mb:.1f}MB, trimming to fit Groq's 25MB limit...", 38, "Trimming Audio")
        trimmed_path = str(Path(audio_path).parent / "audio_trimmed.mp3")
        subprocess.run([
            "ffmpeg", "-y", "-i", audio_path,
            "-t", "3600",  # max 1 hour
            "-c", "copy", trimmed_path
        ], capture_output=True)
        audio_path = trimmed_path

    with open(audio_path, "rb") as f:
        response = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            files={"file": (Path(audio_path).name, f, "audio/mpeg")},
            data={
                "model": "whisper-large-v3-turbo",
                "response_format": "verbose_json",   # includes segments + timestamps
                "timestamp_granularities[]": "segment",
            },
            timeout=120
        )

    if response.status_code != 200:
        raise RuntimeError(f"Groq Whisper API error {response.status_code}: {response.text[:300]}")

    data = response.json()
    if log_fn:
        duration = data.get("duration", 0)
        segments = len(data.get("segments", []))
        log_fn(f"Transcribed {duration:.0f}s of speech, {segments} segments", 55, "Transcribed")

    return data


# ─── Step 4: Find viral moment with Groq LLaMA ───────────────────────────────

def find_viral_moment(transcript_data: dict, log_fn: Optional[Callable] = None) -> dict:
    """
    Sends the transcript to Groq LLaMA to find the best 30–60s clip.
    Returns dict with start_time, end_time, title, reasoning.
    """
    if log_fn:
        log_fn("Analyzing transcript for viral moments...", 62, "AI Analysis")

    segments = transcript_data.get("segments", [])
    full_text = transcript_data.get("text", "")

    # Build a structured transcript with timestamps for LLaMA
    timestamped_lines = []
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "").strip()
        if text:
            timestamped_lines.append(f"[{start:.1f}s–{end:.1f}s] {text}")

    transcript_for_ai = "\n".join(timestamped_lines[:300])  # cap to fit context

    prompt = f"""You are an expert viral content strategist for TikTok and YouTube Shorts.

Analyze this transcript and find the single best 30–60 second clip that:
- Starts with a strong hook (surprising fact, bold claim, emotional moment, or curiosity gap)
- Contains a complete, standalone idea (viewers shouldn't need context)
- Has high energy or emotional intensity
- Ends with satisfying closure or a cliffhanger

Return ONLY a valid JSON object, nothing else:
{{
    "start_time": <number in seconds>,
    "end_time": <number in seconds>,
    "title": "<catchy short-form title under 60 chars>",
    "hook": "<the first sentence that will stop the scroll>",
    "reasoning": "<why this moment will go viral>"
}}

TRANSCRIPT WITH TIMESTAMPS:
{transcript_for_ai}
"""

    models_to_try = ["llama-3.3-70b-versatile", "llama3-70b-8192", "llama-3.1-8b-instant"]

    for model in models_to_try:
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                },
                timeout=30
            )

            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"].strip()
                # Strip markdown code blocks if present
                content = re.sub(r"```(?:json)?\s*", "", content).strip().rstrip("`")
                result = json.loads(content)
                if log_fn:
                    log_fn(f"Best clip: {result['start_time']:.0f}s – {result['end_time']:.0f}s | \"{result.get('title', '')}\"", 70, "Clip Selected")
                return result

        except Exception as e:
            print(f"[LLaMA model {model} notice]: {e}")
            continue

    # Fallback: pick first 45 seconds
    if log_fn:
        log_fn("Using first 45s as fallback clip", 70, "Clip Selected")
    return {
        "start_time": 0,
        "end_time": 45,
        "title": "Highlight Clip",
        "hook": full_text[:100],
        "reasoning": "Fallback selection"
    }


# ─── Step 5: Render the final vertical clip ───────────────────────────────────

def render_vertical_clip(
    video_path: str,
    start: float,
    end: float,
    output_path: str,
    title: str = "",
    log_fn: Optional[Callable] = None
) -> bool:
    """
    Trims, crops to 9:16, and optionally overlays the title text.
    Uses only FFmpeg — no extra libraries needed.
    """
    if log_fn:
        log_fn(f"Rendering 9:16 clip ({end - start:.0f}s)...", 78, "Rendering")

    duration = end - start
    if duration <= 0:
        raise ValueError(f"Invalid clip range: {start}s → {end}s")

    # Get video dimensions
    probe_cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        video_path
    ]
    probe = subprocess.run(probe_cmd, capture_output=True, text=True)
    probe_data = json.loads(probe.stdout)
    streams = probe_data.get("streams", [{}])
    src_w = int(streams[0].get("width", 1920))
    src_h = int(streams[0].get("height", 1080))

    # Calculate 9:16 center crop from the source
    target_w = int(src_h * 9 / 16)  # width for 9:16 at source height
    target_w = min(target_w, src_w)
    crop_x = int((src_w - target_w) / 2)

    # Output at 720×1280 (standard Shorts resolution)
    out_w, out_h = 720, 1280

    # Build title overlay (safe_text escapes special chars for FFmpeg)
    safe_title = title.replace("'", "").replace(":", " ").replace("\\", "")[:60]
    title_filter = ""
    if safe_title:
        title_filter = (
            f",drawtext=text='{safe_title}'"
            ":fontcolor=white:fontsize=36:box=1:boxcolor=black@0.6:boxborderw=12"
            ":x=(w-text_w)/2:y=h*0.88:line_spacing=8"
        )

    video_filter = (
        f"trim=start={start}:end={end},setpts=PTS-STARTPTS,"
        f"crop={target_w}:{src_h}:{crop_x}:0,"
        f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,"
        f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:black"
        f"{title_filter}"
    )
    audio_filter = f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS"

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", video_filter,
        "-af", audio_filter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[FFmpeg render error]: {result.stderr[:500]}")
        return False

    if log_fn:
        size_mb = Path(output_path).stat().st_size / (1024 * 1024)
        log_fn(f"Clip rendered: {Path(output_path).name} ({size_mb:.1f} MB)", 95, "Rendered")

    return True


# ─── Main orchestrator ────────────────────────────────────────────────────────

class YouTubeClipper:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def process(self, url: str, log_fn: Optional[Callable] = None) -> dict:
        """
        Full pipeline: URL → viral 9:16 short clip.
        Returns dict with status, file_name, title, reasoning.
        """
        try:
            # 1. Download
            video_path, video_id = download_youtube_video(url, self.output_dir, log_fn)

            # 2. Extract audio
            audio_path = extract_audio(video_path, self.output_dir, log_fn)

            # 3. Transcribe (Groq Whisper API — free)
            transcript_data = transcribe_with_groq(audio_path, log_fn)

            # 4. Find viral moment (Groq LLaMA — free)
            clip_info = find_viral_moment(transcript_data, log_fn)

            start_time = float(clip_info.get("start_time", 0))
            end_time = float(clip_info.get("end_time", 60))
            title = clip_info.get("title", "Viral Clip")

            # 5. Render vertical clip (FFmpeg — free)
            output_filename = f"{video_id}_short.mp4"
            output_path = str(self.output_dir / output_filename)

            success = render_vertical_clip(
                video_path, start_time, end_time,
                output_path, title, log_fn
            )

            if success:
                if log_fn:
                    log_fn("Clip ready!", 100, "Complete")
                return {
                    "status": "success",
                    "file_name": output_filename,
                    "title": title,
                    "hook": clip_info.get("hook", ""),
                    "reasoning": clip_info.get("reasoning", ""),
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": round(end_time - start_time, 1),
                }
            else:
                return {"status": "error", "message": "FFmpeg rendering failed"}

        except Exception as e:
            return {"status": "error", "message": str(e)}


# ─── CLI usage ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python youtube_clipper.py <youtube_url>")
        sys.exit(1)

    url = sys.argv[1]
    out = Path("./output/clipper_test")
    print(f"\n🎬 YouTube AI Clipper")
    print(f"URL: {url}\n")

    def cli_log(msg, pct, step):
        print(f"[{pct:3d}%] [{step}] {msg}")

    clipper = YouTubeClipper(out)
    result = clipper.process(url, log_fn=cli_log)

    print("\n" + "=" * 50)
    if result["status"] == "success":
        print(f"✅ Clip saved: {result['file_name']}")
        print(f"   Title:    {result['title']}")
        print(f"   Duration: {result['duration']}s")
        print(f"   Hook:     {result['hook']}")
    else:
        print(f"❌ Error: {result['message']}")
