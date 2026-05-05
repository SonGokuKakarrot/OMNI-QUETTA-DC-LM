const EXT = globalThis.browser ?? globalThis.chrome;

(() => {
  const DEFAULTS = {
    enabled: true,
    gainDb: 45,
    thresholdDb: -36,
    knee: 28,
    ratio: 18,
    attack: 0.001,
    release: 0.14,
    lowShelfDb: 3,
    presenceDb: 10,
    highShelfDb: 10,
    limiterDb: -4,
    drive: 0.75,
    loudness: 20.0
  };

  const MSG_CFG = "MIC_MAXIMIZER_CONFIG";

  async function loadConfig() {
    try {
      const res = await EXT.storage.local.get("micMaximizerConfig");
      return { ...DEFAULTS, ...(res.micMaximizerConfig || {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function pushConfig(cfg) {
    window.postMessage({ type: MSG_CFG, payload: cfg }, "*");
  }

  async function sync() { pushConfig(await loadConfig()); }

  window.addEventListener("message", (e) => {
    if (e.source === window && e.data?.type === "MIC_MAXIMIZER_READY") sync();
  });

  EXT.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.micMaximizerConfig) {
      pushConfig({ ...DEFAULTS, ...(changes.micMaximizerConfig.newValue || {}) });
    }
  });

  setInterval(sync, 4000);
  sync();
})();


setInterval(() => {
  EXT.runtime.sendMessage({ type: "MICMAX_HEARTBEAT" }).catch(() => {});
}, 5000);
