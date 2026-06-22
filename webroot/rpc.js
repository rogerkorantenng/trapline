// Devvit postMessage RPC layer
// server → webview wraps as { type: 'devvit-message', data: { message: <inner> } }

// Pending requests are keyed by a unique request id so that two in-flight
// calls expecting the same response type don't clobber each other.
const _pendingRpc = new Map(); // reqId → { responseType, resolve, reject, timer }
let _rpcSeq = 0;

window.addEventListener('message', (ev) => {
  let msg = ev.data;
  // Unwrap Devvit envelope
  if (msg && msg.type === 'devvit-message' && msg.data && msg.data.message) {
    msg = msg.data.message;
  }
  if (!msg || !msg.type) return;

  const data = msg.data ?? {};

  // Resolve the oldest pending request waiting on this response type. If the
  // server echoes a reqId, prefer the exact match.
  let matchId = null;
  if (data.__reqId != null && _pendingRpc.has(data.__reqId)) {
    matchId = data.__reqId;
  } else {
    for (const [id, p] of _pendingRpc) {
      if (p.responseType === msg.type) { matchId = id; break; }
    }
  }
  if (matchId != null) {
    const pending = _pendingRpc.get(matchId);
    _pendingRpc.delete(matchId);
    clearTimeout(pending.timer);
    pending.resolve(data);
  }

  // Also fire global event for non-RPC push messages
  window.dispatchEvent(new CustomEvent('devvit:' + msg.type, { detail: data }));
});

function rpc(type, payload, responseType) {
  return new Promise((resolve, reject) => {
    const reqId = ++_rpcSeq;
    const timer = setTimeout(() => {
      _pendingRpc.delete(reqId);
      reject(new Error('RPC timeout: ' + type));
    }, 8000);
    _pendingRpc.set(reqId, { responseType: responseType || type, resolve, reject, timer });
    window.parent.postMessage({ type, data: Object.assign({ __reqId: reqId }, payload || {}) }, '*');
  });
}

function send(type, payload) {
  window.parent.postMessage({ type, data: payload }, '*');
}
