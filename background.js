const EXT = globalThis.browser ?? globalThis.chrome;

// background.js
// Safe extension background module: no remote webhook calls, no scraping exfiltration.

const state = {
  installedAt: Date.now(),
  lastHeartbeat: 0,
  hookActiveTabs: new Set()
};

EXT.runtime.onInstalled.addListener(() => {
  console.log('[Mic Maximizer] background installed');
});

EXT.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'MICMAX_HEARTBEAT') {
    state.lastHeartbeat = Date.now();
    if (sender?.tab?.id != null) state.hookActiveTabs.add(sender.tab.id);
    return Promise.resolve({ ok: true });
  }

  if (message.type === 'MICMAX_STATUS_REQUEST') {
    return Promise.resolve({
      ok: true,
      installedAt: state.installedAt,
      lastHeartbeat: state.lastHeartbeat,
      activeTabs: [...state.hookActiveTabs]
    });
  }

  if (message.type === 'MICMAX_RESET_STATUS') {
    state.hookActiveTabs.clear();
    state.lastHeartbeat = 0;
    return Promise.resolve({ ok: true });
  }
});
