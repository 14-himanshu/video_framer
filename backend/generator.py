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
import requests

# Try to import edge-tts
try:
    import edge_tts
except ImportError:
    print("[ERROR] edge-tts is not installed in this environment.")
    print("Please run: .venv/bin/pip install edge-tts requests")
    sys.exit(1)


# Configuration: Paste your Groq API key below, or set it via environment variable / .env file
GROQ_API_KEY = ""

# Auto-load .env or .env.example file if present
for _candidate in [Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent / ".env.example"]:
    if _candidate.exists() and "GROQ_API_KEY" not in os.environ:
        for _line in _candidate.read_text(encoding="utf-8").splitlines():
            _line = _line.strip()
            if _line.startswith("GROQ_API_KEY="):
                _val = _line.split("=", 1)[1].strip().strip('"').strip("'")
                if _val and not _val.startswith("your_") and not _val.startswith("gsk_your_"):
                    os.environ["GROQ_API_KEY"] = _val
                    break


def generate_script(topic: str, num_scenes: int = 3) -> list:
    """Generates scenes with narration and search queries for visuals."""
    print(f"\n[1/4] 📝 Generating script for topic: '{topic}'...")

    groq_key = os.environ.get("GROQ_API_KEY") or GROQ_API_KEY

    if groq_key:
        models_to_try = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        prompt = f"""You are a professional documentary scriptwriter. Write a compelling {num_scenes}-scene script about: "{topic}".
Return ONLY a valid JSON array of objects with keys:
- "scene_id": number (1, 2, ...)
- "narration": 2-3 sentences of dramatic, intriguing narration
- "search_query": 2-4 keywords to search for historical/cinematic imagery (e.g. "Library of Alexandria ancient")

No markdown formatting, no conversational text, just the raw JSON array."""

        for model_name in models_to_try:
            try:
                print(f" -> Calling Groq ({model_name}) for custom script...")
                payload = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7
                }
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    match = re.search(r"\[\s*\{.*\}\s*\]", content, re.DOTALL)
                    if match:
                        scenes_data = json.loads(match.group(0))
                        print(f" -> Successfully generated {len(scenes_data)} scenes using AI ({model_name})!")
                        return scenes_data
                else:
                    err_msg = res.json().get("error", {}).get("message", res.text)
                    print(f" -> [Groq Notice with {model_name}]: {err_msg}")
            except Exception as e:
                print(f" -> [Groq Notice with {model_name}]: {e}")

        print(" -> Falling back to built-in template engine.")

    # Dynamic topic-specific default documentary scenes (never hardcoded to Egypt/Alexandria)
    clean_topic = topic.strip()
    scenes = [
        {
            "scene_id": 1,
            "narration": f"For centuries, the world has questioned the truth behind {clean_topic}. But the real story began long before anyone suspected.",
            "search_query": f"{clean_topic} history"
        },
        {
            "scene_id": 2,
            "narration": f"Beneath the surface of {clean_topic}, hidden evidence and forgotten artifacts lay waiting for researchers to uncover.",
            "search_query": f"{clean_topic} artifacts ruins"
        },
        {
            "scene_id": 3,
            "narration": f"Today, modern discoveries surrounding {clean_topic} are changing what we thought we knew, proving reality is stranger than fiction.",
            "search_query": f"{clean_topic} discovery"
        }
    ]
    return scenes[:num_scenes]


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
        srt_content = f"1\n00:00:00,500 --> 00:00:09,000\n{narration}\n"

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)


