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

EXT.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'MICMAX_HEARTBEAT') {
    state.lastHeartbeat = Date.now();
    if (sender?.tab?.id != null) state.hookActiveTabs.add(sender.tab.id);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'MICMAX_STATUS_REQUEST') {
    sendResponse({
      ok: true,
      installedAt: state.installedAt,
      lastHeartbeat: state.lastHeartbeat,
      activeTabs: [...state.hookActiveTabs]
    });
    return false;
  }

  if (message.type === 'MICMAX_RESET_STATUS') {
    state.hookActiveTabs.clear();
    state.lastHeartbeat = 0;
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
