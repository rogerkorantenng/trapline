// Devvit postMessage RPC layer
// server → webview wraps as { type: 'devvit-message', data: { message: <inner> } }

const _pendingRpc = new Map(); // type → { resolve, reject }

window.addEventListener('message', (ev) => {
  let msg = ev.data;
  // Unwrap Devvit envelope
  if (msg && msg.type === 'devvit-message' && msg.data && msg.data.message) {
    msg = msg.data.message;
  }
  if (!msg || !msg.type) return;

  const pending = _pendingRpc.get(msg.type);
  if (pending) {
    _pendingRpc.delete(msg.type);
    pending.resolve(msg.data ?? {});
  }

  // Also fire global event for non-RPC push messages
  window.dispatchEvent(new CustomEvent('devvit:' + msg.type, { detail: msg.data ?? {} }));
});

function rpc(type, payload, responseType) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingRpc.delete(responseType || type);
      reject(new Error('RPC timeout: ' + type));
    }, 8000);
    _pendingRpc.set(responseType || type, {
      resolve: (d) => { clearTimeout(timer); resolve(d); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    window.parent.postMessage({ type, data: payload }, '*');
  });
}

function send(type, payload) {
  window.parent.postMessage({ type, data: payload }, '*');
}
