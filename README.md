# 🎬 VideoFarm AI Studio: Autonomous Video Generation Infrastructure

A 100% free, production-ready web service and autonomous media engine inspired by [Channel Farm](https://channel.farm/) that transforms any topic into complete documentary-style videos (**16:9 Long-Form**) or viral social clips (**9:16 Shorts/Reels/TikTok**) at **$0.00** operational cost.

---

## ⚡ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide Icons
- **Backend**: FastAPI (Python 3.12+), Uvicorn, Server-Sent Events (SSE)
- **AI Brain / Scriptwriter**: Groq Cloud LLMs (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, Llama 3.3)
- **Neural Voice Synthesis**: Microsoft Edge Neural TTS (`edge-tts`) with real-time audio previews
- **Visual Pipeline**: Real-time topic search via DuckDuckGo Images + Wikipedia REST HD Media + Openverse + Procedural FFmpeg backdrops
- **Compositing & Video Engine**: FFmpeg (Ken Burns panning/zooming, subtitles, word-level audio sync)
- **Deployment**: Docker, Docker Compose, Vercel ready

---

## 📁 Clean Repository Structure

```
video_framer/
├── backend/                 # Python FastAPI Engine & Video Pipeline
│   ├── app.py               # REST API endpoints & SSE event streams
│   ├── video_engine.py      # Core rendering engine (Groq, TTS, DDG/Wiki, FFmpeg)
│   ├── generator.py         # Standalone CLI batch generator
│   ├── static/              # Lightweight standalone HTML fallback
│   ├── requirements.txt     # Python backend dependencies
│   └── Dockerfile           # Production container for backend + FFmpeg
│
├── frontend/                # Next.js 16 Pro SaaS Studio Frontend
│   ├── src/app/
│   │   ├── layout.tsx       # Root layout & Google Fonts
│   │   ├── page.tsx         # Studio Canvas, Storyboard, Archive, Guide
│   │   └── globals.css      # Dark luxury design system & animations
│   ├── next.config.ts       # Reverse proxy with dynamic BACKEND_URL
│   ├── package.json         # React 19, Lucide, Tailwind dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   └── Dockerfile           # Multi-stage production container for Next.js
│
├── output/                  # Rendered video outputs & audio clips (gitignored)
│   └── .gitkeep
├── docker-compose.yml       # 1-command local & cloud fullstack deployment
├── app.py                   # Root entrypoint proxy (for uvicorn app:app)
├── requirements.txt         # Root Python requirements
├── .env.example             # Configuration template
└── .gitignore               # Comprehensive exclusion rules
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- FFmpeg installed (`brew install ffmpeg` on macOS, or `apt-get install ffmpeg` on Ubuntu)
- Free Groq API Key (get one at [console.groq.com](https://console.groq.com))

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and paste your GROQ_API_KEY=gsk_...
```

### 3. Start Backend (Terminal 1)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Start FastAPI Engine
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```
* API & Interactive Swagger Docs: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

### 4. Start Next.js Studio Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
* Studio UI: **[http://localhost:3000](http://localhost:3000)**

---

## 🐳 1-Command Deployment (Docker Compose)

Deploy both the FastAPI backend and Next.js frontend in production containers with one command:

```bash
docker compose up --build -d
```

- **Frontend Studio**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- Output videos persist in `./output` on your host machine.

---

## 🧪 Build & Lint Verification

Both frontend and backend are verified clean:

```bash
# Frontend Lint & Production Build
cd frontend
npm run lint    # 0 errors, 0 warnings
npm run build   # Compiled successfully

# Backend Type & Syntax Compilation
cd ..
python3 -m py_compile backend/app.py backend/video_engine.py backend/generator.py app.py
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
