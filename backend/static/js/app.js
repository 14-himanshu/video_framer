// ============================================================
// VideoFarm AI Studio - Cinema-Grade Production Client
// ============================================================

let currentAspect = "long";
let selectedVoice = "en-US-ChristopherNeural";
let currentJobId = null;
let currentStoryboard = null;
let eventSource = null;
let activePreviewVoiceId = null;

document.addEventListener("DOMContentLoaded", () => {
  fetchSystemStatus();
  fetchVoiceMatrix();
  fetchGalleryArchive();
});

// ============================================================
// Navigation & Tab Switching
// ============================================================
function switchNavTab(tabName) {
  const sections = ["studio", "storyboard", "gallery", "monetization", "settings"];
  sections.forEach(s => {
    const el = document.getElementById(`nav-${s}`);
    const btn = document.getElementById(`tab-btn-${s}`);
    if (el) el.style.display = (s === tabName) ? (s === "studio" ? "grid" : "block") : "none";
    if (btn) btn.classList.toggle("active", s === tabName);
  });

  if (tabName === "gallery") {
    fetchGalleryArchive();
  }
}

function openStoryboardTab() {
  if (!currentStoryboard) {
    prepareStoryboardPreview();
  } else {
    switchNavTab("storyboard");
  }
}

// Preset Topics
function applyPresetTopic(topic) {
  document.getElementById("topic-input").value = topic;
  showToast(`Loaded topic: "${topic}"`);
}

// Aspect Ratio Selector
function changeAspectFormat(fmt) {
  currentAspect = fmt;
  const longCard = document.getElementById("format-card-long");
  const shortCard = document.getElementById("format-card-short");
  const screen = document.getElementById("cinema-screen");

  longCard.classList.toggle("selected", fmt === "long");
  shortCard.classList.toggle("selected", fmt === "short");

  if (fmt === "long") {
    screen.className = "cinema-screen-wrap aspect-16-9";
  } else {
    screen.className = "cinema-screen-wrap aspect-9-16";
  }
  handleSceneSliderChange(document.getElementById("scenes-range").value);
}

// Scene Duration Slider
function handleSceneSliderChange(val) {
  const badge = document.getElementById("scene-slider-badge");
  const isShort = (currentAspect === "short");
  const secPerScene = isShort ? 8 : 12;
  const totalSec = val * secPerScene;
  badge.innerText = `${val} Scenes (~${totalSec}s)`;
}

// ============================================================
// System Status & Voice Matrix
// ============================================================
async function fetchSystemStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const statusLabel = document.getElementById("engine-status-label");
    const keyStatus = document.getElementById("settings-key-status");

    if (data.status === "online") {
      statusLabel.innerText = `Online (${data.total_jobs} Projects)`;
    }
    if (data.has_groq_key && keyStatus) {
      keyStatus.innerText = `✓ Active in .env (${data.groq_masked})`;
    }
  } catch (err) {
    console.error("Status fetch failed:", err);
  }
}

