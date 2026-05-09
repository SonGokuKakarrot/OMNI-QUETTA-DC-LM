const EXT = globalThis.browser ?? globalThis.chrome;
const HAS_PROMISE_API = typeof globalThis.browser !== "undefined" && EXT === globalThis.browser;

function storageGet(key) {
  if (HAS_PROMISE_API) return EXT.storage.local.get(key);
  return new Promise((resolve) => {
    try {
      EXT.storage.local.get(key, (res) => {
        if (EXT.runtime?.lastError) resolve({});
        else resolve(res || {});
      });
    } catch {
      resolve({});
    }
  });
}

function storageSet(value) {
  if (HAS_PROMISE_API) return EXT.storage.local.set(value);
  return new Promise((resolve) => {
    try {
      EXT.storage.local.set(value, () => resolve(!EXT.runtime?.lastError));
    } catch {
      resolve(false);
    }
  });
}

function sendMessage(message) {
  if (HAS_PROMISE_API) return EXT.runtime.sendMessage(message);
  return new Promise((resolve) => {
    try {
      EXT.runtime.sendMessage(message, (res) => {
        if (EXT.runtime?.lastError) resolve(null);
        else resolve(res || null);
      });
    } catch {
      resolve(null);
    }
  });
}

const DEFAULTS = {
  enabled: true,
  gainDb: 18,
  loudness: 2.5,
  maxBoost: 500,
  drive: 0.18,
  thresholdDb: -30,
  ratio: 10,
  limiterDb: -3,
  presenceDb: 5,
  lowShelfDb: 2,
  highShelfDb: 4
};

const PRESETS = {
  stable: { enabled: true, gainDb: 12, loudness: 1.8, maxBoost: 500, drive: 0.08, thresholdDb: -30, ratio: 7, limiterDb: -4, presenceDb: 4, lowShelfDb: 1, highShelfDb: 3 },
  extreme: { enabled: true, gainDb: 48, loudness: 500, maxBoost: 500, drive: 0.06, thresholdDb: -50, ratio: 50, limiterDb: -0.5, presenceDb: 12, lowShelfDb: 4, highShelfDb: 10 }
};

const ids = Object.keys(DEFAULTS);

function presetMatches(config, preset) {
  return Object.entries(preset).every(([key, value]) => config[key] === value);
}

function activePreset(config) {
  if (presetMatches(config, PRESETS.stable)) return "stable";
  if (presetMatches(config, PRESETS.extreme)) return "extreme";
  return "custom";
}

function updatePresetState(config) {
  const active = activePreset(config);
  const stableButton = document.getElementById("stablePreset");
  const extremeButton = document.getElementById("extremePreset");
  document.body.dataset.theme = active;
  stableButton?.classList.toggle("active", active === "stable");
  stableButton?.setAttribute("aria-pressed", String(active === "stable"));
  extremeButton?.classList.toggle("active", active === "extreme");
  extremeButton?.setAttribute("aria-pressed", String(active === "extreme"));
}

function updateLabels() {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    const label = document.getElementById(`${id}Val`);
    if (label && el.type !== "checkbox") label.textContent = el.value;
  });
}

function applyToControls(config) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(config[id]);
    else el.value = config[id];
  });
  updateLabels();
  updatePresetState(config);
}

async function saveConfig(config) {
  await storageSet({ micMaximizerConfig: { ...DEFAULTS, ...config } });
  applyToControls({ ...DEFAULTS, ...config });
}

async function init() {
  const stored = await storageGet("micMaximizerConfig");
  const config = { ...DEFAULTS, ...(stored.micMaximizerConfig || {}) };

  applyToControls(config);

  ids.forEach((id) => {
    const el = document.getElementById(id);

    el.addEventListener("input", async () => {
      const next = await storageGet("micMaximizerConfig");
      const merged = { ...DEFAULTS, ...(next.micMaximizerConfig || {}) };
      merged[id] = el.type === "checkbox" ? el.checked : Number(el.value);
      await storageSet({ micMaximizerConfig: merged });
      updateLabels();
      updatePresetState(merged);
    });
  });

  document.getElementById("stablePreset")?.addEventListener("click", () => saveConfig(PRESETS.stable));
  document.getElementById("extremePreset")?.addEventListener("click", () => saveConfig(PRESETS.extreme));
  updateLabels();
}

init();


async function refreshHookStatus() {
  const el = document.getElementById("hookStatus");
  if (!el) return;
  try {
    const status = await sendMessage({ type: "MICMAX_STATUS_REQUEST" });
    const ageMs = status?.lastHeartbeat ? (Date.now() - status.lastHeartbeat) : Infinity;
    if (status?.ok && ageMs < 12000) {
      el.textContent = "Hook status: ACTIVE";
      el.className = "status ok";
    } else {
      el.textContent = "Hook status: NOT DETECTED (open/reload Discord tab)";
      el.className = "status warn";
    }
  } catch {
    el.textContent = "Hook status: unavailable";
    el.className = "status warn";
  }
}

setInterval(refreshHookStatus, 3000);
refreshHookStatus();
