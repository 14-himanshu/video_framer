import os
import json
from pathlib import Path
import yt_dlp
import ffmpeg
from groq import Groq
import re

# Load env variables
from dotenv import load_dotenv
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class YouTubeClipper:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        if GROQ_API_KEY:
            self.groq_client = Groq(api_key=GROQ_API_KEY)
        else:
            self.groq_client = None

    def download_video(self, url: str) -> str:
        """Downloads the video from YouTube."""
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': str(self.output_dir / '%(id)s.%(ext)s'),
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return str(self.output_dir / f"{info['id']}.mp4"), info['id']

    def transcribe_video(self, video_path: str):
        """Transcribes video using faster-whisper (fallback to whisper if imported)."""
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, info = model.transcribe(video_path, word_timestamps=True)
        
        transcript_data = []
        full_text = ""
        for segment in segments:
            transcript_data.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })
            full_text += segment.text + " "
            
        return transcript_data, full_text

    def get_engaging_clip(self, transcript: str):
        """Uses Groq Llama 3 to find the most engaging segment."""
        if not self.groq_client:
            raise Exception("GROQ_API_KEY not set")

        prompt = f"""
        You are an expert content creator looking for viral moments in a video transcript.
        Find the most engaging, standalone 30-60 second segment from this transcript.
        Return ONLY a JSON object with this exact format, no other text:
        {{
            "start_time_seconds": number,
            "end_time_seconds": number,
            "title": "A catchy title for the short",
            "reasoning": "Why this is engaging"
        }}
        
        Transcript:
        {transcript[:20000]} # Limit length to fit in context
        """
        
        response = self.groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-70b-versatile",
            temperature=0.2
        )
        
        try:
            content = response.choices[0].message.content
            # Extract JSON if wrapped in markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            return json.loads(content)
        except Exception as e:
            print("Failed to parse Groq response:", response.choices[0].message.content)
            # Fallback
            return {
                "start_time_seconds": 0,
                "end_time_seconds": 60,
                "title": "Highlight Clip",
                "reasoning": "Fallback due to parse error"
            }

    def crop_and_clip(self, video_path: str, start: float, end: float, output_path: str):
        """Clips video and crops to 9:16 (vertical). For simplicity, center crops."""
        # A more advanced version would use MediaPipe to track the face
        # For MVP, we will use a center crop to 9:16 aspect ratio.
        
        # Using ffmpeg-python
        try:
            probe = ffmpeg.probe(video_path)
            video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
            width = int(video_stream['width'])
            height = int(video_stream['height'])
            
            # Calculate target dimensions for 9:16
            target_width = int(height * (9 / 16))
            crop_x = int((width - target_width) / 2)
            
            stream = ffmpeg.input(video_path, ss=start, t=end-start)
            video = stream.video.crop(x=crop_x, y=0, width=target_width, height=height)
            audio = stream.audio
            
            ffmpeg.output(video, audio, output_path).overwrite_output().run(capture_stdout=True, capture_stderr=True)
            return True
        except ffmpeg.Error as e:
            print('ffmpeg error:', e.stderr.decode('utf8'))
            return False

    def process(self, url: str) -> dict:
        video_path, video_id = self.download_video(url)
        print(f"Downloaded video to {video_path}")
        
        transcript_data, full_text = self.transcribe_video(video_path)
        print("Transcription complete.")
        
        clip_info = self.get_engaging_clip(full_text)
        print(f"Selected clip: {clip_info}")
        
        start_time = clip_info.get("start_time_seconds", 0)
        end_time = clip_info.get("end_time_seconds", 60)
        
        final_clip_name = f"{video_id}_short.mp4"
        final_clip_path = str(self.output_dir / final_clip_name)
        
        success = self.crop_and_clip(video_path, start_time, end_time, final_clip_path)
        
        if success:
            return {
                "status": "success",
                "file_name": final_clip_name,
                "title": clip_info.get("title"),
                "reasoning": clip_info.get("reasoning")
            }
        else:
            return {"status": "error", "message": "Failed to crop video"}

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        clipper = YouTubeClipper(Path("./output"))
        print(clipper.process(sys.argv[1]))