def get_audio_duration(audio_path: Path) -> float:
    """Uses ffprobe to get exact duration in seconds."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(audio_path)
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return float(result.stdout.strip())


def _download_image(url: str, output_path: Path, min_size: int = 15000) -> bool:
    """Helper: download an image URL and save if it meets minimum size. Returns True on success."""
    try:
        headers = {
            "User-Agent": "VideoFarmBot/1.0 (https://github.com/videofarm; educational use)",
            "Accept": "image/*,*/*",
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as res:
            data = res.read()
        if len(data) > min_size:
            with open(output_path, "wb") as f:
                f.write(data)
            return True
    except Exception:
        pass
    return False


def fetch_scene_image(query: str, output_path: Path, scene_index: int = 0):
    """
    Fetches a high-resolution, topic-relevant image using a 5-source fallback chain.
    ALL sources are completely FREE with NO API key and NO signup required.

    Source priority:
      1. Wikimedia Commons API (NO key — millions of high-res, CC-licensed images)
      2. Wikipedia REST API    (NO key — HD article thumbnails)
      3. Openverse API         (NO key — Creative Commons photo search)
      4. Pollinations AI       (NO key — AI-generated image as last resort)
      5. FFmpeg color block    (local  — absolute fallback, always works)
    """
    clean_q = re.sub(r'[^\w\s-]', ' ', query).strip()
    print(f" -> Sourcing visual for: '{clean_q}' (scene {scene_index + 1})...")

    # ─── Source 1: Wikimedia Commons API (no key required) ───────────────────
    # Docs: https://commons.wikimedia.org/w/api.php
    try:
        search_url = (
            "https://commons.wikimedia.org/w/api.php"
            f"?action=query&list=search&srsearch={urllib.parse.quote(clean_q)}"
            "&srnamespace=6&srlimit=10&format=json"
        )
        req = urllib.request.Request(search_url, headers={"User-Agent": "VideoFarmBot/1.0"})
        with urllib.request.urlopen(req, timeout=8) as res:
            results = json.loads(res.read()).get("query", {}).get("search", [])

        # Pick a different result per scene to avoid repetition
        if results:
            pick = results[scene_index % len(results)]
            title = pick["title"]  # e.g. "File:Black hole.jpg"
            # Get the actual file URL via imageinfo API
            info_url = (
                "https://commons.wikimedia.org/w/api.php"
                f"?action=query&titles={urllib.parse.quote(title)}"
                "&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json"
            )
            req2 = urllib.request.Request(info_url, headers={"User-Agent": "VideoFarmBot/1.0"})
            with urllib.request.urlopen(req2, timeout=8) as res2:
                pages = json.loads(res2.read()).get("query", {}).get("pages", {})
                for page in pages.values():
                    ii = page.get("imageinfo", [{}])[0]
                    img_url = ii.get("thumburl") or ii.get("url")
                    if img_url and _download_image(img_url, output_path):
                        print(f" -> [Source 1] Wikimedia Commons: {output_path.name}")
                        return
    except Exception as e:
        print(f" -> [Wikimedia notice]: {e}")

    # ─── Source 2: Wikipedia REST API (no key required) ──────────────────────
    # Docs: https://en.wikipedia.org/api/rest_v1/
    try:
        url = (
            f"https://en.wikipedia.org/w/rest.php/v1/search/page"
            f"?q={urllib.parse.quote(clean_q)}&limit=8"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "VideoFarmBot/1.0"})
        with urllib.request.urlopen(req, timeout=6) as res:
            pages = json.loads(res.read()).get("pages", [])

        pages_with_imgs = [p for p in pages if p.get("thumbnail")]
        if pages_with_imgs:
            p = pages_with_imgs[scene_index % len(pages_with_imgs)]
            thumb_url = p["thumbnail"].get("url", "")
            # Upgrade to 1280px wide version
            hd_url = "https:" + re.sub(r'/\d+px-', '/1280px-', thumb_url.split("?")[0])
            if _download_image(hd_url, output_path) or _download_image("https:" + thumb_url, output_path):
                print(f" -> [Source 2] Wikipedia HD: {output_path.name}")
                return
    except Exception as e:
        print(f" -> [Wikipedia notice]: {e}")

    # ─── Source 3: Openverse API (no key required for basic search) ──────────
    # Docs: https://api.openverse.org/v1/
    try:
        ov_url = (
            f"https://api.openverse.org/v1/images/"
            f"?q={urllib.parse.quote(clean_q)}&page_size=20&license_type=commercial"
        )
        req = urllib.request.Request(
            ov_url,
            headers={
                "User-Agent": "VideoFarmBot/1.0",
                "Accept": "application/json",
            }
        )
        with urllib.request.urlopen(req, timeout=8) as res:
            results = json.loads(res.read()).get("results", [])

        if results:
            pick = results[scene_index % len(results)]
            # Prefer the full URL, fall back to thumbnail
            img_url = pick.get("url") or pick.get("thumbnail")
            if img_url and _download_image(img_url, output_path):
                print(f" -> [Source 3] Openverse (CC): {output_path.name}")
                return
    except Exception as e:
        print(f" -> [Openverse notice]: {e}")

    # ─── Source 4: Pollinations AI (no key, AI-generated) ────────────────────
    # Docs: https://pollinations.ai/
    try:
        # Use a documentary/cinematic style prompt
        ai_prompt = f"{clean_q} cinematic documentary photograph high resolution 4k"
        seed = scene_index * 137 + hash(clean_q) % 10000  # different seed per scene
        poll_url = (
            f"https://image.pollinations.ai/prompt/{urllib.parse.quote(ai_prompt)}"
            f"?width=1280&height=720&seed={abs(seed)}&nologo=true"
        )
        req = urllib.request.Request(poll_url, headers={"User-Agent": "VideoFarmBot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as res:  # AI gen takes longer
            data = res.read()
        if len(data) > 15000:
            with open(output_path, "wb") as f:
                f.write(data)
            print(f" -> [Source 4] Pollinations AI generated: {output_path.name}")
            return
    except Exception as e:
        print(f" -> [Pollinations notice]: {e}")

    # ─── Source 5: FFmpeg procedural color block (always works, local) ────────
    import hashlib
    h = int(hashlib.md5(f"{clean_q}_{scene_index}".encode()).hexdigest()[:6], 16)
    hex_color = f"0x{(h>>16)&0xFF:02x}{(h>>8)&0xFF:02x}{h&0xFF:02x}"
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"color=c={hex_color}:s=1280x720:d=1",
        "-vframes", "1", str(output_path.resolve())
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(f" -> [Source 5] Procedural color backdrop: {output_path.name}")


def render_scene(image_path: Path, audio_path: Path, srt_path: Path, duration: float, output_path: Path):
    """Composites an image with Ken Burns slow zoom, narration audio, and burned subtitles."""
    dur = duration + 0.2
    fps = 30
    total_frames = int(dur * fps)

    # Use absolute path and escape colon for ffmpeg filter
    abs_srt = srt_path.resolve().as_posix().replace(":", "\\:")

    filter_complex = (
        f"[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,"
        f"zoompan=z='min(zoom+0.0012,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1280x720:fps={fps},"
        f"subtitles='{abs_srt}':force_style='Fontname=Helvetica,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Alignment=2,MarginV=35'[v]"
    )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", str(dur), "-i", str(image_path.resolve()),
        "-i", str(audio_path.resolve()),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(output_path.resolve())
    ]

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print("[FFmpeg Warning]: Subtitle overlay filter failed, falling back to clean video without hardcoded subtitles...")
        # Fallback without subtitle filter
        fallback_filter = (
            f"[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,"
            f"zoompan=z='min(zoom+0.0012,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1280x720:fps={fps}[v]"
        )
        cmd_fallback = [
            "ffmpeg", "-y",
            "-loop", "1", "-t", str(dur), "-i", str(image_path.resolve()),
            "-i", str(audio_path.resolve()),
            "-filter_complex", fallback_filter,
            "-map", "[v]",
            "-map", "1:a",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(output_path.resolve())
        ]
        subprocess.run(cmd_fallback, check=True)


def concatenate_scenes(scene_videos: list, final_output: Path, work_dir: Path):
    """Concatenates individual scene videos into one cohesive MP4."""
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


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else "The Lost Library of Alexandria"
    voice = "en-US-ChristopherNeural"  # Professional documentary narrator
    work_dir = Path("./output")
    work_dir.mkdir(exist_ok=True)

    print("=" * 60)
    print("🎬 ZERO-COST FACELLES VIDEO GENERATOR")
    print(f"Topic: {topic}")
    print(f"Voice: {voice} (Microsoft Edge Neural)")
    print("=" * 60)

    # 1. Script Generation
    scenes = generate_script(topic)

    scene_videos = []

    # 2 & 3. Process each scene
    for i, sc in enumerate(scenes):
        idx = sc["scene_id"]
        print(f"\n--- Scene {idx}/{len(scenes)} ---")

        audio_path = work_dir / f"scene_{idx}.mp3"
        srt_path = work_dir / f"scene_{idx}.srt"
        img_path = work_dir / f"scene_{idx}.jpg"
        scene_video_path = work_dir / f"scene_{idx}.mp4"

        # Narration & Subtitles
        print(f"[2/4] 🎙️ Synthesizing voiceover with edge-tts...")
        asyncio.run(generate_speech_and_srt(sc["narration"], audio_path, srt_path, voice))
        duration = get_audio_duration(audio_path)
        print(f" -> Duration: {duration:.2f}s")

        # Visual Acquisition
        print(f"[3/4] 🎨 Fetching visual for scene {idx}...")
        fetch_scene_image(sc["search_query"], img_path, scene_index=i)

        # Video Rendering
        print(f"[4/4] ⚙️ Rendering scene video with Ken Burns zoom & captions...")
        render_scene(img_path, audio_path, srt_path, duration, scene_video_path)
        scene_videos.append(scene_video_path)

    # 4. Final Concatenation
    final_output = work_dir / "final_documentary.mp4"
    print(f"\n🎉 Stitching scenes into final video: {final_output}")
    concatenate_scenes(scene_videos, final_output, work_dir)

    print("\n" + "=" * 60)
    print(f"✅ SUCCESS! Final video rendered to: {final_output.resolve()}")
    print(f"File size: {final_output.stat().st_size / (1024*1024):.2f} MB")
    print("Cost to generate: $0.00")
    print("=" * 60)


if __name__ == "__main__":
    main()
