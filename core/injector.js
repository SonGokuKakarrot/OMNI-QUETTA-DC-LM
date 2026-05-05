(() => {
  if (window.__micMaxInjectorReady) return;
  window.__micMaxInjectorReady = true;

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
  const state = { config: { ...DEFAULTS }, origMD: null, origLegacy: null };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const dbToLinear = (db) => Math.pow(10, db / 20);

  function makeSaturationCurve(amount = 50) {
    const k = Math.max(1, amount * 100);
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function build(stream, c) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return stream;
    const ctx = new AC();
    const source = ctx.createMediaStreamSource(stream);

    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.8;
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 150; low.gain.value = clamp(c.lowShelfDb, -15, 15);
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2900; pres.Q.value = 1.35; pres.gain.value = clamp(c.presenceDb, -12, 12);
    const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4500; high.gain.value = clamp(c.highShelfDb, -15, 15);

    const comp1 = ctx.createDynamicsCompressor();
    comp1.threshold.value = clamp(c.thresholdDb, -55, 0);
    comp1.knee.value = clamp(c.knee, 0, 40);
    comp1.ratio.value = clamp(c.ratio, 1, 20);
    comp1.attack.value = clamp(c.attack, 0, 1);
    comp1.release.value = clamp(c.release, 0, 1);

    const comp2 = ctx.createDynamicsCompressor();
    comp2.threshold.value = -18; comp2.knee.value = 8; comp2.ratio.value = 6; comp2.attack.value = 0.002; comp2.release.value = 0.08;

    const loudness = ctx.createGain(); loudness.gain.value = clamp(c.loudness, 0.5, 20.0);
    const gain = ctx.createGain(); gain.gain.value = dbToLinear(clamp(c.gainDb, 0, 60));
    const saturator = ctx.createWaveShaper(); saturator.curve = makeSaturationCurve(clamp(c.drive, 0, 1)); saturator.oversample = '4x';

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = clamp(c.limiterDb, -10, -0.1); limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.04;

    const dst = ctx.createMediaStreamDestination();
    source.connect(hp); hp.connect(low); low.connect(pres); pres.connect(high);
    high.connect(comp1); comp1.connect(comp2); comp2.connect(loudness); loudness.connect(gain);
    gain.connect(saturator); saturator.connect(limiter); limiter.connect(dst);

    const stop = () => { try { ctx.close(); } catch (_) {} };
    stream.getTracks().forEach((t) => t.addEventListener('ended', stop, { once: true }));
    return dst.stream;
  }

  function normalizeConstraints(constraints) {
    if (constraints === true) return { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false };
    if (!constraints || typeof constraints !== 'object') return constraints;
    const next = { ...constraints };
    if (next.audio === true) next.audio = {};
    if (typeof next.audio === 'object') next.audio = { ...next.audio, echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    return next;
  }

  async function wrapped(orig, constraints, ctx) {
    const s = await orig.call(ctx, normalizeConstraints(constraints));
    const wantAudio = constraints === true || (constraints && typeof constraints === 'object' && ('audio' in constraints ? !!constraints.audio : true));
    if (!state.config.enabled || !wantAudio) return s;
    return build(s, state.config);
  }

  if (navigator.mediaDevices?.getUserMedia) {
    state.origMD = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => wrapped(state.origMD, constraints, navigator.mediaDevices).catch(() => state.origMD(constraints));
  }
  if (navigator.getUserMedia) {
    state.origLegacy = navigator.getUserMedia.bind(navigator);
    navigator.getUserMedia = (constraints, ok, fail) => wrapped(state.origLegacy, constraints, navigator).then(ok).catch((e) => fail && fail(e));
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.type !== MSG_CFG) return;
    state.config = { ...DEFAULTS, ...(e.data.payload || {}) };
  });

  window.postMessage({ type: "MIC_MAXIMIZER_READY" }, "*");
})();
