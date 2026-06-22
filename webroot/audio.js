// Minimal Web Audio synthesizer — no assets needed
// All sounds generated procedurally

const Audio = (function() {
  let ctx = null;
  let enabled = true;
  let muted = false;
  const MUTE_KEY = 'trapline_muted';
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch(e) {}

  function _ctx() {
    if (muted) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { enabled=false; }
    }
    return ctx;
  }

  function _play(type, freq, duration, vol, detune) {
    if (!enabled) return;
    try {
      const c = _ctx(); if(!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = type||'square';
      osc.frequency.value = freq||440;
      if (detune) osc.detune.value = detune;
      gain.gain.setValueAtTime(vol||0.1, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+(duration||0.1));
      osc.start(c.currentTime);
      osc.stop(c.currentTime+(duration||0.1)+0.01);
    } catch(e) {}
  }

  function jump() {
    _play('square', 320, 0.08, 0.06);
    setTimeout(()=>_play('square', 480, 0.06, 0.04), 30);
  }

  function land() {
    _play('sawtooth', 120, 0.06, 0.08);
  }

  function dash() {
    _play('sawtooth', 600, 0.05, 0.12);
    _play('square', 400, 0.07, 0.05, 200);
  }

  function death() {
    // Descending buzz
    try {
      const c = _ctx(); if(!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, c.currentTime+0.3);
      gain.gain.setValueAtTime(0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+0.3);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.31);
    } catch(e) {}
  }

  function stomp() {
    _play('square', 200, 0.1, 0.1);
    setTimeout(()=>_play('square', 400, 0.06, 0.06), 50);
  }

  function spring() {
    try {
      const c = _ctx(); if(!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, c.currentTime+0.12);
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+0.15);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.16);
    } catch(e) {}
  }

  function finish() {
    // Victory arpeggio
    const notes = [400,500,600,800];
    notes.forEach((f,i) => setTimeout(()=>_play('square',f,0.1,0.08), i*80));
  }

  function click() {
    _play('sine', 800, 0.04, 0.04);
  }

  function nearMiss() {
    _play('sawtooth', 250, 0.06, 0.06);
  }

  function countdown() {
    _play('square', 440, 0.1, 0.08);
  }
  function go() {
    _play('square', 660, 0.15, 0.12);
    setTimeout(()=>_play('square', 880, 0.1, 0.08), 60);
  }

  // Resume audio context on user interaction (required by browsers)
  document.addEventListener('click', ()=>{ try{_ctx()&&ctx.state==='suspended'&&ctx.resume();}catch(e){} }, {once:false});
  document.addEventListener('touchstart', ()=>{ try{_ctx()&&ctx.state==='suspended'&&ctx.resume();}catch(e){} }, {once:false});

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch(e) {}
    if (muted && ctx) { try { ctx.suspend(); } catch(e) {} }
    else if (!muted && ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch(e) {} }
  }
  function isMuted() { return muted; }
  function toggleMute() { setMuted(!muted); return muted; }

  return { jump, land, dash, death, stomp, spring, finish, click, nearMiss, countdown, go,
           setMuted, isMuted, toggleMute };
})();
