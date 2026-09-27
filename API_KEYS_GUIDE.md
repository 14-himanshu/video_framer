# 🔑 API Keys Guide + YouTube Clipper Implementation
**VideoFarm Studio — Complete Reference**

---

## Part 1 — What You Need Right Now vs Later

### ✅ Currently Working (Zero Keys Required)
| Feature | How | Cost |
|---|---|---|
| Script writing | Groq LLaMA 4 | Free (key already in .env) |
| Voiceover | edge-tts (Microsoft neural) | Free, no key |
| Images | Wikimedia Commons + Wikipedia + Openverse | Free, no key |
| AI Images | Pollinations.ai | Free, no key |
| Video render | FFmpeg local | Free |
| YouTube download | yt-dlp | Free |
| Transcription | Groq Whisper API | Free (same key) |
| Viral clip detection | Groq LLaMA (same key) | Free |

---

## Part 2 — API Keys You'll Need (Long Run)

### 🟢 Priority 1 — Get These First (All Free)

#### 1. Groq API Key ← YOU ALREADY HAVE THIS ✅
```
URL:    https://console.groq.com
Cost:   FREE forever (free tier is very generous)
Use:    Script writing + Transcription + Viral clip detection

Free Limits:
  LLM:     30,000 tokens/min, 14,400 requests/day
  Whisper: 2,000 transcriptions/day, 25MB per file

When to upgrade: When you have 500+ users hitting limits daily
Paid plan:       $0.27 per million tokens (very cheap)
```

#### 2. Pexels API Key (when their website works again)
```
URL:    https://www.pexels.com/api/
Cost:   FREE (commercial use included)
Use:    HD stock photos + video B-roll (better than Wikimedia for modern content)

Free Limits:
  200 requests/hour
  No monthly cap

How to get (step by step):
  1. Open Chrome (not Brave — Brave blocks their scripts)
  2. Go to pexels.com/api
  3. Click "Get Started"
  4. Sign up with email
  5. Copy API key → add to .env as: PEXELS_API_KEY=your_key

Add to .env:
  PEXELS_API_KEY=your_pexels_key_here
```

#### 3. Pixabay API Key (when their website works again)
```
URL:    https://pixabay.com/api/docs/
Cost:   FREE (commercial use included)
Use:    Background music (MP3s) + additional stock images

Free Limits:
  100 requests/minute (very generous)

How to get:
  1. Open Chrome
  2. Go to pixabay.com → Login/Register with email (skip Google login)
  3. Go to pixabay.com/api/docs
  4. Your key appears at the top of the page after login

Add to .env:
  PIXABAY_API_KEY=your_pixabay_key_here
```

> **Why both Pexels AND Pixabay?**
> Pexels = best for modern lifestyle/documentary photos and B-roll video clips  
> Pixabay = the ONLY free source for background music (MP3s, commercially licensed)

---

### 🟡 Priority 2 — Get When You Have 10+ Users

#### 4. ElevenLabs API Key
```
URL:    https://elevenlabs.io
Cost:   Free (10K chars/mo) → $6/mo (30K) → $22/mo (commercial license)
Use:    Ultra-realistic voices + voice cloning (sound like any person)

Why upgrade from edge-tts?
  edge-tts: Good quality, but limited voices, robotic on long sentences
  ElevenLabs: Human-indistinguishable, emotion control, 1000+ voices, clone any voice

Free tier:
  10,000 characters/month = ~5 minutes of audio
  NOT for commercial use (must pay for commercial license)

Paid ($22/mo):
  100,000 characters/month ≈ 50 minutes of audio/month
  Commercial use allowed
  API access

Add to .env:
  ELEVENLABS_API_KEY=your_key_here
```

#### 5. Google Gemini API Key
```
URL:    https://aistudio.google.com/app/apikey
Cost:   FREE (15 req/min, 1 million token context)
Use:    Backup LLM when Groq is down, better for long documents

Why useful?
  - 1 million token context = can feed entire book as context
  - Gemini Flash is very fast and free
  - Good fallback when Groq rate limits hit

Add to .env:
  GEMINI_API_KEY=your_key_here
```

---

### 🔴 Priority 3 — Get When You Start Charging Money

