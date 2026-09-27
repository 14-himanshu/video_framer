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
  Tv,
  Smartphone,
  Layers,
  Settings,
  Video,
  Volume2,
  Scissors,
  ChevronRight,
  Zap,
  Globe,
  Archive,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */
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
  hook?: string;
  clip_duration?: number;
}

/* ─── Small reusable pieces ─────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#16181f] border border-white/[0.07] rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function Badge({ children, color = "indigo" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color] || colors.indigo}`}
    >
      {children}
    </span>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function VideoFarmStudio() {
  type Tab = "studio" | "storyboard" | "archive" | "settings" | "clipper";

  const [activeTab, setActiveTab] = useState<Tab>("studio");
  const [clipperUrl, setClipperUrl] = useState("");
  const [topic, setTopic] = useState("The Secrets of Black Holes");
  const [aspectFormat, setAspectFormat] = useState<"long" | "short">("long");
  const [selectedVoice, setSelectedVoice] = useState("en-US-ChristopherNeural");
  const [visualEngine, setVisualEngine] = useState("auto");
  const [scenesCount, setScenesCount] = useState(3);

  const [voices, setVoices] = useState<Voice[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<ScriptData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStep, setRenderStep] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [systemOnline, setSystemOnline] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const swapCounterRef = useRef<number>(1);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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

  useEffect(() => {
    let ignore = false;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => { if (!ignore) setSystemOnline(d.status === "online"); })
      .catch(() => { if (!ignore) setSystemOnline(false); });

    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => { if (!ignore && d.voices) setVoices(d.voices); })
      .catch(console.error);

    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => { if (!ignore && d.jobs) setJobs(d.jobs); })
      .catch(console.error);

    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  const toggleVoicePreview = (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playingVoiceId === voiceId && !audioRef.current.paused) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }
    audioRef.current.src = `/api/voice-preview/${voiceId}`;
    setPlayingVoiceId(voiceId);
    audioRef.current.play().catch(() => setPlayingVoiceId(null));
    audioRef.current.onended = () => setPlayingVoiceId(null);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateScript = async () => {
    if (!topic.trim()) { showToast("Please enter a topic first"); return; }
    showToast("Generating AI script…");
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, format: aspectFormat, num_scenes: scenesCount }),
      });
      const data = await res.json();
      if (data.success && data.script) {
        setStoryboard(data.script);
        setActiveTab("storyboard");
        showToast("Storyboard ready — review before rendering");
      }
    } catch {
      showToast("Script generation failed");
    }
  };

  const handleStartRender = async (fromStoryboard = false) => {
    if (!topic.trim()) { showToast("Please enter a topic first"); return; }
    setActiveTab("studio");
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStep("Initializing pipeline…");
    setTerminalLogs([`[${new Date().toLocaleTimeString()}] Pipeline started`]);
    setCurrentJob(null);

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
          script: fromStoryboard ? storyboard : null,
        }),
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
    if (!clipperUrl.trim()) { showToast("Please enter a YouTube URL"); return; }
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStep("Queueing clipper…");
    setTerminalLogs([`[${new Date().toLocaleTimeString()}] Clip queued`]);
    try {
      const res = await fetch("/api/clip-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clipperUrl }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail);
      setActiveTab("studio");
      listenToStream(data.job_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Clip failed";
      showToast(`Error: ${msg}`);
      setIsRendering(false);
    }
  };

  const listenToStream = (jobId: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`/api/stream/${jobId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setRenderProgress(data.progress || 0);
        if (data.step) setRenderStep(data.step);
        if (data.new_logs?.length) setTerminalLogs((p) => [...p, ...data.new_logs]);
        if (data.status === "completed") {
          es.close();
          setIsRendering(false);
          showToast("Video rendered successfully");
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

  const handleRegenerateSceneVisual = useCallback(
    async (idx: number) => {
      if (!storyboard) return;
      const sc = storyboard.scenes[idx];
      showToast(`Refreshing scene ${idx + 1} visual…`);
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
            topic,
          }),
        });
        const data = await res.json();
        if (data.success && data.image_url) {
          setStoryboard((prev) => {
            if (!prev) return prev;
            const updated = [...prev.scenes];
            updated[idx] = { ...updated[idx], preview_image: data.image_url };
            return { ...prev, scenes: updated };
          });
          showToast(`Scene ${idx + 1} updated`);
        }
      } catch {
        showToast("Could not refresh image");
      }
    },
    [storyboard, topic, aspectFormat, visualEngine]
  );

  /* ── NAV TABS ─────────────────────────────────────────────────────── */
  const navTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "studio",     label: "Studio",     icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "storyboard", label: "Storyboard", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "archive",    label: "Archive",    icon: <Archive className="w-3.5 h-3.5" /> },
    { id: "clipper",    label: "Clipper",    icon: <Scissors className="w-3.5 h-3.5" /> },
    { id: "settings",   label: "Settings",   icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  /* ─── RENDER ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0b0f] text-slate-200">
      <audio ref={audioRef} className="hidden" preload="none" />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 fade-up flex items-center gap-2.5 bg-[#1c1e28] border border-white/10 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl">
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
          {toast}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0b0f]/90 backdrop-blur-xl border-b border-white/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <div className="text-sm font-bold text-white tracking-tight">VideoFarm</div>
            <div className="text-[10px] text-slate-500 font-medium">AI Studio</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 bg-[#111218] border border-white/[0.07] rounded-xl p-1">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "storyboard" && !storyboard) {
                  handleGenerateScript();
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "archive" && jobs.length > 0 && (
                <span className="bg-white/10 text-slate-300 px-1.5 py-px rounded-full text-[9px] font-bold">
                  {jobs.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className={`w-1.5 h-1.5 rounded-full ${systemOnline ? "bg-emerald-400 pulse-dot" : "bg-red-400"}`} />
          <span className={systemOnline ? "text-emerald-400" : "text-red-400"}>
            {systemOnline ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      {/* ── PAGE CONTENT ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">

        {/* ═══════════════════════════════════════════════════════════
            STUDIO TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "studio" && (
          <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start fade-up">

            {/* LEFT — Controls */}
            <Card className="p-5 flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Project Settings</h2>
                <Badge color="slate">Free Tier</Badge>
              </div>

              {/* Topic */}
              <div>
                <Label>Topic / Idea</Label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The Secrets of Black Holes…"
                  className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[
                    "Black Holes",
                    "Fall of Rome",
                    "Pyramids of Giza",
                    "James Webb Telescope",
                    "Deep Sea Monsters",
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => setTopic(p)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-slate-400 hover:text-slate-200 transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <Label>Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: "long" as const,  icon: <Tv className="w-4 h-4" />,         title: "16:9 Landscape", sub: "YouTube" },
                    { val: "short" as const, icon: <Smartphone className="w-4 h-4" />, title: "9:16 Vertical",  sub: "Shorts / TikTok" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setAspectFormat(opt.val)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                        aspectFormat === opt.val
                          ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                          : "border-white/[0.07] bg-[#0a0b0f] text-slate-400 hover:border-white/[0.12] hover:text-slate-200"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${aspectFormat === opt.val ? "bg-indigo-600 text-white" : "bg-white/5"}`}>
                        {opt.icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{opt.title}</div>
                        <div className="text-[10px] text-slate-500">{opt.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Voiceover</Label>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Click ▶ to preview
                  </span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {voices.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                        selectedVoice === v.id
                          ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                          : "border-white/[0.07] bg-[#0a0b0f] text-slate-300 hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium truncate">
                          {v.avatar || "🎙️"} {v.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{v.tone}</div>
                      </div>
                      <button
                        onClick={(e) => toggleVoicePreview(v.id, e)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all ${
                          playingVoiceId === v.id
                            ? "bg-indigo-500 text-white scale-110"
                            : "bg-white/10 hover:bg-indigo-500 text-white"
                        }`}
                      >
                        {playingVoiceId === v.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Engine */}
              <div>
                <Label>Visual Engine</Label>
                <select
                  value={visualEngine}
                  onChange={(e) => setVisualEngine(e.target.value)}
                  className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                >
                  <option value="auto">HD Web Search (Pexels + Wikimedia)</option>
                  <option value="ai">AI Art (Pollinations Turbo)</option>
                  <option value="wikimedia">Public Archives (Openverse)</option>
                </select>
              </div>

              {/* Scenes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Scenes</Label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {scenesCount} scenes · ~{scenesCount * (aspectFormat === "short" ? 8 : 12)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={6}
                  value={scenesCount}
                  onChange={(e) => setScenesCount(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  disabled={isRendering}
                  onClick={() => handleStartRender(false)}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Video
                </button>
                <button
                  disabled={isRendering}
                  onClick={handleGenerateScript}
                  className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-slate-300 text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                >
                  <Layers className="w-4 h-4" />
                  Preview Storyboard First
                </button>
              </div>
            </Card>

            {/* RIGHT — Preview & Pipeline */}
            <div className="flex flex-col gap-5">
              {/* Video Preview */}
              <Card className="overflow-hidden">
                <div
                  className={`w-full flex items-center justify-center relative bg-black ${
                    aspectFormat === "long"
                      ? "aspect-video"
                      : "aspect-[9/16] max-h-[520px] max-w-[300px] mx-auto my-6 rounded-2xl overflow-hidden"
                  }`}
                >
                  {!currentJob?.video_url && !isRendering && (
                    <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                        <Video className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1">Preview Window</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Configure your project on the left, then click{" "}
                          <strong className="text-slate-300">Generate Video</strong> to start rendering.
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 w-full mt-2">
                        {[
                          { label: "Speed", value: "~30s",       color: "text-slate-200" },
                          { label: "Cost",  value: "$0.00",       color: "text-emerald-400" },
                          { label: "Output", value: "HD 30fps",  color: "text-indigo-400" },
                        ].map((s) => (
                          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 text-left">
                            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">{s.label}</div>
                            <div className={`text-xs font-bold font-mono ${s.color}`}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentJob?.video_url && (
                    <video
                      src={`${currentJob.video_url}?id=${currentJob.job_id}`}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </Card>

              {/* Render Progress */}
              {isRendering && (
                <Card className="p-5 fade-up">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full spinner" />
                      <span className="text-sm font-medium text-white">{renderStep}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-indigo-400">{renderProgress}%</span>
                  </div>

                  {/* Progress tracks */}
                  <div className="space-y-3 mb-4">
                    {[
                      { label: "Script & Audio",    value: Math.min(100, renderProgress * 2.5) },
                      { label: "Media Sourcing",     value: renderProgress > 30 ? Math.min(100, (renderProgress - 30) * 2.5) : 0 },
                      { label: "Video Compositing",  value: renderProgress > 65 ? Math.min(100, (renderProgress - 65) * 3) : 0 },
                    ].map((track) => (
                      <div key={track.label}>
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>{track.label}</span>
                          <span className="font-mono">{Math.round(track.value)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${track.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Terminal */}
                  <div className="bg-[#0a0b0f] border border-white/[0.06] rounded-xl p-3 font-mono text-[11px] text-slate-400 h-28 overflow-y-auto leading-relaxed">
                    {terminalLogs.map((log, i) => (
                      <div key={i} className="mb-0.5">{log}</div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                </Card>
              )}

              {/* Completed: Metadata Launchpad */}
              {currentJob?.video_url && (
                <Card className="p-5 fade-up">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Publish Assets</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Copy-ready title, description & tags</p>
                    </div>
                    <a
                      href={currentJob.video_url}
                      download="documentary.mp4"
                      className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download MP4
                    </a>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { key: "title", label: "Title",       value: currentJob.title || currentJob.topic || "Viral Clip" },
                      { key: "desc",  label: "Description", value: currentJob.description || "N/A" },
                      currentJob.hook 
                        ? { key: "hook", label: "Viral Hook", value: currentJob.hook }
                        : { key: "tags", label: "Tags",       value: (currentJob.tags || []).join(", ") || "N/A" }
                    ].map((item) => (
                      <div key={item.key} className="bg-[#0a0b0f] border border-white/[0.06] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-semibold uppercase text-slate-500">{item.label}</span>
                          <button
                            onClick={() => handleCopy(item.value, item.key)}
                            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {copiedKey === item.key ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            Copy
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            STORYBOARD TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "storyboard" && storyboard && (
          <div className="max-w-[1000px] mx-auto px-6 py-6 space-y-5 fade-up">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Storyboard Editor</h2>
                <p className="text-xs text-slate-500 mt-0.5">Edit narration and visuals before rendering</p>
              </div>
              <button
                onClick={() => handleStartRender(true)}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
              >
                <Sparkles className="w-4 h-4" />
                Render This Storyboard
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Meta */}
            <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Video Title</Label>
                <input
                  type="text"
                  value={storyboard.title}
                  onChange={(e) => setStoryboard({ ...storyboard, title: e.target.value })}
                  className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div>
                <Label>SEO Description</Label>
                <input
                  type="text"
                  value={storyboard.description}
                  onChange={(e) => setStoryboard({ ...storyboard, description: e.target.value })}
                  className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
            </Card>

            {/* Scene Cards */}
            <div className="space-y-4">
              {storyboard.scenes.map((sc, idx) => (
                <Card key={idx} className="p-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-start">
                  {/* Thumbnail */}
                  <div className={`relative bg-black rounded-xl overflow-hidden border border-white/[0.07] ${aspectFormat === "short" ? "aspect-[9/16] max-h-44" : "aspect-video"}`}>
                    <img
                      src={sc.preview_image || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=250&fit=crop"}
                      alt={`Scene ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRegenerateSceneVisual(idx)}
                      className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-semibold bg-black/70 hover:bg-indigo-600 text-white px-2 py-1 rounded-lg border border-white/[0.1] backdrop-blur-sm transition-all"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Swap
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge color="indigo">Scene {sc.scene_id || idx + 1}</Badge>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ~{Math.max(4, Math.round((sc.narration || "").split(" ").length / 2.5))}s
                      </span>
                    </div>

                    <div>
                      <Label>Narration</Label>
                      <textarea
                        rows={3}
                        value={sc.narration}
                        onChange={(e) => {
                          const updated = [...storyboard.scenes];
                          updated[idx].narration = e.target.value;
                          setStoryboard({ ...storyboard, scenes: updated });
                        }}
                        className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white resize-none focus:outline-none focus:border-indigo-500/60 transition-all leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Search Keywords</Label>
                        <input
                          type="text"
                          value={sc.search_query || ""}
                          onChange={(e) => {
                            const updated = [...storyboard.scenes];
                            updated[idx].search_query = e.target.value;
                            setStoryboard({ ...storyboard, scenes: updated });
                          }}
                          className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                        />
                      </div>
                      <div>
                        <Label>AI Image Prompt</Label>
                        <input
                          type="text"
                          value={sc.image_prompt || ""}
                          onChange={(e) => {
                            const updated = [...storyboard.scenes];
                            updated[idx].image_prompt = e.target.value;
                            setStoryboard({ ...storyboard, scenes: updated });
                          }}
                          className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "storyboard" && !storyboard && (
          <div className="max-w-[600px] mx-auto px-6 py-20 text-center fade-up">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-5">
              <Layers className="w-6 h-6 text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">No Storyboard Yet</h2>
            <p className="text-sm text-slate-500 mb-6">Generate a script first from the Studio tab.</p>
            <button
              onClick={() => { setActiveTab("studio"); }}
              className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
            >
              Go to Studio
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ARCHIVE TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "archive" && (
          <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5 fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Video Archive</h2>
                <p className="text-xs text-slate-500 mt-0.5">{jobs.length} video{jobs.length !== 1 ? "s" : ""} stored locally</p>
              </div>
              <button
                onClick={fetchGallery}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-sm text-slate-300 font-medium transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                  <Archive className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-500 text-sm">No videos yet — generate your first one in the Studio.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {jobs.map((j) => (
                  <Card key={j.job_id} className="overflow-hidden flex flex-col hover:border-indigo-500/30 transition-all">
                    <div className={`bg-black ${j.format === "short" ? "aspect-[9/16] max-h-72" : "aspect-video"}`}>
                      <video src={j.video_url} controls className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white truncate">{j.title || j.topic || "YouTube Clip"}</h4>
                        {j.hook && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic leading-relaxed">
                            "{j.hook}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge color={j.format === "short" || j.job_id.startsWith("clip_") ? "indigo" : "slate"}>
                            {j.format === "short" || j.job_id.startsWith("clip_") ? "9:16 Short" : "16:9 Landscape"}
                          </Badge>
                          {(j.clip_duration || j.file_size_mb) && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {j.clip_duration ? `${j.clip_duration}s` : `${j.file_size_mb} MB`}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={j.video_url}
                        download="video.mp4"
                        className="flex items-center justify-center gap-1.5 py-2 mt-auto rounded-xl bg-white/[0.04] hover:bg-indigo-600 border border-white/[0.07] hover:border-transparent text-xs font-semibold text-slate-300 hover:text-white transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download MP4
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            CLIPPER TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "clipper" && (
          <div className="max-w-[640px] mx-auto px-6 py-10 fade-up">
            <Card className="p-7 flex flex-col gap-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Scissors className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-white">YouTube AI Clipper</h2>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Paste a YouTube URL to extract the most engaging 30–60s moment and convert it to a 9:16 Short.
                </p>
              </div>

              <div>
                <Label>YouTube URL</Label>
                <input
                  type="text"
                  value={clipperUrl}
                  onChange={(e) => setClipperUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-3 px-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>

              <button
                disabled={isRendering}
                onClick={handleClipYouTube}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/20"
              >
                <Scissors className="w-4 h-4" />
                Generate Viral Clip
              </button>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-white mb-2">How it works</p>
                {[
                  "Downloads the video & audio from YouTube",
                  "Transcribes speech with local Whisper AI",
                  "Finds the most engaging hook with Groq LLaMA 3",
                  "Crops to 9:16 vertical format (TikTok / Shorts ready)",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-indigo-400 font-mono text-[10px] font-bold mt-0.5 shrink-0">
                      0{i + 1}
                    </span>
                    <span className="text-[11px] text-slate-400 leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SETTINGS TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "settings" && (
          <div className="max-w-[560px] mx-auto px-6 py-10 fade-up">
            <Card className="p-7 flex flex-col gap-6">
              <div>
                <h2 className="text-base font-bold text-white">Settings</h2>
                <p className="text-xs text-slate-500 mt-1">Configure your API keys and runtime environment.</p>
              </div>

              {/* Groq Key */}
              <div>
                <Label>Groq API Key</Label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 bg-[#0a0b0f] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                  <button
                    onClick={async () => {
                      if (!apiKeyInput.trim()) return;
                      const res = await fetch("/api/update-groq-key", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ groq_api_key: apiKeyInput }),
                      });
                      const d = await res.json();
                      if (d.success) { showToast("API key saved"); setApiKeyInput(""); }
                    }}
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Saved securely to <code className="text-slate-400">.env</code> on your machine.
                </p>
              </div>

              {/* System Info */}
              <div>
                <Label>Runtime</Label>
                <div className="bg-[#0a0b0f] border border-white/[0.06] rounded-xl p-4 font-mono text-[11px] text-slate-500 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Frontend</span>
                    <span className="text-slate-400">Next.js · Port 3000</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Backend</span>
                    <span className="text-slate-400">FastAPI · Port 8000</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>FFmpeg</span>
                    <span className="text-slate-400">/opt/homebrew/bin/ffmpeg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Engine</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${systemOnline ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className={systemOnline ? "text-emerald-400" : "text-red-400"}>
                        {systemOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Globe className="w-3.5 h-3.5" />, label: "Groq Console",  href: "https://console.groq.com" },
                  { icon: <Video className="w-3.5 h-3.5" />, label: "Open Archive",  href: "#", action: () => setActiveTab("archive") },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href !== "#" ? "_blank" : undefined}
                    rel="noreferrer"
                    onClick={link.action}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-xs text-slate-400 hover:text-slate-200 font-medium transition-all"
                  >
                    {link.icon}
                    {link.label}
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}
