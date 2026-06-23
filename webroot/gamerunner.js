// ═══════════════════════════════════════════════════════════════
// TRAPLINE — Game Runner  (complete rewrite)
// - Proper character with animation states
// - Shrunk hazard hitbox (no more phantom deaths)
// - Hitstop death sequence + WASTED overlay
// - Countdown start (3-2-1-GO)
// - Parallax background
// - Mobile touch controls
// - Disappearing platforms with timer
// - Crusher that actually moves
// - Near-miss red flash
// - Run dust + dash trail particles
// - Smooth lerp camera with look-ahead
// - Fixed ghost playback
// ═══════════════════════════════════════════════════════════════

const GameRunner = (function() {
  let game = null;
  let _course = null;
  let _opts = {};
  let _W = 480;
  let _H = 584;

  const P = PHYSICS;
  const T = TILE_SIZE;

  // ── Hazard hitbox is SMALLER than physics body ──
  // This prevents phantom deaths from near-misses
  const HAZARD_INSET = 4; // px inset on each side for hazard collision

  // ─────────────────────────────────────────────────────────────
  // PHYSICS STEP
  // ─────────────────────────────────────────────────────────────
  function physStep(body, input, tileMap, crushers, disappearing, dt) {
    body._acc = (body._acc||0) + dt;
    const events = [];
    const fixed = 1/60;
    while (body._acc >= fixed) {
      body._acc -= fixed;
      _tick(body, input, tileMap, crushers, disappearing, fixed, events);
    }
    return events;
  }

  function _tick(body, input, tileMap, crushers, disappearing, dt, events) {
    if (body.dead || body.finished) return;

    if (body.coyote>0)  body.coyote  -= dt;
    if (body.jbuffer>0) body.jbuffer -= dt;
    if (body.dashT>0)   body.dashT   -= dt;
    if (body.invincible>0) body.invincible -= dt;

    if (body.onGround) body.coyote = P.COYOTE_TIME;
    if (input.jumpPressed) body.jbuffer = P.JUMP_BUFFER;

    // ── Movement ──
    if (body.dashT > 0) {
      body.vx = body.dashVx;
      body.vy = body.dashVy;
    } else {
      const targetVx = input.right ? P.MAX_RUN_SPEED : input.left ? -P.MAX_RUN_SPEED : 0;
      const accel = body.onGround ? P.RUN_ACCEL : P.AIR_ACCEL;
      body.vx = targetVx !== 0
        ? _toward(body.vx, targetVx, accel * dt)
        : _toward(body.vx, 0, P.RUN_FRICTION * dt);

      body.vy += P.GRAVITY * dt;

      // Wall slide
      if (body.onWall && !body.onGround && body.vy > 0) {
        if ((body.onWall===-1&&input.left)||(body.onWall===1&&input.right))
          body.vy = Math.min(body.vy, P.WALL_SLIDE_MAX);
      }
      body.vy = Math.min(body.vy, P.TERMINAL_FALL);

      // Jumps
      const canJump = (body.onGround || body.coyote>0) && body.jbuffer>0;
      const canWall  = body.onWall && !body.onGround && body.jbuffer>0;
      if (canJump) {
        body.vy = P.JUMP_VELOCITY; body.jbuffer=0; body.coyote=0;
        events.push('jump');
      } else if (canWall) {
        body.vy=P.WALL_JUMP_Y; body.vx=P.WALL_JUMP_X*-body.onWall;
        body.jbuffer=0; body.dashAvail=true;
        events.push('jump');
      }

      // Variable jump height
      if (!input.jumpHeld && body.vy < 0)
        body.vy *= Math.pow(P.JUMP_CUT, dt*60);

      // Dash
      if (input.dashPressed && body.dashAvail) {
        body.dashAvail = false; body.dashT = P.DASH_DURATION;
        const dx = input.right?1:input.left?-1:(body.facing||1);
        body.dashVx = dx*P.DASH_SPEED;
        body.dashVy = body.vy<0 ? body.vy*0.3 : 0;
        body.vx=body.dashVx; body.vy=body.dashVy;
        events.push('dash');
      }
    }

    // ── Move + collide ──
    const prevVy = body.vy;
    body.x += body.vx * dt;
    _collide(body, tileMap, crushers, disappearing, 'x', events);
    body.y += body.vy * dt;
    const wasGround = body.onGround;
    body.onGround = false; body.onWall = 0;
    _collide(body, tileMap, crushers, disappearing, 'y', events);

    // Landing event
    if (!wasGround && body.onGround && prevVy > 200) events.push('land');

    if (body.onGround || body.onWall) body.dashAvail = true;
  }

  function _collide(body, tileMap, crushers, disappearing, axis, events) {
    // Full body AABB for solid collision
    const bx0=body.x, by0=body.y, bx1=bx0+body.w, by1=by0+body.h;
    // Smaller AABB for hazard detection
    const hx0=bx0+HAZARD_INSET, hy0=by0+HAZARD_INSET;
    const hx1=bx1-HAZARD_INSET, hy1=by1-HAZARD_INSET;

    const tx0=Math.floor(bx0/T), tx1=Math.floor((bx1-1)/T);
    const ty0=Math.floor(by0/T), ty1=Math.floor((by1-1)/T);

    for (let tx=tx0; tx<=tx1; tx++) {
      for (let ty=ty0; ty<=ty1; ty++) {
        const type = tileMap.get(tx+','+ty);
        if (!type) continue;
        const def = TILE_MAP[type];
        if (!def) continue;

        const wx0=tx*T, wy0=ty*T, wx1=wx0+T, wy1=wy0+T;

        // Hazard: use shrunken hitbox
        if (def.hazard) {
          if (body.invincible > 0) continue;
          if (hx1>wx0&&hx0<wx1&&hy1>wy0&&hy0<wy1) {
            if (!events.includes('death')) events.push('death');
          }
          continue;
        }

        if (def.special==='flag') {
          if (hx1>wx0&&hx0<wx1&&hy1>wy0&&hy0<wy1)
            if (!events.includes('finish')) events.push('finish');
          continue;
        }

        if (def.special==='spring' && axis==='y' && body.vy>0) {
          if (bx1>wx0&&bx0<wx1&&by1>wy0&&by0<wy1) {
            body.vy = -1200; events.push('spring'); continue;
          }
        }

        if (def.special==='disappear') {
          // Only solid from above when falling onto it
          if (axis==='y' && body.vy>=0 && bx1>wx0&&bx0<wx1&&by1>wy0&&by0<wy1) {
            body.y=wy0-body.h; body.vy=0; body.onGround=true;
            // Mark to start disappearing
            const key=tx+','+ty;
            if (!disappearing.get(key)) disappearing.set(key, 1.2); // seconds until gone
          }
          continue;
        }

        if (!def.solid) continue;

        // Solid collision
        if (axis==='x') {
          if (body.vx>0 && bx1>wx0 && bx0<wx1) {
            body.x=wx0-body.w; body.vx=0; body.onWall=1;
          } else if (body.vx<0 && bx0<wx1 && bx1>wx0) {
            body.x=wx1; body.vx=0; body.onWall=-1;
          }
        } else {
          if (body.vy>0 && by1>wy0 && by0<wy1) {
            body.y=wy0-body.h; body.vy=0; body.onGround=true;
          } else if (body.vy<0 && by0<wy1 && by1>wy0) {
            const ol=bx1-wx0, or_=wx1-bx0;
            if (Math.min(ol,or_)<=P.CORNER_CORRECTION) body.x += ol<or_?-ol:or_;
            else { body.y=wy1; body.vy=0; }
          }
        }
      }
    }

    // Crusher collision (dynamic objects)
    crushers.forEach(c => {
      const cx0=c.x,cy0=c.y,cx1=cx0+T-4,cy1=cy0+c.h;
      if (bx1>cx0&&bx0<cx1&&by1>cy0&&by0<cy1) {
        if (axis==='y' && body.vy>=0) {
          body.y=cy0-body.h; body.vy=0; body.onGround=true;
        } else {
          if (!events.includes('death')) events.push('death');
        }
      }
    });
  }

  function _toward(cur, target, delta) {
    return Math.abs(target-cur)<=delta ? target : cur+Math.sign(target-cur)*delta;
  }

  // ─────────────────────────────────────────────────────────────
  // ENEMY AI
  // ─────────────────────────────────────────────────────────────
  function updateEnemies(enemies, tileMap, dt) {
    enemies.forEach(e => {
      if (e.dead) return;
      e.x += e.vx * dt;
      e.animT = (e.animT||0) + dt;

      const frontX = e.vx > 0 ? Math.floor((e.x+e.w)/T) : Math.floor(e.x/T);
      const midY   = Math.floor((e.y+e.h-2)/T);
      if (tileMap.get(frontX+','+midY)) e.vx *= -1;
      else if (!tileMap.get(frontX+','+(midY+1))) e.vx *= -1;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // NEAR-MISS DETECTION
  // ─────────────────────────────────────────────────────────────
  function checkNearMiss(body, tileMap) {
    const NEAR = 6;
    const cx = body.x + body.w/2, cy = body.y + body.h/2;
    const txC = Math.floor(cx/T), tyC = Math.floor(cy/T);
    for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) {
      const type = tileMap.get((txC+dx)+','+(tyC+dy));
      if (!type) continue;
      const def = TILE_MAP[type];
      if (!def || !def.hazard) continue;
      const tx0=(txC+dx)*T, ty0=(tyC+dy)*T;
      const distX = Math.max(0, Math.max(tx0-(body.x+body.w), body.x-tx0-T));
      const distY = Math.max(0, Math.max(ty0-(body.y+body.h), body.y-ty0-T));
      if (distX < NEAR && distY < NEAR) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // PHASER SCENE
  // ─────────────────────────────────────────────────────────────
  class RunScene extends Phaser.Scene {
    constructor() { super('Run'); }
    init() {
      // _course and _opts are set at module scope by launch() before Phaser boots
    }

    create() {
      const W = _W, H = _H;

      // Safety: if _course is missing, show error and bail
      if (!_course || !_course.tiles) {
        this.add.text(W/2, H/2, 'ERROR: No course data\n_course='+String(_course), {fontSize:'14px',color:'#ff3355',wordWrap:{width:W-20}}).setOrigin(0.5);
        return;
      }

      // ── Parallax background ──
      this._buildBackground(W, H);

      // ── Build tile map + enemies ──
      this.tileMap = new Map();
      this.enemies = [];
      this.crusherDefs = []; // static positions
      this.crushers = [];    // live state with y
      this.disappearing = new Map(); // key → timer

      (_course.tiles||[]).forEach(t => {
        if (t.type==='goomba') {
          this.enemies.push({x:t.x*T, y:(t.y)*T-2, w:T-4, h:T-4, vx:55, dead:false, gfx:null, animT:0});
        } else if (t.type==='crusher') {
          this.crusherDefs.push({tx:t.x, ty:t.y});
          this.crushers.push({x:t.x*T+2, y:t.y*T, baseY:t.y*T, h:T, phase:Math.random()*Math.PI*2});
        } else {
          this.tileMap.set(t.x+','+t.y, t.type);
        }
      });

      // ── Draw world decorations behind tiles ──
      this.decoGfx = this.add.graphics().setDepth(1);
      this._drawDecorations();

      // ── Draw static tiles ──
      this.tileGfx = this.add.graphics().setDepth(2);
      this._drawAllTiles();

      // ── Crusher graphics ──
      this.crusherGfxList = this.crushers.map(c => {
        const g = this.add.graphics().setDepth(3);
        this._drawCrusher(g, 0, 0);
        return g;
      });

      // ── Enemy graphics ──
      this.enemies.forEach(e => {
        e.gfx = this.add.graphics().setDepth(5);
        this._drawEnemyGfx(e.gfx, 1);
        e.gfx.setPosition(e.x+e.w/2, e.y+e.h/2);
      });

      // ── Saw animation ──
      this.sawGfx = [];
      this.sawAngle = 0;
      this.tileMap.forEach((type, key) => {
        if (type==='saw') {
          const [tx,ty]=key.split(',').map(Number);
          this.sawGfx.push({g:this.add.graphics().setDepth(4), tx, ty});
        }
      });

      // ── Disappear platform gfx ──
      this.disappearGfxMap = new Map();
      this.tileMap.forEach((type, key) => {
        if (type==='disappear') {
          const [tx,ty]=key.split(',').map(Number);
          const g = this.add.graphics().setDepth(3);
          this._drawDisappearPlatform(g, tx*T, ty*T, 1);
          this.disappearGfxMap.set(key, g);
        }
      });

      // ── Spawn ──
      this._findSpawn();

      // ── Player body (physics) ──
      this.body = {
        x:this.spawnX-7, y:this.spawnY-20, w:14, h:20,
        vx:0, vy:0, onGround:false, onWall:0,
        dashAvail:true, dashT:0, dashVx:0, dashVy:0,
        coyote:0, jbuffer:0, facing:1, dead:false, finished:false,
        _acc:0, invincible:0,
      };

      // Visual state
      this.playerAnim = {
        scaleX:1, scaleY:1,     // squash/stretch
        legPhase:0,              // running leg animation
        capeAngle:0,             // cape/scarf drag
        eyeY:0,                  // eye squish
      };

      // ── Player graphics ──
      this.playerGfx = this.add.graphics().setDepth(10);
      this.dashTrailGfx = this.add.graphics().setDepth(9);
      this.trailParticles = [];

      // ── Ghost ──
      this.ghostFrames = []; this.ghostIdx = 0;
      this.ghostGfx = this.add.graphics().setDepth(8).setAlpha(0.4);

      // ── Graveyard ──
      this.graveyardGfx = this.add.graphics().setDepth(3);

      // ── Near-miss vignette (screen-space red flash; cameras have no tint API) ──
      this.vignette = this.add.rectangle(_W/2, _H/2, _W, _H, 0xff3355)
        .setAlpha(0).setScrollFactor(0).setDepth(40);

      // ── Input — use WINDOW-level key listeners (bypasses iframe focus issues) ──
      this.paused = false;
      this.keys = {left:false,right:false,up:false,down:false,shift:false,space:false,esc:false};
      this.keysJust = {up:false,space:false,shift:false,restart:false};

      var self = this;
      this._onKeyDown = function(e) {
        if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') self.keys.left=true;
        if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') self.keys.right=true;
        if(e.key==='ArrowUp'||e.key==='w'||e.key==='W'||e.key===' ') { self.keys.up=true; self.keysJust.up=true; self.keysJust.space=true; }
        if(e.key==='Shift') { self.keys.shift=true; self.keysJust.shift=true; }
        if(e.key==='Escape') self.keys.esc=true;
        if(e.key==='r'||e.key==='R') self.keysJust.restart=true;
        if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') self.keys.down=true;
        e.preventDefault();
      };
      this._onKeyUp = function(e) {
        if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') self.keys.left=false;
        if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') self.keys.right=false;
        if(e.key==='ArrowUp'||e.key==='w'||e.key==='W'||e.key===' ') self.keys.up=false;
        if(e.key==='Shift') self.keys.shift=false;
        if(e.key==='Escape') self.keys.esc=false;
        if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') self.keys.down=false;
      };
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);

      // Make the canvas keyboard-focusable so window key listeners actually
      // fire inside the Devvit iframe (which otherwise swallows key events).
      try { if (this.game.canvas) { this.game.canvas.tabIndex = 0; this.game.canvas.focus(); } } catch(e) {}

      // Tap/click anywhere on canvas = jump (and (re)grab keyboard focus)
      this.input.on('pointerdown', function(){
        try { self.game.canvas && self.game.canvas.focus(); } catch(e) {}
        self.keysJust.up=true; self.keys.up=true;
      });
      this.input.on('pointerup', function(){ self.keys.up=false; });

      // Tap timer to pause (HUD element)
      const timerEl = document.getElementById('hud-timer');
      if (timerEl) timerEl.style.cursor='pointer';
      timerEl && timerEl.addEventListener('click', ()=>this._togglePause());

      // Mobile touch state (injected by HTML overlay)
      this.touch = { left:false, right:false, jump:false, dash:false,
                     jumpJustPressed:false, dashJustPressed:false };
      this._setupMobileControls();

      // ── State machine ──
      this.phase = 'countdown';
      this.countdownVal = 3;
      this.countdownTimer = Date.now() + 700; // wall-clock ms
      this.started = false;
      this.startMs = 0;
      this.elapsed = 0;
      this.deaths = 0;
      this.deathAnimTimer = 0;
      this.nearMissTimer = 0;
      this.replayFrames = [];

      // ── Camera state ──
      this.camX = this.body.x;
      this.camY = this.body.y;
      const maxTX = this._maxTX(), maxTY = this._maxTY();
      this.wW = Math.max((maxTX+6)*T, W*2);
      this.wH = Math.max((maxTY+6)*T, H*2);
      this.cameras.main.setBounds(0, 0, this.wW, this.wH);

      // ── HUD init ──
      this.ghostDeltaIdx = 0;
      this._setGhostHud('');
      this._updateHud();
      this._setMedalTicks();

      // ── Countdown text ──
      this.cdText = this.add.text(_W/2, _H*0.38, '3', {
        fontSize:'96px', fontFamily:'Share Tech Mono,Courier New',
        color:'#e8ff47', stroke:'#000', strokeThickness:8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
      this.cdSub = this.add.text(_W/2, _H*0.52, 'MOVE TO START THE CLOCK', {
        fontSize:'14px', fontFamily:'Share Tech Mono,Courier New',
        color:'#888899', letterSpacing:4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

      // ── Async data ──
      rpc('GET_GHOST',{courseId:_course.id},'GHOST_DATA')
        .then(d=>{ if(d.ghost&&d.ghost.length) this.ghostFrames=d.ghost; })
        .catch(()=>{});
      rpc('GET_DEATH_GRAVEYARD',{courseId:_course.id},'GRAVEYARD_DATA')
        .then(d=>{ if(d.markers) this._drawGraveyard(d.markers); })
        .catch(()=>{});

      // ── Flag wave animation ──
      this.flagWave = 0;
      this._setupFlagAnimation();

      // Player spawns on the ground immediately — no countdown
      this.body.y = this.spawnY - 20;
      this.body.vy = 0;
    }

    // ─── World decorations ───
    _drawDecorations() {
      const g = this.decoGfx; g.clear();
      // Find all ground tiles and add details under/around them
      this.tileMap.forEach((type, key) => {
        if (type !== 'ground' && type !== 'wall') return;
        const [tx,ty] = key.split(',').map(Number);
        const px=tx*T, py=ty*T;
        // Darker underground fill below ground
        g.fillStyle(0x0d0d22,1);
        g.fillRect(px, py+T, T-1, T*2);
        // Edge highlight on left side for depth
        g.fillStyle(0x0a0a1a,0.4);
        g.fillRect(px+T-2, py, 2, T);
      });
      // Random stars/lights in background
      const seed = (_course && _course.id) ? _course.id.charCodeAt(0) : 42;
      for(let i=0;i<40;i++){
        const sx = ((seed*i*317)%2000);
        const sy = ((seed*i*197)%800) - 200;
        const r = ((seed*i)%3)+1;
        g.fillStyle(0xffffff, 0.04+((seed*i)%8)*0.01);
        g.fillCircle(sx,sy,r);
      }
    }

    // ─── Flag animation ───
    _setupFlagAnimation() {
      this.flagGfxMap = new Map();
      this.tileMap.forEach((type, key) => {
        if (type==='flag') {
          const [tx,ty]=key.split(',').map(Number);
          const g=this.add.graphics().setDepth(6);
          this.flagGfxMap.set(key, {g, tx, ty});
        }
      });
    }

    _updateFlags(t) {
      this.flagGfxMap.forEach(({g,tx,ty}) => {
        g.clear();
        const px=tx*T, py=ty*T;
        g.fillStyle(0xe8ff47); g.fillRect(px+T/2-1,py,3,T);
        // Waving flag
        const wave = Math.sin(t*3)*4;
        g.fillStyle(0xe8ff47,0.9);
        g.fillTriangle(
          px+T/2+2, py+2,
          px+T/2+18+wave, py+9,
          px+T/2+2, py+18
        );
        // Glow
        g.fillStyle(0xe8ff47,0.15);
        g.fillCircle(px+T/2, py+T/2, T*0.8);
      });
    }

    // ─── Background ───
    _buildBackground(W, H) {
      // Layer 0: deep space gradient (fixed)
      const bg = this.add.graphics().setScrollFactor(0).setDepth(0);
      bg.fillStyle(0x07070f,1);
      bg.fillRect(0,0,W,H);

      // Layer 1: distant pillars (slow parallax)
      this.bgLayer1 = this.add.graphics().setScrollFactor(0.05, 0.02).setDepth(0);
      for (let i=0;i<12;i++) {
        const px = (i*180+40)%2000;
        const ph = 60+((i*137)%120);
        this.bgLayer1.fillStyle(0x0f0f2a,1);
        this.bgLayer1.fillRect(px, H-ph, 18, ph);
      }

      // Layer 2: mid buildings (medium parallax)
      this.bgLayer2 = this.add.graphics().setScrollFactor(0.2, 0.05).setDepth(0);
      for (let i=0;i<20;i++) {
        const px=(i*120+20)%2500;
        const ph=80+((i*97)%200);
        this.bgLayer2.fillStyle(0x0a0a22,1);
        this.bgLayer2.fillRect(px,H-ph,30,ph);
        // Window lights
        for(let wy=H-ph+8;wy<H-8;wy+=16){
          for(let wx=px+4;wx<px+26;wx+=10){
            if((wx+wy)%3!==0) continue;
            this.bgLayer2.fillStyle(0xe8ff47,0.15);
            this.bgLayer2.fillRect(wx,wy,4,6);
          }
        }
      }

    }

    // ─── Tile drawing ───
    _drawAllTiles() {
      const g = this.tileGfx; g.clear();
      this.tileMap.forEach((type, key) => {
        const [tx,ty]=key.split(',').map(Number);
        // Skip disappear (animated separately) and flag (animated separately)
        if (type!=='disappear' && type!=='flag') this._drawTile(g, tx*T, ty*T, type);
      });
    }

    _drawTile(g, px, py, type) {
      switch(type) {
        case 'ground':
          // Dark body with bright top edge (grass/terrain look)
          g.fillStyle(0x1a1a38); g.fillRect(px,py+4,T-1,T-4);
          g.fillStyle(0x2a2a55); g.fillRect(px,py+2,T-1,2);
          g.fillStyle(0x44ff88); g.fillRect(px,py,T-1,2); // green grass top
          // subtle inner shadow
          g.fillStyle(0x111128,0.5); g.fillRect(px+1,py+5,T-3,2);
          break;
        case 'wall':
          g.fillStyle(0x151530); g.fillRect(px,py,T-1,T-1);
          // Brick lines
          g.fillStyle(0x1e1e3a);
          g.fillRect(px,py+T/2-1,T-1,2);
          g.fillRect(px+T/2,py,1,T/2-1);
          g.fillRect(px+T/4,py+T/2+1,1,T/2-2);
          break;
        case 'platform':
          g.fillStyle(0x4a4a8f); g.fillRect(px,py,T-1,8);
          g.fillStyle(0x6666aa); g.fillRect(px,py,T-1,3);
          break;
        case 'spike':
          g.fillStyle(0xff3355,0.12); g.fillRect(px,py,T,T);
          g.fillStyle(0xff3355); g.fillTriangle(px+T/2,py+2, px+T-4,py+T-2, px+4,py+T-2);
          // Glow
          g.fillStyle(0xff3355,0.2); g.fillTriangle(px+T/2,py, px+T-2,py+T, px+2,py+T);
          break;
        case 'saw':
          // Drawn live in update
          break;
        case 'spring':
          g.fillStyle(0x224433); g.fillRect(px+2,py+2,T-4,T-4);
          g.fillStyle(0x44ff88); g.fillRect(px+4,py+T-8,T-8,8);
          for(let i=0;i<4;i++){
            g.fillStyle(i%2===0?0x33cc66:0x22aa44);
            g.fillRect(px+5,py+T*0.25+i*7,T-10,5);
          }
          break;
        case 'crusher':
          // Drawn live in update
          break;
        case 'flag':
          g.fillStyle(0xe8ff47); g.fillRect(px+T/2-1,py,3,T);
          g.fillStyle(0xe8ff47);
          g.fillTriangle(px+T/2+2,py+2, px+T/2+18,py+9, px+T/2+2,py+18);
          g.fillStyle(0xffffff,0.3);
          g.fillTriangle(px+T/2+2,py+2, px+T/2+10,py+6, px+T/2+2,py+10);
          break;
      }
    }

    _drawCrusher(g, px, py) {
      g.clear();
      g.fillStyle(0xcc2222); g.fillRect(px+2,py,T-4,T);
      // Danger stripes
      g.fillStyle(0xff4444);
      for(let i=0;i<4;i++) g.fillRect(px+4+i*7,py+2,5,T-4);
      // Bottom spike
      g.fillStyle(0xff2222); g.fillTriangle(px+T/2,py+T+8, px+4,py+T, px+T-4,py+T);
      // Glow pulse (static)
      g.lineStyle(2,0xff4444,0.5); g.strokeRect(px+2,py,T-4,T);
    }

    _drawDisappearPlatform(g, px, py, alpha) {
      g.clear();
      g.fillStyle(0x8844ff, alpha*0.5); g.fillRect(px,py,T-1,7);
      g.fillStyle(0xaa66ff, alpha); g.fillRect(px,py,T-1,3);
      // Dashed look
      for(let i=0;i<T;i+=8){
        g.fillStyle(0x6622cc, alpha*0.4);
        g.fillRect(px+i,py+3,4,4);
      }
    }

    _drawEnemyGfx(g, facing) {
      g.clear();
      const F = facing;
      // Shadow
      g.fillStyle(0x000000,0.2); g.fillEllipse(0,12,T-2,6);
      // Body
      g.fillStyle(0xaa3300); g.fillEllipse(0,4,T-2,T/2+2);
      // Head
      g.fillStyle(0xcc4400); g.fillCircle(0,-2,T/2-4);
      // Shell/back
      g.fillStyle(0x882200); g.fillEllipse(0,-1,T-6,T/2);
      // Eyes
      const ex = F*4;
      g.fillStyle(0xffffff); g.fillCircle(ex-3,-4,4); g.fillCircle(ex+3,-4,4);
      g.fillStyle(0x330000); g.fillCircle(ex-3,-3,2); g.fillCircle(ex+3,-3,2);
      // Angry brows
      g.lineStyle(2,0x110000,1);
      g.beginPath(); g.moveTo(ex-6,-8); g.lineTo(ex-1,-6); g.strokePath();
      g.beginPath(); g.moveTo(ex+6,-8); g.lineTo(ex+1,-6); g.strokePath();
      // Feet
      g.fillStyle(0xaa3300);
      g.fillEllipse(-6,12,8,6); g.fillEllipse(6,12,8,6);
    }

    // ─── Player character drawing ───
    _drawPlayerCharacter() {
      const g = this.playerGfx; g.clear();
      const b = this.body;
      const A = this.playerAnim;
      const isDash = b.dashT > 0;
      const isWall = b.onWall !== 0 && !b.onGround;
      const isJump = !b.onGround && !isWall;

      const sx = A.scaleX, sy = A.scaleY;
      const F = b.facing;

      // Squash/stretch: baked into dimensions
      const bw = b.w * sx, bh = b.h * sy;
      const ox = -bw/2, oy = -bh/2;

      // ── Dash trail ──
      if (isDash) {
        for (let i=1;i<=4;i++) {
          g.fillStyle(0xe8ff47, 0.15/i);
          g.fillRect(ox - F*i*9, oy, bw, bh);
        }
      }

      // ── Cape / scarf ──
      const capeX = -F*2, capeW = 10, capeLen = 8+Math.abs(b.vx)/40;
      g.fillStyle(0xff3355, 0.85);
      g.fillTriangle(-F*2+capeX,oy+6, -F*(2+capeLen),oy+6+capeLen*0.3, -F*2+capeX,oy+14);

      // ── Legs (animated when running) ──
      if (b.onGround) {
        const spd = Math.abs(b.vx)/P.MAX_RUN_SPEED;
        A.legPhase += spd * 0.3;
        const l1 = Math.sin(A.legPhase)*5*spd;
        const l2 = Math.sin(A.legPhase+Math.PI)*5*spd;
        g.fillStyle(0xb8cc30);
        g.fillRect(-5, bh/2-4+l1, 5, 8);
        g.fillRect(1,  bh/2-4+l2, 5, 8);
        // Shoes
        g.fillStyle(0xe8ff47);
        g.fillRect(-6,bh/2+2+l1,7,4);
        g.fillRect(0, bh/2+2+l2,7,4);
      } else if (isWall) {
        g.fillStyle(0xb8cc30);
        g.fillRect(-4,bh/2-6,4,8); g.fillRect(1,bh/2-2,4,8);
      } else {
        // Jump: tuck legs
        g.fillStyle(0xb8cc30);
        g.fillRect(ox+2,oy+bh*0.6,5,6);
        g.fillRect(ox+bw-7,oy+bh*0.6,5,6);
      }

      // ── Body ──
      g.fillStyle(isDash ? 0xffffff : 0xe8ff47, isDash ? 1 : 0.95);
      // Rounded by layering rects
      g.fillRect(ox+1, oy, bw-2, bh);
      g.fillRect(ox, oy+1, bw, bh-2);
      // Body shading
      g.fillStyle(0xb8cc30, 0.4);
      g.fillRect(ox+bw*0.6, oy+2, bw*0.25, bh-4);

      // ── Belt / chest stripe ──
      g.fillStyle(0xb8cc30);
      g.fillRect(ox+1, oy+bh*0.45, bw-2, 3);

      // ── Head ──
      g.fillStyle(0xe8ff47);
      g.fillCircle(F*2, oy-6, 10);
      // Helmet
      g.fillStyle(0xb8cc30);
      g.fillRect(F*2-9, oy-16, 18, 8);
      g.fillRect(F*2-7, oy-18, 14, 4);
      // Visor
      g.fillStyle(0x4488ff, 0.8);
      g.fillRect(F*2-5, oy-14, 10, 6);
      g.fillStyle(0xaaccff, 0.5);
      g.fillRect(F*2-4, oy-13, 4, 2);

      // ── Arm ──
      const armAngle = isDash ? -F*0.8 : isJump ? -0.5 : 0.3;
      g.fillStyle(0xb8cc30);
      g.fillRect(F*bw/2-1, oy+4, 4, 9);

      g.setPosition(b.x+b.w/2, b.y+b.h/2);
    }

    // ─── Spawn ───
    _findSpawn() {
      let bestTX=1, bestTY=10, bestX=9999;
      this.tileMap.forEach((type,key) => {
        if (type==='ground'||type==='platform') {
          const [tx,ty]=key.split(',').map(Number);
          if (tx < bestX) { bestX=tx; bestTX=tx; bestTY=ty; }
        }
      });
      // Spawn 2 tiles above the ground tile — simple and safe
      this.spawnX = bestTX*T + T/2;
      this.spawnY = (bestTY-2)*T;
    }


    // ─── Mobile controls ───
    _setupMobileControls() {
      const el = document.getElementById('mobile-controls');
      if (!el) return;
      el.style.display = 'flex';

      const map = {
        'mc-left':  ()=>{ this.touch.left=true; },
        'mc-right': ()=>{ this.touch.right=true; },
        'mc-jump':  ()=>{ this.touch.jump=true; this.touch.jumpJustPressed=true; },
        'mc-dash':  ()=>{ this.touch.dash=true; this.touch.dashJustPressed=true; },
      };
      const unmap = {
        'mc-left':  ()=>{ this.touch.left=false; },
        'mc-right': ()=>{ this.touch.right=false; },
        'mc-jump':  ()=>{ this.touch.jump=false; },
        'mc-dash':  ()=>{ this.touch.dash=false; },
      };
      Object.keys(map).forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', e=>{ e.preventDefault(); map[id](); }, {passive:false});
        btn.addEventListener('touchend',   e=>{ e.preventDefault(); unmap[id](); }, {passive:false});
        btn.addEventListener('mousedown',  ()=>map[id]());
        btn.addEventListener('mouseup',    ()=>unmap[id]());
      });
    }

    // ─── Main update loop (crash-guarded) ───
    // A throw inside update() would otherwise kill Phaser's RAF loop and freeze
    // the whole game on the last rendered frame. Catch it, surface a recoverable
    // message, and stop ticking instead of silently hard-freezing.
    update(time, delta) {
      if (this._crashed) return;
      try {
        this._update(time, delta);
      } catch (err) {
        this._crashed = true;
        try { console.error('[TRAPLINE] update() crashed:', err); } catch(e) {}
        try { this._showCrashOverlay(err); } catch(e) {}
      }
    }

    _update(time, delta) {
      if (!this.body || !this.phase) return; // create() didn't finish
      const dt = Math.min(delta/1000, 0.05);
      this.sawAngle = (this.sawAngle||0) + dt*4;

      // ── Invincibility flash ──
      if (this.body.invincible > 0) {
        const flash = Math.sin(Date.now() * 0.04) > 0;
        this.playerGfx.setAlpha(flash ? 0.4 : 1);
      } else {
        this.playerGfx.setAlpha(1);
      }

      // ── Flag animation ──
      if (this.flagGfxMap) this._updateFlags(time/1000);

      // ── Countdown phase ──
      if (this.phase === 'countdown') {
        this._updateCountdown(dt);
        this._drawPlayerCharacter();
        this._moveCamera(dt);
        return;
      }

      // ── Saw visuals ──
      this.sawGfx.forEach(({g,tx,ty}) => {
        g.clear();
        const cx=tx*T+T/2, cy=ty*T+T/2, r=T/2-2;
        g.fillStyle(0xff6600,0.15); g.fillCircle(cx,cy,r+3);
        g.fillStyle(0xff6600); g.fillCircle(cx,cy,3);
        g.lineStyle(3,0xff6600,0.9); g.strokeCircle(cx,cy,r);
        for(let i=0;i<8;i++){
          const a=this.sawAngle+i*(Math.PI*2/8);
          const a2=this.sawAngle+(i+0.5)*(Math.PI*2/8);
          g.fillStyle(0xff6600);
          g.fillTriangle(cx+Math.cos(a)*r,cy+Math.sin(a)*r,
            cx+Math.cos(a2)*(r+7),cy+Math.sin(a2)*(r+7),
            cx+Math.cos(a2-0.4)*r,cy+Math.sin(a2-0.4)*r);
        }
      });

      // ── Crusher movement ──
      this.crushers.forEach((c,i) => {
        c.phase += dt * 2.2;
        c.y = c.baseY + Math.sin(c.phase) * T * 0.8;
        const g = this.crusherGfxList[i];
        if (g) { this._drawCrusher(g, c.x, c.y); }
      });

      // ── Disappearing platforms ──
      this.disappearing.forEach((timer, key) => {
        const newTimer = timer - dt;
        if (newTimer <= 0) {
          this.tileMap.delete(key);
          this.disappearing.delete(key);
          const dg = this.disappearGfxMap.get(key);
          if (dg) { dg.destroy(); this.disappearGfxMap.delete(key); }
        } else {
          this.disappearing.set(key, newTimer);
          const alpha = Math.max(0.1, newTimer/1.2);
          const dg = this.disappearGfxMap.get(key);
          if (dg) {
            const [tx,ty]=key.split(',').map(Number);
            this._drawDisappearPlatform(dg, tx*T, ty*T, alpha);
          }
        }
      });

      // ─── Quick restart (R / restart button) ───
      if (this.keysJust.restart || this.touch.restart) {
        this.keysJust.restart = false; this.touch.restart = false;
        this._quickRestart();
        return;
      }

      // ─── Pause check ───
      if (this.keys.esc) { this.keys.esc=false; this._togglePause(); }
      if (this.paused) return;

      // ─── Phase: dead_anim ───
      if (this.phase === 'dead_anim') {
        if (Date.now() >= this.deathAnimTimer) this._doRespawn();
        return;
      }

      // ─── Phase: running ───

      // ── Input (window-level keys + touch) ──
      const K = this.keys;
      const KJ = this.keysJust;
      const touch = this.touch;
      const input = {
        left:  K.left || touch.left,
        right: K.right || touch.right,
        jumpPressed: KJ.up || KJ.space || touch.jumpJustPressed,
        jumpHeld: K.up || touch.jump,
        dashPressed: KJ.shift || touch.dashJustPressed,
      };
      // Clear "just pressed" flags after reading
      KJ.up = false; KJ.space = false; KJ.shift = false;
      touch.jumpJustPressed = false;
      touch.dashJustPressed = false;

      if ((input.left||input.right||input.jumpPressed) && !this.started) {
        this.started = true;
        this.startMs = Date.now();
        this._setMedalTicks();
      }
      if (this.started) this.elapsed = Date.now() - this.startMs;

      if (input.right) this.body.facing=1;
      if (input.left)  this.body.facing=-1;

      // ── Physics (skip during hitstop frames) ──
      if (this.hitstopActive) return;
      const events = physStep(this.body, input, this.tileMap, this.crushers, this.disappearing, dt);

      // ── Enemies ──
      updateEnemies(this.enemies, this.tileMap, dt);
      this.enemies.forEach(e => {
        if (e.dead) return;
        const facing = e.vx > 0 ? 1 : -1;
        this._drawEnemyGfx(e.gfx, facing);
        // Walking bob
        e.gfx.setPosition(e.x+e.w/2, e.y+e.h/2 + Math.sin(e.animT*8)*2);

        // Player collision
        const b=this.body;
        if (!b.dead&&!b.finished&&b.x<e.x+e.w&&b.x+b.w>e.x&&b.y<e.y+e.h&&b.y+b.h>e.y) {
          const isStomping = b.vy>50 && (b.y+b.h) < (e.y+e.h*0.55);
          if (isStomping) {
            e.dead=true;
            if (e.gfx) {
              this.tweens.add({targets:e.gfx,scaleY:0,scaleX:2,alpha:0,duration:200,onComplete:()=>e.gfx.destroy()});
            }
            b.vy = -640;
            this._spawnText(e.x+e.w/2, e.y, 'STOMP!', 0xe8ff47);
            events.push('stomp');
          } else if (!events.includes('death')) {
            events.push('death');
          }
        }
      });

      // ── Squash/stretch ──
      const A = this.playerAnim;
      if (events.includes('land')) {
        A.scaleX = 1.5; A.scaleY = 0.6;
        this._spawnLandDust();
        try { Audio.land(); } catch(e) {}
      }
      if (events.includes('jump')) {
        A.scaleX = 0.7; A.scaleY = 1.4;
        try { Audio.jump(); } catch(e) {}
      }
      if (events.includes('dash')) {
        A.scaleX = 1.7; A.scaleY = 0.7;
        this._spawnDashTrail();
        try { Audio.dash(); } catch(e) {}
      }
      if (events.includes('spring')) {
        A.scaleX = 0.6; A.scaleY = 1.6;
        this._spawnText(this.body.x+7, this.body.y, 'BOING!', 0x44ff88);
        try { Audio.spring(); } catch(e) {}
      }
      if (events.includes('stomp')) {
        try { Audio.stomp(); } catch(e) {}
      }
      // Return to normal
      A.scaleX += (1 - A.scaleX) * Math.min(1, dt*14);
      A.scaleY += (1 - A.scaleY) * Math.min(1, dt*14);

      // ── Near miss ──
      if (!events.includes('death') && checkNearMiss(this.body, this.tileMap)) {
        if (this.nearMissTimer <= 0) { try { Audio.nearMiss(); } catch(e) {} }
        this.nearMissTimer = 0.12;
      }
      if (this.nearMissTimer > 0) {
        this.nearMissTimer -= dt;
        // Red vignette flash via screen-space overlay (cameras have no tint API)
        this.vignette.setAlpha(this.nearMissTimer > 0 ? 0.18 : 0);
      } else {
        this.vignette.setAlpha(0);
      }

      // ── Run dust ──
      if (this.body.onGround && Math.abs(this.body.vx) > 100) {
        if (Math.random() < 0.3) this._spawnRunDust();
      }

      // ── Replay recording ──
      if (this.started && this.elapsed%50 < delta) {
        const b=this.body;
        this.replayFrames.push({t:Math.round(this.elapsed),x:b.x,y:b.y,vx:b.vx,vy:b.vy,facing:b.facing});
      }

      // ── Event handling ──
      if (events.includes('death') && !this.body.dead) this._onDeath();
      if (events.includes('finish') && !this.body.finished) this._onFinish();

      // ── Fall out of world ──
      if (this.body.y > this.wH+300 && !this.body.dead) this._onDeath();

      // ── Player draw ──
      this._drawPlayerCharacter();

      // ── Ghost ──
      this._updateGhost();

      // ── Camera ──
      this._moveCamera(dt);

      // ── HUD ──
      if (this.started) this._updateHud();
    }

    // ─── Taunt picker (shown on death, auto-dismiss after 1s) ───
    _showTauntPicker(deathX, deathY, onDone) {
      const W=_W,H=_H;
      const taunts = TAUNTS.slice(0,6);
      const container = document.createElement('div');
      container.style.cssText = [
        'position:fixed','bottom:20%','left:50%','transform:translateX(-50%)',
        'display:flex','gap:6px','z-index:9999','pointer-events:all',
      ].join(';');

      let chosen = null;
      let dismissed = false;
      const dismiss = (taunt) => {
        if (dismissed) return; dismissed=true;
        if (taunt) send('RECORD_DEATH',{courseId:_course.id,
          x:Math.round(deathX/TILE_SIZE),y:Math.round(deathY/TILE_SIZE),taunt});
        container.remove();
        onDone();
      };

      taunts.forEach(t => {
        const btn = document.createElement('button');
        btn.style.cssText = 'background:rgba(14,14,28,0.95);border:1px solid #1e1e3a;color:#888899;font-family:Share Tech Mono,monospace;font-size:10px;padding:4px 8px;border-radius:4px;cursor:pointer;letter-spacing:1px';
        btn.textContent = t;
        btn.addEventListener('click', ()=>dismiss(t));
        btn.addEventListener('touchstart', e=>{e.preventDefault();dismiss(t);},{passive:false});
        btn.addEventListener('mouseover', ()=>{btn.style.borderColor='#e8ff47';btn.style.color='#e8ff47';});
        btn.addEventListener('mouseout', ()=>{btn.style.borderColor='#1e1e3a';btn.style.color='#888899';});
        container.appendChild(btn);
      });
      document.body.appendChild(container);

      // Auto-dismiss after 1.2s if no selection
      setTimeout(()=>dismiss(null), 1200);
    }

    // ─── Pause ───
    _togglePause() {
      this.paused = !this.paused;
      if (this.paused) {
        const W=_W,H=_H;
        this.pauseOverlay = this.add.rectangle(W/2,H/2,W,H,0x000000,0.7).setScrollFactor(0).setDepth(60);
        this.pauseText = this.add.text(W/2,H/2,'PAUSED\n\nTap timer to resume\nESC to resume\n[X] to quit',{
          fontSize:'22px',fontFamily:'Share Tech Mono,Courier New',
          color:'#e8ff47',align:'center',stroke:'#000',strokeThickness:4,
          lineSpacing:8,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
        if(this.started) this.startMs += Date.now() - (this.pausedAt||Date.now());
        this.pausedAt = Date.now();
      } else {
        if(this.pauseOverlay){this.pauseOverlay.destroy();this.pauseOverlay=null;}
        if(this.pauseText){this.pauseText.destroy();this.pauseText=null;}
        if(this.started && this.pausedAt) this.startMs += Date.now()-this.pausedAt;
        this.pausedAt=null;
      }
    }


    // ─── Countdown ───
    _updateCountdown(dt) {
      if (Date.now() < this.countdownTimer) return;
      this.countdownTimer = Date.now() + 700; // next tick in 700ms wall-clock
      this.countdownVal--;

      if (this.countdownVal <= 0) {
        // GO — transition to running
        if (this.cdText) { this.cdText.setText('GO!'); this.cdText.setStyle({color:'#44ff88'}); }
        if (this.cdSub)  { this.cdSub.destroy(); this.cdSub=null; }
        this.phase = 'running';
        try { this.game.canvas.focus(); } catch(e){}
        // Use real setTimeout — Phaser's delayedCall doesn't work reliably in iframes
        var self = this;
        setTimeout(function(){ if(self.cdText){self.cdText.destroy();self.cdText=null;} }, 400);
        return;
      }

      if (this.cdText) { this.cdText.setText(String(this.countdownVal)); }
      this.cameras.main.shake(50, 0.002);
    }

    // ─── Death ───
    _onDeath() {
      if (this.body.dead) return;
      this.body.dead = true;
      this.deaths++;
      this._updateHud();

      const b=this.body;
      const cx=b.x+b.w/2, cy=b.y+b.h/2;

      // HITSTOP — use a real-time setTimeout, NOT Phaser time (which is scaled)
      this.hitstopActive = true;
      setTimeout(() => { this.hitstopActive = false; }, 80);

      // Screen shake
      this.cameras.main.shake(300, 0.015);
      this.cameras.main.flash(100, 255, 50, 50, true);
      try { Audio.death(); } catch(e) {}

      // Hide player
      this.playerGfx.setVisible(false);

      // Burst particles
      const colors = [0xe8ff47, 0xff3355, 0xffffff, 0xb8cc30];
      for (let i=0;i<20;i++) {
        const a=(i/20)*Math.PI*2 + Math.random()*0.3;
        const spd = 120+Math.random()*220;
        const g=this.add.graphics().setDepth(20);
        g.fillStyle(colors[i%4]); g.fillRect(-4,-4,8,8);
        g.setPosition(cx,cy);
        this.tweens.add({
          targets:g,
          x:cx+Math.cos(a)*spd,
          y:cy+Math.sin(a)*spd-60,
          scaleX:0, scaleY:0, alpha:0,
          duration:500+Math.random()*300,
          ease:'Power2',
          onComplete:()=>g.destroy(),
        });
      }

      // WASTED text
      const W=_W, H=_H;
      const wasted=this.add.text(W/2, H*0.38, 'WIPEOUT!', {
        fontSize:'64px', fontFamily:'Share Tech Mono, Courier New',
        color:'#ff3355', stroke:'#000',strokeThickness:6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setScale(0.1).setAlpha(0);

      const taunt = TAUNTS[Math.floor(Math.random()*TAUNTS.length)];
      const tauntTxt = this.add.text(W/2, H*0.5, taunt, {
        fontSize:'18px', fontFamily:'Share Tech Mono, Courier New',
        color:'#888899',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

      const deathNum = this.add.text(W/2, H*0.6, 'wipeout #'+this.deaths, {
        fontSize:'13px', fontFamily:'Share Tech Mono, Courier New',
        color:'#444466',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

      this.tweens.add({targets:wasted, scale:1, alpha:1, duration:300, ease:'Back.easeOut'});
      this.tweens.add({targets:tauntTxt, alpha:1, delay:200, duration:200});
      this.tweens.add({targets:deathNum, alpha:1, delay:300, duration:200});

      // Streak death tracking — same spot 3+ times shows danger zone
      // (RECORD_DEATH is sent via taunt picker or auto on dismiss)
      const dKey = Math.round(cx/T)+','+Math.round(cy/T);
      this.deathSpots = this.deathSpots || {};
      this.deathSpots[dKey] = (this.deathSpots[dKey]||0)+1;
      if (this.deathSpots[dKey] === 3) {
        const g=this.add.graphics().setDepth(4);
        g.lineStyle(2,0xff3355,0.5);
        g.strokeRect(Math.round(cx/T)*T-2, Math.round(cy/T)*T-2, T+4,T+4);
        const dt2=this.add.text(cx,cy-24,'DANGER ZONE',{
          fontSize:'10px',fontFamily:'Share Tech Mono,monospace',
          color:'#ff3355',stroke:'#000',strokeThickness:2,
        }).setOrigin(0.5).setDepth(6).setAlpha(0.7);
        this.dangerTexts=this.dangerTexts||[];
        this.dangerTexts.push(dt2);
      }

      // Auto-respawn after 1.2s
      this.phase = 'dead_anim';
      this.deathAnimTimer = Date.now() + 1200; // wall-clock ms, not Phaser dt

      // Show taunt picker (fire and forget — doesn't control respawn)
      this._showTauntPicker(cx, cy, () => {
        this.tweens.add({targets:[wasted,tauntTxt,deathNum], alpha:0, duration:300, onComplete:()=>{
          if(wasted.scene) wasted.destroy();
          if(tauntTxt.scene) tauntTxt.destroy();
          if(deathNum.scene) deathNum.destroy();
          if(this.vignette) this.vignette.setAlpha(0);
        }});
      });
    }

    _doRespawn() {
      const b=this.body;
      b.x=this.spawnX-7; b.y=this.spawnY-200;
      b.vx=0; b.vy=400; b.dead=false; b.finished=false;
      b.onGround=false; b.onWall=0; b.dashAvail=true; b.dashT=0; b._acc=0;
      b.invincible=1.0; // 1 second invincibility on respawn
      this.replayFrames=[];
      this.elapsed=0;
      this.ghostDeltaIdx=0;
      if(this.started) this.startMs=Date.now();
      this.playerGfx.setVisible(true);
      this.phase='running';
      // Restore disappearing platforms
      this.disappearing.clear();
      this._drawAllTiles();
      _course.tiles.forEach(t => {
        if(t.type==='disappear') {
          const key=t.x+','+t.y;
          if(!this.disappearGfxMap.has(key)) {
            const g=this.add.graphics().setDepth(3);
            this._drawDisappearPlatform(g,t.x*T,t.y*T,1);
            this.disappearGfxMap.set(key,g);
            this.tileMap.set(key,'disappear');
          }
        }
      });
    }

    // ─── Finish ───
    _onFinish() {
      if (this.body.finished) return;
      this.body.finished = true;
      const timeMs = this.elapsed;

      // Confetti burst
      for(let i=0;i<30;i++){
        const g=this.add.graphics().setDepth(25);
        const col=[0xe8ff47,0xff3355,0x44ff88,0x4488ff,0xffffff][i%5];
        g.fillStyle(col); g.fillRect(-3,-3,6,6);
        const a=Math.random()*Math.PI*2;
        const spd=100+Math.random()*200;
        const b=this.body;
        g.setPosition(b.x+7,b.y+10);
        this.tweens.add({targets:g,
          x:b.x+7+Math.cos(a)*spd, y:b.y+10+Math.sin(a)*spd-100,
          alpha:0, rotation:Math.random()*10,
          duration:800+Math.random()*400,
          onComplete:()=>g.destroy()});
      }

      this.cameras.main.flash(180, 80, 255, 80, true);
      this.cameras.main.shake(200, 0.006);
      try { Audio.finish(); } catch(e) {}

      if(_opts.fromEditor) {
        const W=_W, H=_H;
        const clearTxt=this.add.text(W/2,H/2,'COURSE CLEARED!\n'+(timeMs/1000).toFixed(3)+'s',{
          fontSize:'32px',fontFamily:'Share Tech Mono,Courier New',
          color:'#44ff88',stroke:'#000',strokeThickness:5,align:'center',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
        this.tweens.add({targets:clearTxt,y:H/2-30,alpha:0,delay:1200,duration:400,onComplete:()=>{
          clearTxt.destroy();
          App.exitGame();
          toast('Cleared in '+(timeMs/1000).toFixed(3)+'s!');
        }});
        return;
      }

      const hide=document.getElementById('mobile-controls');
      if(hide) hide.style.display='none';

      // Brief celebration overlay before results
      const W=_W, H=_H;
      const medals=_course.medals||MEDAL_EASY;
      let mStr='CLEAR', mCol='#aaaacc';
      if(timeMs<=medals.author){mStr='👑 AUTHOR';mCol='#e8ff47';}
      else if(timeMs<=medals.gold){mStr='🥇 GOLD';mCol='#ffd700';}
      else if(timeMs<=medals.silver){mStr='🥈 SILVER';mCol='#c0c0c0';}
      else if(timeMs<=medals.bronze){mStr='🥉 BRONZE';mCol='#cd7f32';}
      const celebTxt=this.add.text(W/2,H*0.35,mStr,{
        fontSize:'52px',fontFamily:'Share Tech Mono,Courier New',
        color:mCol,stroke:'#000',strokeThickness:6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setScale(0.2).setAlpha(0);
      const timeTxt=this.add.text(W/2,H*0.52,(timeMs/1000).toFixed(3)+'s',{
        fontSize:'28px',fontFamily:'Share Tech Mono,Courier New',color:'#ffffff',stroke:'#000',strokeThickness:4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);
      this.tweens.add({targets:celebTxt,scale:1,alpha:1,duration:300,ease:'Back.easeOut'});
      this.tweens.add({targets:timeTxt,alpha:1,delay:200,duration:250});

      // Save locally first (always works)
      if (typeof LocalState !== 'undefined') LocalState.recordRun(_course.id, timeMs, this.deaths);

      // Delay results screen to show celebration first
      this.time.delayedCall(1400, () => {
        const anonId = (typeof LocalState!=='undefined') ? LocalState.getAnonId() : undefined;
        rpc('SUBMIT_RUN',{courseId:_course.id,timeMs,deathCount:this.deaths,replayData:this.replayFrames,anonId},'RUN_SUBMITTED')
          .then(d=>App.showResults({course:_course,timeMs,deaths:this.deaths,board:d.board||[],ghost:d.ghost}))
          .catch(()=>App.showResults({course:_course,timeMs,deaths:this.deaths,board:[],ghost:null}));
      });
    }

    // ─── Ghost ───
    _updateGhost() {
      if (!this.ghostFrames.length || !this.started) return;
      while (this.ghostIdx+1<this.ghostFrames.length && this.ghostFrames[this.ghostIdx+1].t<=this.elapsed)
        this.ghostIdx++;
      const f=this.ghostFrames[this.ghostIdx];
      this.ghostGfx.clear();
      this.ghostGfx.fillStyle(0x4488ff,0.6);
      this.ghostGfx.fillRect(f.x, f.y, 14, 20);
      this.ghostGfx.lineStyle(1,0x88aaff,0.4);
      this.ghostGfx.strokeRect(f.x,f.y,14,20);
    }

    // ─── Camera ───
    _moveCamera(dt) {
      const b=this.body;
      const W=_W, H=_H;
      const lookAheadX=b.facing*100, lookAheadY=b.vy>0?40:b.vy<-100?-30:0;
      const targetX=b.x+b.w/2+lookAheadX - W/2;
      const targetY=b.y+b.h/2+lookAheadY - H/2;
      this.camX += (targetX-this.camX) * Math.min(1,dt*8);
      this.camY += (targetY-this.camY) * Math.min(1,dt*6);
      const sx=Math.max(0,Math.min(this.camX,this.wW-W));
      const sy=Math.max(0,Math.min(this.camY,this.wH-H));
      this.cameras.main.setScroll(sx,sy);
    }

    // ─── Particles ───
    _spawnLandDust() {
      const b=this.body;
      for(let i=0;i<6;i++){
        const g=this.add.graphics().setDepth(6);
        g.fillStyle(0x888888,0.6);
        g.fillCircle(0,0,3+Math.random()*3);
        const ox=(Math.random()-0.5)*b.w;
        g.setPosition(b.x+b.w/2+ox, b.y+b.h);
        this.tweens.add({targets:g,
          x:b.x+b.w/2+ox+(Math.random()-0.5)*30,
          y:b.y+b.h-20-Math.random()*15,
          alpha:0, scaleX:0, scaleY:0,
          duration:300+Math.random()*200,
          onComplete:()=>g.destroy()});
      }
    }

    _spawnRunDust() {
      const b=this.body;
      const g=this.add.graphics().setDepth(6);
      g.fillStyle(0x666666,0.4);
      g.fillCircle(0,0,2+Math.random()*2);
      g.setPosition(b.x+b.w/2-(b.facing*6), b.y+b.h);
      this.tweens.add({targets:g,
        x:g.x-(b.facing*12+Math.random()*8),
        y:g.y-8-Math.random()*8,
        alpha:0, duration:200+Math.random()*100,
        onComplete:()=>g.destroy()});
    }

    _spawnDashTrail() {
      const b=this.body;
      for(let i=0;i<6;i++){
        const g=this.add.graphics().setDepth(9);
        g.fillStyle(0xe8ff47, 0.6-i*0.08);
        g.fillRect(-7,-10,14,20);
        g.setPosition(b.x+b.w/2+b.facing*i*8, b.y+b.h/2);
        this.tweens.add({targets:g,alpha:0,scaleX:0.3,duration:200+i*30,onComplete:()=>g.destroy()});
      }
    }

    _spawnText(x, y, str, color) {
      const t=this.add.text(x,y,str,{
        fontSize:'14px',fontFamily:'Share Tech Mono,Courier New',
        color:'#'+color.toString(16).padStart(6,'0'),
        stroke:'#000',strokeThickness:3,
      }).setOrigin(0.5).setDepth(22);
      this.tweens.add({targets:t,y:y-40,alpha:0,duration:700,onComplete:()=>t.destroy()});
    }

    // ─── Graveyard ───
    _drawGraveyard(markers) {
      const g=this.graveyardGfx; g.clear();
      // Cluster nearby markers to avoid overlay chaos
      const clusters = new Map();
      markers.forEach(m => {
        const key = Math.round(m.x/2)+','+Math.round(m.y/2);
        if (!clusters.has(key)) clusters.set(key, {x:m.x,y:m.y,count:0,taunt:m.taunt});
        const c = clusters.get(key); c.count++;
        if (m.taunt && !c.taunt) c.taunt = m.taunt;
      });
      clusters.forEach(c => {
        const px=c.x*T+T/2, py=c.y*T;
        // Grave marker
        g.fillStyle(0x4433aa, 0.45);
        g.fillRect(px-5,py-8,10,14);
        g.fillStyle(0x6644cc, 0.4);
        g.fillRect(px-8,py-12,16,6);
        if (c.count > 1) {
          // Show count
          const ct = this.add.text(px,py-16,'×'+c.count,{
            fontSize:'9px',fontFamily:'Share Tech Mono,monospace',
            color:'#6644cc',stroke:'#000',strokeThickness:2,
          }).setOrigin(0.5,1).setDepth(5).setAlpha(0.6);
          this.graveTexts = this.graveTexts||[];
          this.graveTexts.push(ct);
        }
        if (c.taunt) {
          const tt = this.add.text(px,py-28,'"'+c.taunt+'"',{
            fontSize:'8px',fontFamily:'Share Tech Mono,monospace',
            color:'#888888',
          }).setOrigin(0.5,1).setDepth(5).setAlpha(0.5);
          this.graveTexts = this.graveTexts||[];
          this.graveTexts.push(tt);
        }
      });
    }

    // ─── HUD ───
    _updateHud() {
      const ms=this.elapsed;
      const el=document.getElementById('hud-timer');
      if(el) {
        el.textContent=(ms/1000).toFixed(3);
        const medals=_course.medals||MEDAL_EASY;
        const col = !this.started ? '#ffffff'
          : ms<=medals.author ? '#e8ff47'
          : ms<=medals.gold   ? '#44ff88'
          : ms<=medals.bronze ? '#e8ff47'
          : '#ff3355';
        el.style.color=col;
        const fill=document.getElementById('hud-medal-fill');
        if(fill){
          fill.style.width=(Math.min(1,ms/medals.bronze)*100)+'%';
          fill.style.background=col;
        }
      }
      const de=document.getElementById('hud-deaths');
      if(de) de.textContent='💥 '+this.deaths;
      const cn=document.getElementById('hud-course-name');
      if(cn) {
        const pb = typeof LocalState!=='undefined' ? LocalState.getBest(_course.id) : null;
        cn.textContent = _course.title + (pb ? ' · PB:'+(pb.timeMs/1000).toFixed(3)+'s' : '');
      }
      this._updateGhostDelta();
    }

    // Trackmania-style live time-vs-ghost readout. Positive = behind the record.
    _updateGhostDelta() {
      if (!this.started || !this.ghostFrames || !this.ghostFrames.length) { this._setGhostHud(''); return; }
      const px = this.body.x;
      const gf = this.ghostFrames;
      // Advance the cursor to the ghost frame matching the player's x-progress.
      while (this.ghostDeltaIdx+1 < gf.length && gf[this.ghostDeltaIdx+1].x <= px) this.ghostDeltaIdx++;
      while (this.ghostDeltaIdx > 0 && gf[this.ghostDeltaIdx].x > px) this.ghostDeltaIdx--;
      const ghostT = gf[this.ghostDeltaIdx].t;
      const delta = (this.elapsed - ghostT) / 1000; // seconds; +behind / -ahead
      const sign = delta >= 0 ? '+' : '−';
      this._setGhostHud(sign + Math.abs(delta).toFixed(2), delta <= 0);
    }

    _setGhostHud(text, ahead) {
      const el = document.getElementById('hud-ghost');
      if (!el) return;
      if (!text) { el.textContent=''; el.style.display='none'; return; }
      el.style.display='';
      el.textContent='👻 '+text;
      el.style.color = ahead ? '#44ff88' : '#ff5577';
    }

    _quickRestart() {
      // Defer past the current frame so we don't destroy the game mid-update.
      setTimeout(function(){ try { App.retryGame(); } catch(e) {} }, 0);
    }

    _showCrashOverlay() {
      const el = document.getElementById('hud-crash') || (function(){
        const d=document.createElement('div'); d.id='hud-crash'; document.body.appendChild(d); return d;
      })();
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;'+
        'align-items:center;justify-content:center;gap:14px;background:rgba(7,7,15,0.92);'+
        "font-family:'Share Tech Mono',monospace;color:#ff5577;text-align:center;padding:24px";
      el.innerHTML = '<div style="font-size:20px;letter-spacing:2px">⚠ GLITCHED OUT</div>'+
        '<div style="font-size:12px;color:#888899;max-width:320px">Something hiccuped mid-run. Your progress on this attempt was not saved.</div>';
      const btn = document.createElement('button');
      btn.textContent = '↺ RESTART';
      btn.style.cssText = 'padding:10px 22px;font-family:inherit;font-size:14px;background:#e8ff47;'+
        'color:#07070f;border:none;border-radius:6px;cursor:pointer;letter-spacing:1px';
      btn.addEventListener('click', function(){ el.remove(); try { App.retryGame(); } catch(e) {} });
      el.appendChild(btn);
    }

    _setMedalTicks() {
      const medals=_course.medals||MEDAL_EASY;
      ['bronze','silver','gold','author'].forEach(name=>{
        const t=document.getElementById('tick-'+name);
        if(t){ const f=1-(medals[name]/medals.bronze); t.style.left=(f*100)+'%'; }
      });
    }

    _maxTX(){let m=0;this.tileMap.forEach((_,k)=>{const x=parseInt(k);m=Math.max(m,x);});return m;}
    _maxTY(){let m=0;this.tileMap.forEach((_,k)=>{const y=parseInt(k.split(',')[1]);m=Math.max(m,y);});return m;}
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  function launch(course, opts) {
    _course=course; _opts=opts||{};
    if(game){game.destroy(true);game=null;}
    var container=document.getElementById('game-container');
    container.innerHTML='';
    // Clear any leftover crash overlay / ghost readout from a previous run.
    var crash=document.getElementById('hud-crash'); if(crash) crash.remove();
    var gd=document.getElementById('hud-ghost'); if(gd){ gd.textContent=''; gd.style.display='none'; }

    // Hard-code safe dimensions — Devvit webview is always full viewport
    _W = window.innerWidth || 480;
    _H = Math.max(300, window.innerHeight - 56);

    game=new Phaser.Game({
      type:Phaser.AUTO,
      parent:'game-container',
      width:_W,
      height:_H,
      backgroundColor:0x07070f,
      scene:[RunScene],
      audio:{noAudio:true},
    });
  }

  function destroy() {
    const mc=document.getElementById('mobile-controls');
    if(mc) mc.style.display='none';
    // Remove window key listeners
    if(game && game.scene && game.scene.scenes && game.scene.scenes[0]) {
      var s = game.scene.scenes[0];
      if(s._onKeyDown) window.removeEventListener('keydown', s._onKeyDown);
      if(s._onKeyUp) window.removeEventListener('keyup', s._onKeyUp);
    }
    if(game){game.destroy(true);game=null;}
  }

  return {launch,destroy};
})();