#### 6. Stripe API Keys
```
URL:    https://stripe.com
Cost:   FREE to set up, 2.9% + $0.30 per successful payment
Use:    Charging users (subscriptions, credits, one-time payments)

No monthly fees. You only pay when someone pays you.

Keys needed:
  STRIPE_SECRET_KEY=sk_live_...        (backend, never share)
  STRIPE_PUBLISHABLE_KEY=pk_live_...   (frontend, safe to share)
  STRIPE_WEBHOOK_SECRET=whsec_...      (for payment confirmations)

Test mode: Use sk_test_... and pk_test_... during development
```

#### 7. Supabase Keys (for user accounts + database)
```
URL:    https://supabase.com
Cost:   FREE (500MB DB, 50K monthly active users)
Use:    User authentication, storing job history, user settings

Keys needed:
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_ANON_KEY=your_anon_key    (safe for frontend)
  SUPABASE_SERVICE_KEY=your_key      (backend only, never share)

Free tier is plenty until you have 1000+ users.
```

#### 8. Cloudflare R2 (video storage)
```
URL:    https://cloudflare.com/products/r2
Cost:   FREE (10GB storage, 10M reads/month)
Use:    Store generated videos in cloud (instead of local disk)
        So users can access videos from any device

Keys needed:
  R2_ACCOUNT_ID=your_account_id
  R2_ACCESS_KEY_ID=your_key
  R2_SECRET_ACCESS_KEY=your_secret
  R2_BUCKET_NAME=videofarm-outputs
  R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

---

### ⚪ Priority 4 — Optional / Future

#### 9. Stability AI (better AI images)
```
URL:    https://platform.stability.ai
Cost:   $0.0065 per image (pay as you go, no subscription)
Use:    Higher quality AI-generated images than Pollinations
        Useful when Wikimedia/Wikipedia don't have good images for a topic

Add to .env:
  STABILITY_API_KEY=sk-your-key
```

#### 10. YouTube Data API v3
```
URL:    https://console.cloud.google.com
Cost:   FREE (10,000 units/day)
Use:    Auto-upload videos to YouTube, get video metadata
        Used by Channel.farm to auto-publish your videos

How to get:
  1. Google Cloud Console → Create Project
  2. Enable YouTube Data API v3
  3. Create credentials → API Key

Add to .env:
  YOUTUBE_API_KEY=AIza...
```

#### 11. OpenRouter (access 50+ models via 1 key)
```
URL:    https://openrouter.ai
Cost:   Free tier available + pay per use (very cheap)
Use:    Switch between Claude, GPT-4, Mistral without changing code
        Great if Groq goes down or you want better quality

Add to .env:
  OPENROUTER_API_KEY=sk-or-...
```

---

## Part 3 — Your Complete .env File (Right Now)

```bash
# ============================================================
# VideoFarm Studio — Environment Variables
# ============================================================
# Copy this to your .env file and fill in your keys

# ── REQUIRED ────────────────────────────────────────────────
# Get free key at: https://console.groq.com
GROQ_API_KEY=gsk_your_groq_key_here

# ── RECOMMENDED (free, just need registration) ──────────────
# Get at pexels.com/api (use Chrome, not Brave)
PEXELS_API_KEY=

# Get at pixabay.com/api/docs (needed for background music)
PIXABAY_API_KEY=

# ── ADD WHEN YOU HAVE USERS ─────────────────────────────────
ELEVENLABS_API_KEY=
GEMINI_API_KEY=

# ── ADD WHEN CHARGING MONEY ─────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=videofarm-outputs

# ── OPTIONAL / FUTURE ───────────────────────────────────────
STABILITY_API_KEY=
YOUTUBE_API_KEY=
OPENROUTER_API_KEY=
```

---

## Part 4 — YouTube Clipper: How It Works in This Project

### The Pipeline (5 Steps)

```
YouTube URL
    │
    ▼
[1] yt-dlp
    Downloads video to /output/clip_XXXX/video.mp4
    Format: best quality up to 1080p
    Cost: FREE, no key
    │
    ▼
[2] FFmpeg
    Extracts audio → 16kHz mono MP3 (compressed to stay under 25MB)
    Cost: FREE, local
    │
    ▼
