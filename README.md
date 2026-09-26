# 🎬 VideoFarm AI Studio: Autonomous Video Generation Infrastructure

A 100% free, production-ready web application and autonomous media engine inspired by [Channel Farm](https://channel.farm/) that transforms any topic into complete documentary-style videos (**16:9 Long-Form**) or viral social clips (**9:16 Shorts/Reels/TikTok**) at **$0.00** operational cost.

---

## ⚡ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: FastAPI (Python 3.12+), Uvicorn, Server-Sent Events (SSE)
- **AI Brain / Scriptwriter**: Groq Cloud LLMs (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, Llama 3.3)
- **Neural Voice Synthesis**: Microsoft Edge Neural TTS (`edge-tts`) with real-time audio previews
- **Visual Pipeline**: Real-time topic search via DuckDuckGo Images + Wikipedia REST HD Media + Openverse + Procedural FFmpeg backdrops
- **Compositing & Video Engine**: FFmpeg (Ken Burns panning/zooming, subtitles, word-level audio sync)

---

## 🚀 Key Features

1. **Dual Format Architecture**:
   - **16:9 Landscape**: High-retention cinematic documentary format with smooth camera motion and subtitle styling.
   - **9:16 Portrait**: High-impact vertical format for YouTube Shorts, Instagram Reels, and TikTok.

2. **Director's Control Deck**:
   - Custom topic input with 1-click viral niche presets (Cosmology, History, Psychology, Space, Nature).
   - Voice Cast Matrix featuring 8 neural narrators (US, UK, Australian, Indian) with **live in-browser audio preview buttons**.

3. **Multi-Track Live Pipeline Visualizer**:
   - Real-time progress tracking for Neural Speech, Dynamic Visual Sourcing, and Ken Burns Motion Rendering via SSE streams.
   - Live terminal log monitor.

4. **Storyboard Scene Director**:
   - Scene-by-scene script and prompt editor.
   - **1-Click Visual Swap**: Regenerate or cycle distinct topic-specific photography for individual scenes before final compilation.

5. **YouTube & Social Launchpad**:
   - Instant 1-click copy for AI-generated SEO Titles, Descriptions, and Hashtags.
   - Direct MP4 video download.

---

## 🏃 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- FFmpeg installed (`brew install ffmpeg` on macOS)
- Free Groq API Key (from [console.groq.com](https://console.groq.com))

### 2. Backend Setup

```bash
# Clone the repository
git clone https://github.com/14-himanshu/video_framer.git
cd video_framer

# Create virtual environment & install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure your Groq API Key
cp .env.example .env
# Edit .env and paste your GROQ_API_KEY=gsk_...

# Start the FastAPI engine
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```
* Backend API & Swagger Docs will be live at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup (Next.js)

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
* Open **[http://localhost:3000](http://localhost:3000)** in your browser.
* All `/api/*` and `/output/*` requests are automatically proxied to the FastAPI server.

---

## 📁 Repository Structure

```
video_framer/
├── app.py                   # FastAPI server & async job orchestrator
├── video_engine.py          # Video pipeline (Groq, Edge-TTS, DDG/Wikipedia, FFmpeg)
├── generator.py             # Standalone CLI video generator
├── requirements.txt         # Python dependencies
├── .env.example             # Example environment file
├── .gitignore               # Ignored secrets, virtualenvs, & builds
│
├── frontend/                # Next.js 16 Pro Studio Frontend
│   ├── src/app/
│   │   ├── layout.tsx       # Root layout & Google Fonts
│   │   ├── page.tsx         # Studio Canvas, Storyboard, Archive, Guide
│   │   └── globals.css      # Dark luxury design system & animations
│   ├── next.config.ts       # Reverse proxy to FastAPI (:8000)
│   ├── package.json         # React 19, Lucide, Tailwind dependencies
│   └── tsconfig.json        # TypeScript configuration
│
├── static/                  # Lightweight standalone HTML fallback
└── output/                  # Generated video artifacts & audio clips
```

---

## 💼 Commercial Monetization Models

1. **Faceless YouTube/TikTok Automation**: Generate 3-5 daily viral shorts in high-CPM niches (Finance, History, Tech).
2. **SaaS Subscription Platform**: Offer monthly video generation tiers ($29 - $99/mo) with custom branding and watermark removal.
3. **Agency Content Engine**: White-label video generation service for marketing clients, podcasts, and educators.
4. **B2B API Service**: Charge developers per render using Stripe and API rate limiting.

---

## 📄 License
MIT License. Built for autonomous video creation and high-velocity storytelling.