async function fetchVoiceMatrix() {
  const container = document.getElementById("voice-matrix-grid");
  if (!container) return;

  try {
    const res = await fetch("/api/voices");
    const data = await res.json();
    const voices = data.voices || [];

    container.innerHTML = "";
    voices.forEach(v => {
      const card = document.createElement("div");
      card.className = `voice-card ${v.id === selectedVoice ? 'selected' : ''}`;
      card.id = `voice-card-${v.id}`;
      card.onclick = () => selectVoice(v.id);

      card.innerHTML = `
        <div class="voice-card-left">
          <span class="voice-avatar">${v.avatar || '🎙️'}</span>
          <div class="voice-details">
            <div class="voice-name">${v.name}</div>
            <div class="voice-accent">${v.tone}</div>
          </div>
        </div>
        <button class="voice-play-btn" id="voice-btn-${v.id}" title="Listen to Voice Preview" onclick="toggleVoiceAudio('${v.id}', event)">
          ▶
        </button>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load voices:", err);
  }
}

function selectVoice(voiceId) {
  selectedVoice = voiceId;
  document.querySelectorAll(".voice-card").forEach(el => el.classList.remove("selected"));
  const activeCard = document.getElementById(`voice-card-${voiceId}`);
  if (activeCard) activeCard.classList.add("selected");
  showToast(`Voice selected: ${voiceId.split('-')[2] || voiceId}`);
}

function toggleVoiceAudio(voiceId, event) {
  event.stopPropagation();
  const audioEl = document.getElementById("global-preview-audio");
  const btn = document.getElementById(`voice-btn-${voiceId}`);

  if (activePreviewVoiceId === voiceId && !audioEl.paused) {
    audioEl.pause();
    btn.innerText = "▶";
    btn.classList.remove("playing");
    activePreviewVoiceId = null;
    return;
  }

  // Reset previously playing button
  if (activePreviewVoiceId) {
    const prevBtn = document.getElementById(`voice-btn-${activePreviewVoiceId}`);
    if (prevBtn) {
      prevBtn.innerText = "▶";
      prevBtn.classList.remove("playing");
    }
  }

  audioEl.src = `/api/voice-preview/${voiceId}`;
  btn.innerText = "⏸";
  btn.classList.add("playing");
  activePreviewVoiceId = voiceId;

  audioEl.play().catch(e => {
    console.error("Audio playback error:", e);
    btn.innerText = "▶";
    btn.classList.remove("playing");
  });

  audioEl.onended = () => {
    btn.innerText = "▶";
    btn.classList.remove("playing");
    activePreviewVoiceId = null;
  };
}

// ============================================================
// Storyboard & Script Engine
// ============================================================
async function prepareStoryboardPreview() {
  const topic = document.getElementById("topic-input").value.trim();
  const numScenes = parseInt(document.getElementById("scenes-range").value);

  if (!topic) {
    showToast("Please enter a topic first!", "error");
    return;
  }

  const btn = document.getElementById("btn-open-storyboard");
  btn.disabled = true;
  btn.innerText = "⏳ Directing Script...";

  try {
    const res = await fetch("/api/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, format: currentAspect, num_scenes: numScenes })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.detail || "Failed to generate script");

    currentStoryboard = data.script;
    renderStoryboardCards(data.script);
    switchNavTab("storyboard");
    showToast("Script generated! Review scenes below.");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "📝 Edit Script First";
  }
}

function renderStoryboardCards(script) {
  document.getElementById("storyboard-title").value = script.title || "";
  document.getElementById("storyboard-desc").value = script.description || "";

  const container = document.getElementById("storyboard-scenes-container");
  container.innerHTML = "";

  const isVertical = (currentAspect === "short");

  (script.scenes || []).forEach((sc, idx) => {
    const card = document.createElement("div");
    card.className = "scene-timeline-card";
    card.id = `storyboard-card-${idx}`;

    const placeholderThumb = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=360&h=200&fit=crop";

    card.innerHTML = `
      <div class="scene-visual-preview ${isVertical ? 'is-vertical' : ''}">
        <img id="scene-thumb-img-${idx}" src="${sc.preview_image || placeholderThumb}" alt="Scene ${idx + 1}">
        <button class="regen-visual-btn" onclick="fetchCustomSceneImage(${idx})">🔄 Swap Visual</button>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
          <span style="font-size: 0.85rem; font-weight: 800; color: var(--accent-cyan);">Scene ${idx + 1}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">
            Est. ~${Math.max(4, Math.round((sc.narration || '').split(' ').length / 2.5))}s
          </span>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <label class="section-label" style="font-size: 0.72rem;">Narration Script (Spoken Audio)</label>
          <textarea id="sb-narr-${idx}" class="topic-input" rows="2" style="padding-left: 0.85rem; font-size: 0.88rem;">${sc.narration || ''}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label class="section-label" style="font-size: 0.72rem;">Visual Search Keywords</label>
            <input type="text" id="sb-query-${idx}" class="topic-input" style="padding-left: 0.85rem; font-size: 0.82rem;" value="${sc.search_query || ''}">
          </div>
          <div>
            <label class="section-label" style="font-size: 0.72rem;">AI Art Direction Prompt</label>
            <input type="text" id="sb-prompt-${idx}" class="topic-input" style="padding-left: 0.85rem; font-size: 0.82rem;" value="${sc.image_prompt || ''}">
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Single Scene Image Regeneration
async function fetchCustomSceneImage(idx) {
  const query = document.getElementById(`sb-query-${idx}`).value.trim();
  const prompt = document.getElementById(`sb-prompt-${idx}`).value.trim();
  const topic = document.getElementById("topic-input").value.trim();
  const imgEl = document.getElementById(`scene-thumb-img-${idx}`);

  showToast(`Sourcing new image for Scene ${idx + 1}...`);

  try {
    const res = await fetch("/api/generate-scene-visual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query || topic,
        prompt: prompt,
        is_vertical: (currentAspect === "short"),
        source: "auto",
        scene_index: idx + Math.floor(Math.random() * 5) + 1,
        topic: topic
      })
    });
    const data = await res.json();
    if (data.success && data.image_url) {
      imgEl.src = `${data.image_url}?t=${Date.now()}`;
      if (currentStoryboard && currentStoryboard.scenes[idx]) {
        currentStoryboard.scenes[idx].preview_image = data.image_url;
      }
      showToast(`Visual updated for Scene ${idx + 1}!`, "success");
    }
  } catch (err) {
    showToast("Could not refresh image", "error");
  }
}

// ============================================================
// Video Rendering Pipeline
// ============================================================
async function launchVideoGeneration(fromStoryboard = false) {
  const topic = document.getElementById("topic-input").value.trim();
  const numScenes = parseInt(document.getElementById("scenes-range").value);
  const visualSource = document.getElementById("visual-engine-select").value;

  if (!topic) {
    showToast("Please enter a video topic!", "error");
    return;
  }

  let scriptPayload = null;

  if (fromStoryboard && currentStoryboard) {
    const title = document.getElementById("storyboard-title").value;
    const desc = document.getElementById("storyboard-desc").value;
    const editedScenes = [];

    (currentStoryboard.scenes || []).forEach((sc, idx) => {
      const narrEl = document.getElementById(`sb-narr-${idx}`);
      const queryEl = document.getElementById(`sb-query-${idx}`);
      const promptEl = document.getElementById(`sb-prompt-${idx}`);
      editedScenes.push({
        scene_id: idx + 1,
        narration: narrEl ? narrEl.value : sc.narration,
        search_query: queryEl ? queryEl.value : sc.search_query,
        image_prompt: promptEl ? promptEl.value : sc.image_prompt
      });
    });

    scriptPayload = {
      title,
      description: desc,
      tags: currentStoryboard.tags || [topic],
      scenes: editedScenes
    };
  }

  // Switch back to Studio Canvas to watch the live render
  switchNavTab("studio");

  // Show Multi-Track Timeline & Terminal
  const pipelineBox = document.getElementById("live-pipeline-box");
  const pctBadge = document.getElementById("pipeline-percentage");
  const statusMsg = document.getElementById("pipeline-status-msg");
  const terminal = document.getElementById("live-terminal-dock");
  const launchpad = document.getElementById("export-launchpad-box");
  const player = document.getElementById("cinema-player");
  const standbyView = document.getElementById("cinema-standby-view");

  pipelineBox.classList.add("active");
  launchpad.classList.remove("active");
  player.style.display = "none";
  standbyView.style.display = "block";
  pctBadge.innerText = "0%";
  statusMsg.innerText = "Initializing Production Worker...";
  terminal.innerHTML = `<div class="log-line">[${new Date().toLocaleTimeString()}] Pipeline queued for execution...</div>`;

  // Reset track progress fills
  document.getElementById("track-speech-fill").style.width = "0%";
  document.getElementById("track-visual-fill").style.width = "0%";
  document.getElementById("track-render-fill").style.width = "0%";

  document.getElementById("btn-start-render").disabled = true;
  document.getElementById("btn-open-storyboard").disabled = true;

  try {
    const res = await fetch("/api/render-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        format: currentAspect,
        num_scenes: numScenes,
        voice: selectedVoice,
        visual_source: visualSource,
        script: scriptPayload
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.detail || "Job initiation failed");

    currentJobId = data.job_id;
    attachStreamListener(data.job_id);
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
    document.getElementById("btn-start-render").disabled = false;
    document.getElementById("btn-open-storyboard").disabled = false;
  }
}

// Real-Time SSE Stream Listener
function attachStreamListener(jobId) {
  if (eventSource) eventSource.close();

  const pctBadge = document.getElementById("pipeline-percentage");
  const statusMsg = document.getElementById("pipeline-status-msg");
  const terminal = document.getElementById("live-terminal-dock");
  const trackSpeech = document.getElementById("track-speech-fill");
  const trackVisual = document.getElementById("track-visual-fill");
  const trackRender = document.getElementById("track-render-fill");

  eventSource = new EventSource(`/api/stream/${jobId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const pct = data.progress || 0;

      pctBadge.innerText = `${pct}%`;
      if (data.step) statusMsg.innerText = data.step;

      // Update individual track timeline fills
      if (pct <= 35) {
        trackSpeech.style.width = `${Math.min(100, pct * 3)}%`;
      } else if (pct <= 70) {
        trackSpeech.style.width = "100%";
        trackVisual.style.width = `${Math.min(100, (pct - 35) * 3)}%`;
      } else {
        trackSpeech.style.width = "100%";
        trackVisual.style.width = "100%";
        trackRender.style.width = `${Math.min(100, (pct - 70) * 3.3)}%`;
      }

      if (data.new_logs && data.new_logs.length > 0) {
        data.new_logs.forEach(line => {
          const entry = document.createElement("div");
          entry.className = "log-line";
          if (line.includes("[ERROR]")) entry.classList.add("error");
          if (line.includes("complete") || line.includes("SUCCESS")) entry.classList.add("success");
          entry.innerText = line;
          terminal.appendChild(entry);
        });
        terminal.scrollTop = terminal.scrollHeight;
      }

      if (data.status === "completed") {
        eventSource.close();
        handleCompletion(jobId);
      } else if (data.status === "failed") {
        eventSource.close();
        showToast(`Render failed: ${data.error}`, "error");
        document.getElementById("btn-start-render").disabled = false;
        document.getElementById("btn-open-storyboard").disabled = false;
      }
    } catch (e) {
      console.error("Stream parse error:", e);
    }
  };

  eventSource.onerror = () => {
    fetch(`/api/job/${jobId}`)
      .then(res => res.json())
      .then(job => {
        if (job.status === "completed") {
          if (eventSource) eventSource.close();
          handleCompletion(jobId);
        }
      });
  };
}

// Completed Video Handling
async function handleCompletion(jobId) {
  showToast("🎉 Video successfully composited!", "success");
  document.getElementById("btn-start-render").disabled = false;
  document.getElementById("btn-open-storyboard").disabled = false;

  try {
    const res = await fetch(`/api/job/${jobId}`);
    const job = await res.json();

    const videoUrl = `${job.video_url}?t=${Date.now()}`;
    const player = document.getElementById("cinema-player");
    const standbyView = document.getElementById("cinema-standby-view");
    const launchpad = document.getElementById("export-launchpad-box");
    const downloadBtn = document.getElementById("launchpad-download-btn");

    // Display & Play Video
    player.src = videoUrl;
    player.style.display = "block";
    standbyView.style.display = "none";
    player.play().catch(() => {});

    // Set Download URL
    downloadBtn.href = videoUrl;
    downloadBtn.setAttribute("download", `${(job.title || job.topic).replace(/[^a-zA-Z0-9]/g, '_')}.mp4`);

    // Populate YouTube Launchpad
    document.getElementById("meta-title-text").innerText = job.title || job.topic;
    document.getElementById("meta-desc-text").innerText = job.description || "";
    document.getElementById("meta-tags-text").innerText = (job.tags || []).join(", ");
    launchpad.classList.add("active");

    fetchGalleryArchive();
  } catch (err) {
    console.error("Completion error:", err);
  }
}

// ============================================================
// Gallery Archive
// ============================================================
async function fetchGalleryArchive() {
  const grid = document.getElementById("gallery-cards-grid");
  const countBadge = document.getElementById("gallery-count-badge");
  if (!grid) return;

  try {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    const jobs = data.jobs || [];

    if (countBadge) countBadge.innerText = jobs.length;

    if (jobs.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem;">No videos rendered yet. Use the Studio to create your first video!</div>`;
      return;
    }

    grid.innerHTML = "";
    jobs.forEach(j => {
      if (j.status !== "completed" || !j.video_url) return;

      const isVert = (j.format === "short");
      const card = document.createElement("div");
      card.className = "gallery-card";
      card.innerHTML = `
        <div class="gallery-video-frame ${isVert ? 'is-vertical' : ''}">
          <video src="${j.video_url}" controls style="width: 100%; height: 100%; object-fit: cover;"></video>
        </div>
        <div class="gallery-card-body">
          <h4 class="gallery-card-title">${j.title || j.topic}</h4>
          <div class="gallery-card-meta">
            <span>${isVert ? '📱 9:16 Short' : '🖥️ 16:9 Cinema'}</span>
            <span>•</span>
            <span>${j.file_size_mb || '2'} MB</span>
            <span>•</span>
            <span>${j.created_at || ''}</span>
          </div>
          <a href="${j.video_url}" download class="btn btn-secondary btn-block" style="padding: 0.55rem; font-size: 0.8rem;">
            ⬇️ Download MP4
          </a>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load archive:", err);
  }
}

// Copy Text Helper
function copyLaunchpadText(elementId) {
  const text = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!");
  }).catch(() => {
    showToast("Copy failed", "error");
  });
}

// Groq Key Update
async function submitGroqKeyUpdate() {
  const input = document.getElementById("input-groq-key");
  const key = input.value.trim();
  if (!key) {
    showToast("Please enter an API key", "error");
    return;
  }

  try {
    const res = await fetch("/api/update-groq-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groq_api_key: key })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Groq API Key saved successfully!");
      input.value = "";
      fetchSystemStatus();
    }
  } catch (err) {
    showToast("Failed to save key", "error");
  }
}

// Toast Notifications
function showToast(message, type = "info") {
  const shelf = document.getElementById("toast-shelf");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = (type === "error" ? "⚠️ " : "✨ ") + message;

  shelf.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}