[3] Groq Whisper API  ← uses your GROQ_API_KEY
    Sends MP3 → gets back full transcript WITH timestamps
    Returns: [{start: 12.3, end: 15.1, text: "The shocking truth..."}, ...]
    Cost: FREE (2000 requests/day limit)
    │
    ▼
[4] Groq LLaMA  ← same GROQ_API_KEY
    Analyzes transcript, finds the most viral 30-60s moment
    Returns: {start_time: 145.2, end_time: 198.7, title: "...", hook: "..."}
    Cost: FREE
    │
    ▼
[5] FFmpeg
    - Trims: keeps only start_time → end_time
    - Crops: center-crops to 9:16 (vertical)
    - Scales: to 720×1280 (YouTube Shorts standard)
    - Adds title text overlay at bottom
    Output: video_id_short.mp4
    Cost: FREE, local
```

### Where Each File Lives in the Project

```
video_farm/
├── backend/
│   ├── youtube_clipper.py    ← The clipper logic (just rewrote this)
│   │   ├── download_youtube_video()   Step 1
│   │   ├── extract_audio()            Step 2
│   │   ├── transcribe_with_groq()     Step 3
│   │   ├── find_viral_moment()        Step 4
│   │   ├── render_vertical_clip()     Step 5
│   │   └── YouTubeClipper.process()  Orchestrates all steps
│   │
│   └── app.py
│       ├── POST /api/clip-youtube     ← API endpoint (already wired)
│       └── run_clipper_worker()       ← Runs clipper in background thread
│
├── frontend/src/app/page.tsx
│   └── Clipper tab                    ← UI already exists
│
└── output/
    └── clip_XXXX/
        ├── video_id.mp4               Raw downloaded video
        ├── audio_for_transcription.mp3  Audio sent to Whisper
        └── video_id_short.mp4         Final 9:16 clip ← RESULT
```

### How to Test the Clipper Right Now

First, make sure your backend is running:
```bash
cd /Users/himanshupandey/Desktop/video_farm
source .venv/bin/activate
python app.py
```

Then test via terminal:
```bash
# Direct Python test
python backend/youtube_clipper.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Or via API (if backend is running on port 8000)
curl -X POST http://localhost:8000/api/clip-youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=YOUR_VIDEO_ID"}'

# Then check progress
curl http://localhost:8000/api/job/clip_XXXX
```

Or just use the **Clipper tab** in the UI at http://localhost:3000

### What the Output Looks Like

```
Input:  60-minute podcast (1080p, 2.1GB)
Output: 45-second vertical clip (720×1280, 12MB)

Clip has:
  ✅ Best segment (AI-selected for virality)
  ✅ 9:16 aspect ratio (ready for TikTok/Shorts/Reels)
  ✅ Title text burned in at bottom
  ✅ Original audio quality preserved

Total time: ~3–5 minutes for a 1-hour video
Cost: $0
```

### Current Limitations + Future Upgrades

| Current | Upgrade |
|---|---|
| Center-crop (static) | Face-tracking crop (MediaPipe, free) |
| Plain title text | Animated word-by-word captions |
| 1 clip per video | AI generates top 5 clips ranked by virality score |
| Manual URL input | Batch processing from a channel URL |
| No preview in browser | Video player in Clipper tab |

---

## Part 5 — Upgrade Sequence (When to Get Each Key)

```
TODAY:        Groq key only (already have it)
              → Full video generation ✅
              → YouTube clipper ✅
              → Zero cost

WEEK 1-2:     Add Pexels + Pixabay (free, just signup)
              → Better stock images
              → Background music support

MONTH 1:      Get 10 beta users
              → Add Gemini as Groq fallback
              → Start collecting feedback

MONTH 2-3:    First paying users
              → Add Stripe (only costs 2.9% per payment)
              → Add Supabase (user accounts, free tier)
              → Add ElevenLabs ($22/mo, offer as "Pro voices")

MONTH 6+:     Add Cloudflare R2 (video cloud storage)
              → Add YouTube API (auto-publish feature)
              → Add Stability AI (better AI images)
```

---

*The only key you NEED right now is Groq (already configured).*  
*Everything else is optional and adds value incrementally.*
