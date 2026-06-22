const TILE_SIZE = 32;

const PHYSICS = {
  GRAVITY: 2200,
  MAX_RUN_SPEED: 240,
  RUN_ACCEL: 1800,
  RUN_FRICTION: 2000,
  AIR_ACCEL: 1080,
  JUMP_VELOCITY: -780,
  JUMP_CUT: 0.40,
  DASH_SPEED: 520,
  DASH_DURATION: 0.14,
  WALL_SLIDE_MAX: 120,
  WALL_JUMP_X: 260,
  WALL_JUMP_Y: -720,
  TERMINAL_FALL: 900,
  COYOTE_TIME: 0.08,
  JUMP_BUFFER: 0.12,
  CORNER_CORRECTION: 4,
};

const MEDAL_COLORS = {
  author: '#e8ff47',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  null: '#555555',
};

const COLORS = {
  BG: 0x0a0a0f,
  TILE_GROUND: 0x2a2a3f,
  TILE_GROUND_TOP: 0x3a3a5f,
  TILE_SPIKE: 0xff3355,
  TILE_SAW: 0xff6600,
  TILE_SPRING: 0x44ff88,
  TILE_CRUSHER: 0xff4444,
  TILE_PLATFORM: 0x4a4a6f,
  TILE_DISAPPEAR: 0x8844ff,
  TILE_FLAG: 0xe8ff47,
  PLAYER: 0xe8ff47,
  GHOST: 0x4488ff,
  GRAVE: 0x6655ff,
  DASH_TRAIL: 0xe8ff47,
  NEAR_MISS: 0xff3355,
  TIMER: 0xffffff,
  TIMER_AHEAD: 0x44ff88,
  TIMER_BEHIND: 0xff3355,
};

const TAUNTS = ['skill issue', 'so close', 'ez', 'rage', 'rip', '💀', 'not today', 'nice try'];

const TILE_TYPES = ['ground', 'spike', 'saw', 'spring', 'crusher', 'platform', 'disappear', 'flag', 'wall'];
