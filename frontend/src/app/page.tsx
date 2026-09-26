"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Film,
  Sparkles,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Tv,
  Smartphone,
  Layers,
  Settings,
  DollarSign,
  Video,
  Flame,
  Volume2,
  Scissors
} from "lucide-react";

interface Voice {
  id: string;
  name: string;
  gender: string;
  tone: string;
  lang: string;
  avatar?: string;
}

interface Scene {
  scene_id: number;
  narration: string;
  image_prompt?: string;
  search_query?: string;
  preview_image?: string;
}

interface ScriptData {
  title: string;
  description: string;
  tags: string[];
  scenes: Scene[];
}

interface Job {
  job_id: string;
  topic: string;
  title?: string;
  description?: string;
  tags?: string[];
  format: string;
  voice?: string;
  status: string;
  progress: number;
  step?: string;
  video_url?: string;
  file_size_mb?: number;
  created_at?: string;
  logs?: string[];
}

export default function VideoFarmStudio() {
  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<"studio" | "storyboard" | "gallery" | "monetization" | "settings" | "clipper">("studio");

  // Clipper State
  const [clipperUrl, setClipperUrl] = useState("");

  // Studio Form State
  const [topic, setTopic] = useState("The Secrets of Black Holes");
  const [aspectFormat, setAspectFormat] = useState<"long" | "short">("long");
  const [selectedVoice, setSelectedVoice] = useState("en-US-ChristopherNeural");
  const [visualEngine, setVisualEngine] = useState("auto");
  const [scenesCount, setScenesCount] = useState(3);

  // Data & Media State
  const [voices, setVoices] = useState<Voice[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<ScriptData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);

  // Live Rendering State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStep, setRenderStep] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // UI Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [systemOnline, setSystemOnline] = useState(true);

  // Audio & EventSource Refs
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const swapCounterRef = useRef<number>(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch (e) {
      console.error("Gallery fetch failed:", e);
    }
  }, []);

  // Fetch initial system status, voices, and job gallery
  useEffect(() => {
    let ignore = false;

    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        if (!ignore && data.status === "online") setSystemOnline(true);
      })
      .catch(() => {
        if (!ignore) setSystemOnline(false);
      });

    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (!ignore && data.voices) setVoices(data.voices);
      })
      .catch((e) => console.error("Error fetching voices:", e));

    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (!ignore && data.jobs) setJobs(data.jobs);
      })
      .catch((e) => console.error("Gallery fetch failed:", e));

    return () => {
      ignore = true;
    };
  }, []);

  // Autoscroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Voice Preview Player
  const toggleVoicePreview = (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioPreviewRef.current) return;

    if (playingVoiceId === voiceId && !audioPreviewRef.current.paused) {
      audioPreviewRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }

    audioPreviewRef.current.src = `/api/voice-preview/${voiceId}`;
    setPlayingVoiceId(voiceId);
    audioPreviewRef.current.play().catch(() => setPlayingVoiceId(null));
    audioPreviewRef.current.onended = () => setPlayingVoiceId(null);
  };

  // Copy Helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate Script Preview (Storyboard)
  const handleGenerateScript = async () => {
    if (!topic.trim()) {
      showToast("Please enter a topic first!");
      return;
    }
    showToast("Directing AI script with Groq...");
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, format: aspectFormat, num_scenes: scenesCount })
      });
      const data = await res.json();
      if (data.success && data.script) {
        setStoryboard(data.script);
        setActiveTab("storyboard");
        showToast("Script ready! Review your storyboard below.");
      }
    } catch {
      showToast("Script generation failed");
    }
  };

  // Launch Video Rendering
  const handleStartRender = async (fromStoryboard = false) => {
    if (!topic.trim()) {
      showToast("Please enter a topic first!");
      return;
    }

    setActiveTab("studio");
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStep("Initializing Production Pipeline...");
    setTerminalLogs([`[${new Date().toLocaleTimeString()}] Pipeline queued for execution...`]);
    setCurrentJob(null);

    const scriptToSend = fromStoryboard ? storyboard : null;

    try {
      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          format: aspectFormat,
          num_scenes: scenesCount,
          voice: selectedVoice,
          visual_source: visualEngine,
          script: scriptToSend
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail || "Failed to start render");

      listenToStream(data.job_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start render";
      showToast(`Error: ${msg}`);
      setIsRendering(false);
    }
  };

  const handleClipYouTube = async () => {
    if (!clipperUrl.trim()) {
      showToast("Please enter a YouTube URL!");
      return;
    }
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStep("Queueing Clipper...");
    setTerminalLogs([`[${new Date().toLocaleTimeString()}] Clip queued...`]);
    try {
      const res = await fetch("/api/clip-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clipperUrl })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail);
      setActiveTab("studio");
      listenToStream(data.job_id);
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
      setIsRendering(false);
    }
  };

  // Stream Server-Sent Events
  const listenToStream = (jobId: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource(`/api/stream/${jobId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setRenderProgress(data.progress || 0);
        if (data.step) setRenderStep(data.step);

        if (data.new_logs && data.new_logs.length > 0) {
          setTerminalLogs((prev) => [...prev, ...data.new_logs]);
        }

        if (data.status === "completed") {
          es.close();
          setIsRendering(false);
          showToast("🎉 Video successfully rendered!");
          fetchCompletedJob(jobId);
          fetchGallery();
        } else if (data.status === "failed") {
          es.close();
          setIsRendering(false);
          showToast(`Render failed: ${data.error}`);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    es.onerror = () => {
      fetch(`/api/job/${jobId}`)
        .then((r) => r.json())
        .then((job) => {
          if (job.status === "completed") {
            es.close();
            setIsRendering(false);
            fetchCompletedJob(jobId);
            fetchGallery();
          }
        });
    };
  };

  const fetchCompletedJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/job/${jobId}`);
      const data = await res.json();
      setCurrentJob(data);
    } catch (e) {
      console.error("Failed to load completed job:", e);
    }
  };

  // Swap Scene Visual
  const handleRegenerateSceneVisual = useCallback(
    async (idx: number) => {
      if (!storyboard) return;
      const sc = storyboard.scenes[idx];
      showToast(`Sourcing new image for Scene ${idx + 1}...`);

      const offset = ((swapCounterRef.current++) % 5) + 1;
      try {
        const res = await fetch("/api/generate-scene-visual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: sc.search_query || topic,
            prompt: sc.image_prompt,
            is_vertical: aspectFormat === "short",
            source: visualEngine,
            scene_index: idx + offset,
            topic
          })
        });
        const data = await res.json();
        if (data.success && data.image_url) {
          setStoryboard((prev) => {
            if (!prev) return prev;
            const updatedScenes = [...prev.scenes];
            updatedScenes[idx] = { ...updatedScenes[idx], preview_image: data.image_url };
            return { ...prev, scenes: updatedScenes };
          });
          showToast(`Scene ${idx + 1} visual updated!`);
        }
      } catch {
        showToast("Could not refresh image");
      }
    },
    [storyboard, topic, aspectFormat, visualEngine]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans">
      {/* Hidden Audio Element for Voice Previews */}
      <audio ref={audioPreviewRef} className="hidden" preload="none" />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-800 text-white px-5 py-3 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-3 animate-fade-in text-sm font-medium">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================
          TOP APP HEADER
          ============================================================ */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm text-white font-bold">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg tracking-tight text-white bg-clip-text text-transparent">
                VideoFarm
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-indigo-400 border border-zinc-800">
                Next.js Pro
              </span>
            </div>
            <p className="text-xs text-zinc-400">AI Video Generation Platform</p>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <nav className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("studio")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "studio"
                ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Studio Canvas</span>
          </button>

          <button
            onClick={() => {
              if (!storyboard) handleGenerateScript();
              else setActiveTab("storyboard");
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "storyboard"
                ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Storyboard</span>
          </button>

          <button
            onClick={() => setActiveTab("gallery")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "gallery"
                ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Archive</span>
            <span className="bg-white/10 px-1.5 py-0.2 rounded-full text-[10px]">{jobs.length}</span>
          </button>

          <button
            onClick={() => setActiveTab("monetization")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "monetization"
                ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Monetization & Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "settings"
                ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setActiveTab("clipper")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "clipper"
                ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>YouTube Clipper</span>
          </button>
        </nav>

        {/* Engine Status Badge */}
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 " />
          <span>{systemOnline ? "Engine Online" : "Connecting..."}</span>
        </div>
      </header>

      {/* ============================================================
          TAB 1: STUDIO CANVAS WORKSTATION
          ============================================================ */}
      {activeTab === "studio" && (
        <main className="max-w-[1600px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-6 items-start">
          {/* Left Column: Project Settings */}
          <aside className="bg-zinc-900 backdrop-blur-2xl border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Director&apos;s Control Deck</span>
              </h2>
              <span className="text-[11px] font-mono text-zinc-300 bg-zinc-800 border border-zinc-800 px-2 py-0.5 rounded-full">
                Free Tier
              </span>
            </div>

            {/* 1. Topic Search Bar & Niche Chips */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Documentary Topic or Idea
              </label>
              <div className="relative">
                <Flame className="w-4 h-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., The Secret of Roman Concrete..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  "The Secrets of Black Holes",
                  "Why Did Rome Fall",
                  "The Ancient Pyramids of Giza",
                  "1% Psychology of Money",
                  "James Webb Discoveries",
                  "Deep Sea Trench Monsters"
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setTopic(preset);
                      showToast(`Topic loaded: ${preset}`);
                    }}
                    className="text-xs bg-white/5 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-800 text-zinc-200 hover:text-white px-2.5 py-1 rounded-full transition-all"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Target Platform & Aspect Ratio Switcher */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Format & Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAspectFormat("long")}
                  className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                    aspectFormat === "long"
                      ? "bg-zinc-800 border-indigo-500 shadow-sm text-white"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${aspectFormat === "long" ? "bg-indigo-600 text-white" : "bg-white/5"}`}>
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">16:9 Landscape</div>
                    <div className="text-[11px] text-zinc-400">YouTube Long-Form (720p)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectFormat("short")}
                  className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                    aspectFormat === "short"
                      ? "bg-zinc-800 border-indigo-500 shadow-sm text-white"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${aspectFormat === "short" ? "bg-indigo-600 text-white" : "bg-white/5"}`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">9:16 Vertical</div>
                    <div className="text-[11px] text-zinc-400">Shorts / Reels / TikTok</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Narrator Voice Matrix (With Audio Preview!) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Voiceover
                </label>
                <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Click ▶ for audio preview
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {voices.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      selectedVoice === v.id
                        ? "bg-zinc-800 border-indigo-500 text-white shadow-sm"
                        : "bg-zinc-900 border-zinc-800 hover:bg-white/5 text-zinc-200"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        <span>{v.avatar || "🎙️"}</span>
                        <span>{v.name}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">{v.tone}</div>
                    </div>
                    <button
                      onClick={(e) => toggleVoicePreview(v.id, e)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-transform ${
                        playingVoiceId === v.id
                          ? "bg-cyan-400 text-black scale-110 shadow-lg shadow-cyan-400/50"
                          : "bg-white/10 hover:bg-indigo-600 text-white"
                      }`}
                      title="Play Voice Sample"
                    >
                      {playingVoiceId === v.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Visual Engine & Pacing Slider */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Visual Engine
              </label>
              <select
                value={visualEngine}
                onChange={(e) => setVisualEngine(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="auto">🌐 Real-Time Web Topic Search (DuckDuckGo + Wikipedia HD)</option>
                <option value="ai">🎨 AI Art Generation (Pollinations Turbo with Web Fallback)</option>
                <option value="wikimedia">🏛️ Historical Public Domain Archives (Openverse)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Scene Count & Duration
                </label>
                <span className="font-mono text-xs text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-800">
                  {scenesCount} Scenes (~{scenesCount * (aspectFormat === "short" ? 8 : 12)}s)
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={6}
                value={scenesCount}
                onChange={(e) => setScenesCount(parseInt(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                disabled={isRendering}
                onClick={() => handleStartRender(false)}
                className="py-3 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-white font-bold text-xs tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Video</span>
              </button>

              <button
                disabled={isRendering}
                onClick={handleGenerateScript}
                className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-zinc-800 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                <span>Edit Script First</span>
              </button>
            </div>
          </aside>

          {/* Right Column: Cinema Monitor & Live Pipeline */}
          <section className="flex flex-col gap-6">
            {/* Cinema Monitor */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl relative">
              <div
                className={`w-full flex items-center justify-center relative transition-all ${
                  aspectFormat === "long"
                    ? "aspect-video"
                    : "aspect-[9/16] max-h-[580px] max-w-[340px] mx-auto my-6 rounded-2xl overflow-hidden shadow-xl border border-zinc-800"
                }`}
              >
                {/* Standby Empty View */}
                {!currentJob?.video_url && !isRendering && (
                  <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-800 flex items-center justify-center text-3xl mx-auto mb-4 ">
                      🎬
                    </div>
                    <h3 className="font-semibold text-base mb-1.5">Preview Window</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Enter a topic on the left and click <strong>Generate Video</strong>. The engine will write an AI script, synthesize neural speech, source HD photos, and render Ken Burns motion clips.
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-6 text-left">
                      <div className="bg-white/5 p-2.5 rounded-xl border border-zinc-800">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Speed</div>
                        <div className="text-xs font-bold text-zinc-300 font-mono">~30 sec</div>
                      </div>
                      <div className="bg-white/5 p-2.5 rounded-xl border border-zinc-800">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Cost</div>
                        <div className="text-xs font-bold text-emerald-400 font-mono">$0.00</div>
                      </div>
                      <div className="bg-white/5 p-2.5 rounded-xl border border-zinc-800">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Quality</div>
                        <div className="text-xs font-bold text-indigo-400 font-mono">HD 30 FPS</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Video Player */}
                {currentJob?.video_url && (
                  <video
                    src={`${currentJob.video_url}?id=${currentJob.job_id}`}
                    controls
                    autoPlay
                    className="w-full h-full object-cover block"
                  />
                )}
              </div>
            </div>

            {/* Live Multi-Track Pipeline Visualizer (Shown while rendering) */}
            {isRendering && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5 text-zinc-300 font-bold text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 " />
                    <span>{renderStep}</span>
                  </div>
                  <span className="font-mono text-lg font-semibold text-white">{renderProgress}%</span>
                </div>

                {/* Multi-Track Progress Visualizer */}
                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-200 font-semibold mb-1">
                      <span>Audio & Transcription</span>
                      <span className="font-mono text-zinc-300">{Math.min(100, renderProgress * 2.5)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, renderProgress * 2.5)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-200 font-semibold mb-1">
                      <span>Media Sourcing</span>
                      <span className="font-mono text-zinc-300">
                        {renderProgress > 30 ? Math.min(100, (renderProgress - 30) * 2.5) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${renderProgress > 30 ? Math.min(100, (renderProgress - 30) * 2.5) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-200 font-semibold mb-1">
                      <span>Video Compositing</span>
                      <span className="font-mono text-zinc-300">
                        {renderProgress > 65 ? Math.min(100, (renderProgress - 65) * 3) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${renderProgress > 65 ? Math.min(100, (renderProgress - 65) * 3) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Streaming Terminal Dock */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 font-mono text-xs text-zinc-300 h-36 overflow-y-auto leading-relaxed">
                  {terminalLogs.map((log, i) => (
                    <div key={i} className="mb-1">
                      {log}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            )}

            {/* YouTube & Social Media Launchpad */}
            {currentJob?.video_url && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base text-white">🚀 YouTube & Social Media Launchpad</h3>
                    <p className="text-xs text-zinc-400">Pre-optimized title, description, and tags ready for copy-paste.</p>
                  </div>
                  <a
                    href={currentJob.video_url}
                    download="documentary.mp4"
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP4</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
                    <div className="flex justify-between items-center text-[11px] font-bold uppercase text-zinc-400 mb-1.5">
                      <span>Title</span>
                      <button
                        onClick={() => handleCopy(currentJob.title || currentJob.topic, "title")}
                        className="text-zinc-300 hover:text-zinc-300 flex items-center gap-1"
                      >
                        {copiedKey === "title" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="text-xs text-white line-clamp-3">{currentJob.title || currentJob.topic}</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
                    <div className="flex justify-between items-center text-[11px] font-bold uppercase text-zinc-400 mb-1.5">
                      <span>Description</span>
                      <button
                        onClick={() => handleCopy(currentJob.description || "", "desc")}
                        className="text-zinc-300 hover:text-zinc-300 flex items-center gap-1"
                      >
                        {copiedKey === "desc" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="text-xs text-zinc-200 line-clamp-3">{currentJob.description || "N/A"}</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
                    <div className="flex justify-between items-center text-[11px] font-bold uppercase text-zinc-400 mb-1.5">
                      <span>Tags</span>
                      <button
                        onClick={() => handleCopy((currentJob.tags || []).join(", "), "tags")}
                        className="text-zinc-300 hover:text-zinc-300 flex items-center gap-1"
                      >
                        {copiedKey === "tags" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="text-xs text-zinc-200 line-clamp-3">{(currentJob.tags || []).join(", ") || "N/A"}</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ============================================================
          TAB 2: VISUAL STORYBOARD & SCENE EDITOR
          ============================================================ */}
      {activeTab === "storyboard" && storyboard && (
        <section className="max-w-[1200px] w-full mx-auto px-6 py-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-2xl font-bold">🎞️ Visual Storyboard & Scene Director</h2>
              <p className="text-xs text-zinc-400">
                Customize narration lines, tweak image search queries, and swap scene visuals before compositing.
              </p>
            </div>
            <button
              onClick={() => handleStartRender(true)}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs tracking-wide shadow-sm flex items-center gap-2 hover:scale-[1.02] transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Render Video with This Storyboard</span>
            </button>
          </div>

          {/* Title & Description Edit */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Suggested Video Title</label>
              <input
                type="text"
                value={storyboard.title}
                onChange={(e) => setStoryboard({ ...storyboard, title: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">SEO Description</label>
              <input
                type="text"
                value={storyboard.description}
                onChange={(e) => setStoryboard({ ...storyboard, description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
          </div>

          {/* Scene Cards */}
          <div className="space-y-4">
            {storyboard.scenes.map((sc, idx) => (
              <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 items-center">
                {/* Visual Thumbnail */}
                <div className={`relative bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 ${aspectFormat === "short" ? "aspect-[9/16] max-h-52" : "aspect-video"}`}>
                  <img
                    src={sc.preview_image || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=250&fit=crop"}
                    alt={`Scene ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRegenerateSceneVisual(idx)}
                    className="absolute bottom-2 right-2 bg-zinc-950/80 hover:bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-md border border-zinc-800 transition-all flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Swap</span>
                  </button>
                </div>

                {/* Narration & Prompts */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      🎬 Scene {sc.scene_id || idx + 1}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      ~{Math.max(4, Math.round((sc.narration || "").split(" ").length / 2.5))}s spoken
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                      Narration Voiceover (Spoken Script)
                    </label>
                    <textarea
                      rows={2}
                      value={sc.narration}
                      onChange={(e) => {
                        const updated = [...storyboard.scenes];
                        updated[idx].narration = e.target.value;
                        setStoryboard({ ...storyboard, scenes: updated });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Visual Keywords</label>
                      <input
                        type="text"
                        value={sc.search_query || ""}
                        onChange={(e) => {
                          const updated = [...storyboard.scenes];
                          updated[idx].search_query = e.target.value;
                          setStoryboard({ ...storyboard, scenes: updated });
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">AI Prompt</label>
                      <input
                        type="text"
                        value={sc.image_prompt || ""}
                        onChange={(e) => {
                          const updated = [...storyboard.scenes];
                          updated[idx].image_prompt = e.target.value;
                          setStoryboard({ ...storyboard, scenes: updated });
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 3: VIDEO ARCHIVE & LIBRARY
          ============================================================ */}
      {activeTab === "gallery" && (
        <section className="max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-2xl font-bold">📁 Video Archive & Vault</h2>
              <p className="text-xs text-zinc-400">All MP4 videos rendered and stored locally on your machine.</p>
            </div>
            <button
              onClick={fetchGallery}
              className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-zinc-800 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Vault</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((j) => (
              <div key={j.job_id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl hover:border-indigo-500/50 transition-all flex flex-col">
                <div className={`bg-zinc-950 ${j.format === "short" ? "aspect-[9/16] max-h-[380px]" : "aspect-video"}`}>
                  <video src={j.video_url} controls className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white truncate mb-1">{j.title || j.topic}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-3">
                      <span>{j.format === "short" ? "📱 9:16 Short" : "🖥️ 16:9 Cinema"}</span>
                      <span>•</span>
                      <span>{j.file_size_mb || "2"} MB</span>
                      <span>•</span>
                      <span>{j.created_at || "Recent"}</span>
                    </div>
                  </div>
                  <a
                    href={j.video_url}
                    download="video.mp4"
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-indigo-600 text-white text-xs font-bold text-center border border-zinc-800 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 4: MONETIZATION & ARCHITECTURE GUIDE
          ============================================================ */}
      {activeTab === "monetization" && (
        <section className="max-w-[1000px] w-full mx-auto px-6 py-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl space-y-6 leading-relaxed">
            <h2 className="text-2xl font-bold text-white">
              💡 How Channel Farm Works & How to Monetize Your Platform
            </h2>

            <div className="space-y-4 text-xs text-zinc-200">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">1. The Faceless YouTube Business Model</h3>
              <p>
                Platforms like <strong>Channel Farm</strong> cater to creators who publish high-volume faceless documentaries across YouTube, TikTok, and Instagram Reels.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                <li><strong>Channel Farm Pricing:</strong> $49/mo (approx. 6 videos) up to $699/mo (for 20 channels).</li>
                <li><strong>High-RPM Niches:</strong> Ancient History, Space Science, Tech, and Finance make <strong>$6 – $20 per 1,000 views</strong> on YouTube AdSense.</li>
                <li><strong>Compute Cost:</strong> Groq + Edge-TTS + local FFmpeg costs <strong>less than $0.20 per video</strong>, leaving <strong>85%+ gross profit margins</strong>.</li>
              </ul>

              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider pt-4">2. The Two Monetization Pathways for You</h3>
              <ol className="list-decimal pl-5 space-y-2 text-zinc-400">
                <li>
                  <strong className="text-white">Run Your Own Automated Channels:</strong> Publish 1 video per day in niches like Ancient Mysteries or Space. A channel doing 500k monthly views earns <strong>$3,000 – $8,000/month</strong> purely from AdSense.
                </li>
                <li>
                  <strong className="text-white">Deploy This as a Paid SaaS:</strong> Add Stripe Checkout + Supabase Auth in front of this Next.js app, host the FastAPI worker on a $10 VPS, and charge creators $29/month for 15 videos.
                </li>
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 5: SETTINGS & SYSTEM CONFIGURATION
          ============================================================ */}
      {activeTab === "settings" && (
        <section className="max-w-[700px] w-full mx-auto px-6 py-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white">⚙️ Studio System Configuration</h2>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Groq API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white"
                />
                <button
                  onClick={async () => {
                    if (!apiKeyInput.trim()) return;
                    const res = await fetch("/api/update-groq-key", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ groq_api_key: apiKeyInput })
                    });
                    const d = await res.json();
                    if (d.success) {
                      showToast("Groq API key updated!");
                      setApiKeyInput("");
                    }
                  }}
                  className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-600 text-white font-bold text-xs"
                >
                  Save Key
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                Your key is securely saved to <code>.env</code> on your local system.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 space-y-1 font-mono">
              <div>Next.js Frontend: Port 3000 (React 19 / App Router)</div>
              <div>FastAPI Engine: Port 8000 (Python 3.14)</div>
              <div>FFmpeg Binary: /opt/homebrew/bin/ffmpeg</div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 6: YOUTUBE CLIPPER
          ============================================================ */}
      {activeTab === "clipper" && (
        <section className="max-w-[800px] w-full mx-auto px-6 py-12">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
                <Scissors className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">YouTube AI Clipper</h2>
              <p className="text-sm text-zinc-400 mt-2">
                Paste a YouTube URL to automatically find the most engaging moments, transcribe, and convert into a 9:16 Short.
              </p>
            </div>
            
            <div className="mt-4">
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">YouTube URL</label>
              <input
                type="text"
                value={clipperUrl}
                onChange={(e) => setClipperUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <button
              disabled={isRendering}
              onClick={handleClipYouTube}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white font-bold text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            >
              <Scissors className="w-5 h-5" />
              <span>Generate Viral Clip</span>
            </button>
            
            <div className="bg-white/5 border border-zinc-800 p-4 rounded-xl text-xs text-zinc-400 leading-relaxed mt-4 space-y-1">
              <strong className="text-white block mb-2 text-sm">How it works:</strong>
              <div><span className="text-indigo-400 font-mono pr-2">01</span> Downloads the highest quality YouTube video & audio.</div>
              <div><span className="text-indigo-400 font-mono pr-2">02</span> Transcribes spoken words using local Whisper AI.</div>
              <div><span className="text-indigo-400 font-mono pr-2">03</span> Analyzes transcripts with Groq Llama 3 to find a 30-60s engaging hook.</div>
              <div><span className="text-indigo-400 font-mono pr-2">04</span> Crops the video to 9:16 vertical format (ready for TikTok / Shorts).</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
