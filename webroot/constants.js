const TILE_SIZE = 32;

const PHYSICS = {
  GRAVITY: 2000,          // slightly less floaty
  MAX_RUN_SPEED: 260,     // snappier
  RUN_ACCEL: 2000,        // faster acceleration
  RUN_FRICTION: 2200,     // quick stop
  AIR_ACCEL: 1200,        // more air control (feels better)
  JUMP_VELOCITY: -800,    // higher jump
  JUMP_CUT: 0.35,         // variable jump: stronger cut = more control
  DASH_SPEED: 540,        // punchy dash
  DASH_DURATION: 0.13,
  WALL_SLIDE_MAX: 100,    // slower wall slide
  WALL_JUMP_X: 280,
  WALL_JUMP_Y: -740,
  TERMINAL_FALL: 950,
  COYOTE_TIME: 0.10,      // generous coyote (110ms feels fair)
  JUMP_BUFFER: 0.14,      // generous buffer
  CORNER_CORRECTION: 6,   // bigger correction = fewer frustrating bumps
};

// Tile types: id, label, icon, color (hex number), solid
const TILE_DEFS = [
  { id:'ground',    label:'GROUND',   icon:'⬛', color:0x2a2a4f, solid:true,  hazard:false, special:null },
  { id:'spike',     label:'SPIKE',    icon:'▲', color:0xff3355, solid:false, hazard:true,  special:null },
  { id:'saw',       label:'SAW',      icon:'⚙', color:0xff6600, solid:false, hazard:true,  special:null },
  { id:'goomba',    label:'GOOMBA',   icon:'👾', color:0xaa4400, solid:false, hazard:true,  special:'enemy' },
  { id:'spring',    label:'SPRING',   icon:'🔼', color:0x44ff88, solid:false, hazard:false, special:'spring' },
  { id:'platform',  label:'PLATFORM', icon:'▬', color:0x4a4a7f, solid:true,  hazard:false, special:null },
  { id:'disappear', label:'VANISH',   icon:'◌', color:0x8844ff, solid:false, hazard:false, special:'disappear' },
  { id:'crusher',   label:'CRUSHER',  icon:'⬇', color:0xff4444, solid:false, hazard:true,  special:'crusher' },
  { id:'wall',      label:'WALL',     icon:'█', color:0x1a1a3f, solid:true,  hazard:false, special:null },
  { id:'flag',      label:'FINISH',   icon:'🚩', color:0xe8ff47, solid:false, hazard:false, special:'flag' },
];

const TILE_MAP = {};
TILE_DEFS.forEach(t => TILE_MAP[t.id] = t);

// Pre-seeded courses
const MEDAL_EASY   = { bronze:60000, silver:45000, gold:30000, author:20000 };
const MEDAL_MEDIUM = { bronze:90000, silver:65000, gold:45000, author:30000 };
const MEDAL_HARD   = { bronze:120000, silver:90000, gold:60000, author:40000 };

const MEDAL_COLORS = {
  author: '#e8ff47', gold: '#ffd700', silver: '#c0c0c0', bronze: '#cd7f32', null: '#555566',
};

const COLORS = {
  BG: 0x07070f,
  PLAYER: 0xe8ff47,
  GHOST: 0x4488ff,
  GRAVE: 0x6655ff,
  DASH_TRAIL: 0xe8ff47,
};

const TAUNTS = ['skill issue', 'so close', 'ez', 'rage quit', 'oof', 'not today', 'nice try', 'lol'];

function toast(msg, type) {
  var el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'show' + (type ? ' '+type : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 2500);
}
