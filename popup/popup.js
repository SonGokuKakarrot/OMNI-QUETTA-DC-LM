const EXT = globalThis.browser ?? globalThis.chrome;

const DEFAULTS = {
  enabled: true,
  gainDb: 45,
  loudness: 20.0,
  drive: 0.75,
  thresholdDb: -36,
  ratio: 18,
  presenceDb: 10,
  lowShelfDb: 3,
  highShelfDb: 10
};

const ids = Object.keys(DEFAULTS);

function updateLabels() {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    const label = document.getElementById(`${id}Val`);
    if (label && el.type !== "checkbox") label.textContent = el.value;
  });
}

async function init() {
  const stored = await EXT.storage.local.get("micMaximizerConfig");
  const config = { ...DEFAULTS, ...(stored.micMaximizerConfig || {}) };

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el.type === "checkbox") el.checked = Boolean(config[id]);
    else el.value = config[id];

    el.addEventListener("input", async () => {
      const next = await EXT.storage.local.get("micMaximizerConfig");
      const merged = { ...DEFAULTS, ...(next.micMaximizerConfig || {}) };
      merged[id] = el.type === "checkbox" ? el.checked : Number(el.value);
      await EXT.storage.local.set({ micMaximizerConfig: merged });
      updateLabels();
    });
  });

  updateLabels();
}

init();


async function refreshHookStatus() {
  const el = document.getElementById("hookStatus");
  if (!el) return;
  try {
    const status = await EXT.runtime.sendMessage({ type: "MICMAX_STATUS_REQUEST" });
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
