// HTML Canvas editor — no Phaser, direct 2D canvas rendering
const Editor = (function() {
  let canvas, ctx, wrap;
  let tileMap = new Map(); // "x,y" -> type
  let selectedTile = 'ground';
  let erasing = false;
  let isDragging = false;
  let scrollX = 0, scrollY = 0;
  let dragLastX = 0, dragLastY = 0;
  let isPanning = false; // right-click or two-finger drag
  let courseTitle = 'My Course';
  let forGauntlet = false;
  const T = TILE_SIZE;
  let COLS = 60, ROWS = 20;          // COLS is the *minimum* width; the world grows rightward with content
  const MAX_COLS = 5000;             // sanity cap — effectively unlimited for a platformer course
  const COL_HEADROOM = 30;           // columns you can scroll/build past your furthest tile

  function init() {
    canvas = document.getElementById('editor-canvas');
    wrap   = document.getElementById('editor-canvas-wrap');
    ctx    = canvas.getContext('2d');
    _resize();
    _buildPalette();
    _setupInput();
    window.addEventListener('resize', _resize);
    _render();
  }

  function _resize() {
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    _render();
  }

  function _buildPalette() {
    const container = document.getElementById('palette-tiles');
    container.innerHTML = '';
    TILE_DEFS.forEach(def => {
      const el = document.createElement('div');
      el.className = 'palette-tile' + (def.id === selectedTile ? ' selected' : '');
      el.dataset.id = def.id;
      el.dataset.id = def.id;
      el.innerHTML = '<div class="palette-tile-icon">' + def.icon + '</div>' +
                     '<div class="palette-tile-label">' + def.label + '</div>';
      el.addEventListener('click', () => {
        selectedTile = def.id;
        erasing = false;
        document.getElementById('btn-erase').classList.remove('active');
        document.querySelectorAll('.palette-tile').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
      });
      container.appendChild(el);
    });
  }

  function _setupInput() {
    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) { isPanning = true; dragLastX = e.clientX; dragLastY = e.clientY; return; }
      isDragging = true;
      _applyAt(e.offsetX, e.offsetY);
    });
    canvas.addEventListener('mousemove', e => {
      if (isPanning) {
        scrollX -= e.clientX - dragLastX;
        scrollY -= e.clientY - dragLastY;
        dragLastX = e.clientX; dragLastY = e.clientY;
        _clampScroll(); _render(); return;
      }
      if (isDragging) _applyAt(e.offsetX, e.offsetY);
    });
    canvas.addEventListener('mouseup',   () => { isDragging = false; isPanning = false; });
    canvas.addEventListener('mouseleave',() => { isDragging = false; isPanning = false; });

    // Keyboard shortcuts
    const shortcuts = {
      'g':'ground','s':'spike','w':'saw','p':'platform',
      'f':'flag','e_':'erase','c_':'crush','r':'spring',
      'd':'disappear','n':'goomba','l':'wall',
    };
    document.addEventListener('keydown', e => {
      if (document.getElementById('screen-editor').classList.contains('hidden')) return;
      const k = e.key.toLowerCase();
      if (k === 'e') { toggleErase(); return; }
      if (shortcuts[k]) {
        selectedTile = shortcuts[k];
        erasing = false;
        document.getElementById('btn-erase').classList.remove('active');
        document.querySelectorAll('.palette-tile').forEach(el => el.classList.toggle('selected', el.dataset.id===selectedTile));
      }
      if (k === 'z' && (e.ctrlKey||e.metaKey)) { /* undo stub */ }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      scrollX += e.deltaX; scrollY += e.deltaY;
      _clampScroll(); _render();
    }, { passive: false });

    // Touch support
    let lastTouches = null;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        const r = canvas.getBoundingClientRect();
        _applyAt(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
        dragLastX = e.touches[0].clientX; dragLastY = e.touches[0].clientY;
        lastTouches = null;
      } else if (e.touches.length === 2) {
        isDragging = false;
        lastTouches = [{ x: e.touches[0].clientX, y: e.touches[0].clientY },
                       { x: e.touches[1].clientX, y: e.touches[1].clientY }];
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 2 && lastTouches) {
        const dx = ((e.touches[0].clientX + e.touches[1].clientX)/2) - ((lastTouches[0].x + lastTouches[1].x)/2);
        const dy = ((e.touches[0].clientY + e.touches[1].clientY)/2) - ((lastTouches[0].y + lastTouches[1].y)/2);
        scrollX -= dx; scrollY -= dy;
        lastTouches = [{ x: e.touches[0].clientX, y: e.touches[0].clientY },
                       { x: e.touches[1].clientX, y: e.touches[1].clientY }];
        _clampScroll(); _render();
      } else if (e.touches.length === 1 && isDragging) {
        const r = canvas.getBoundingClientRect();
        _applyAt(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isDragging = false; lastTouches = null; });
  }

  // Horizontal extent grows with the course: always at least COLS wide, and always
  // COL_HEADROOM columns past the furthest placed tile so you can keep panning right
  // and building forward without ever hitting a wall.
  function _worldCols() {
    let maxX = COLS - 1;
    tileMap.forEach((_t, key) => {
      const x = +key.slice(0, key.indexOf(','));
      if (x > maxX) maxX = x;
    });
    return Math.min(MAX_COLS, maxX + 1 + COL_HEADROOM);
  }

  function _clampScroll() {
    scrollX = Math.max(0, Math.min(scrollX, _worldCols() * T - canvas.width));
    scrollY = Math.max(0, Math.min(scrollY, ROWS * T - canvas.height));
  }

  function _screenToTile(sx, sy) {
    return { x: Math.floor((sx + scrollX) / T), y: Math.floor((sy + scrollY) / T) };
  }

  function _applyAt(sx, sy) {
    const { x, y } = _screenToTile(sx, sy);
    if (x < 0 || y < 0 || x >= MAX_COLS || y >= ROWS) return;
    const key = x+','+y;
    if (erasing) { tileMap.delete(key); }
    else { tileMap.set(key, selectedTile); }
    _render();
  }

  function _render() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const startX = Math.floor(scrollX / T) * T - scrollX;
    const startY = Math.floor(scrollY / T) * T - scrollY;
    for (let x = startX; x < W; x += T) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = startY; y < H; y += T) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Tiles
    tileMap.forEach((type, key) => {
      const [tx, ty] = key.split(',').map(Number);
      const px = tx * T - scrollX;
      const py = ty * T - scrollY;
      if (px + T < 0 || px > W || py + T < 0 || py > H) return;
      const def = TILE_MAP[type];
      if (!def) return;
      _drawTile(ctx, px, py, def);
    });

    // Cursor highlight
    ctx.strokeStyle = 'rgba(232,255,71,0.5)';
    ctx.lineWidth = 1;
  }

  function _drawTile(ctx, px, py, def) {
    const T = TILE_SIZE;
    const c = def.color;
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;

    if (def.id === 'ground') {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px, py+2, T-1, T-2);
      ctx.fillStyle = `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`;
      ctx.fillRect(px, py, T-1, 3);
      return;
    }
    if (def.id === 'wall') {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px, py, T-1, T-1);
      return;
    }
    if (def.id === 'platform') {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px, py, T-1, 6);
      return;
    }
    if (def.id === 'spike') {
      ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(px + T/2, py + 4);
      ctx.lineTo(px + T - 4, py + T - 2);
      ctx.lineTo(px + 4, py + T - 2);
      ctx.closePath(); ctx.fill();
      return;
    }
    if (def.id === 'saw') {
      ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
      ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px+T/2, py+T/2, T/2-3, 0, Math.PI*2);
      ctx.stroke();
      // teeth
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(px+T/2+Math.cos(a)*(T/2-3), py+T/2+Math.sin(a)*(T/2-3));
        ctx.lineTo(px+T/2+Math.cos(a+0.2)*(T/2+2), py+T/2+Math.sin(a+0.2)*(T/2+2));
        ctx.lineTo(px+T/2+Math.cos(a+0.4)*(T/2-3), py+T/2+Math.sin(a+0.4)*(T/2-3));
        ctx.closePath(); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
      }
      return;
    }
    if (def.id === 'spring') {
      ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
      ctx.fillRect(px+4, py+T/2, T-8, T/2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      // coil lines
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(px+4, py + T/2 + i*5, T-8, 3);
      }
      ctx.fillRect(px+2, py+T-6, T-4, 6);
      return;
    }
    if (def.id === 'crusher') {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px+2, py, T-4, T*0.6);
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.fillRect(px+6, py+T*0.6, T-12, T*0.15);
      // danger stripes
      ctx.fillStyle = '#111';
      for (let i = 0; i < 3; i++) ctx.fillRect(px+4+i*8, py+2, 4, T*0.55);
      return;
    }
    if (def.id === 'disappear') {
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4,4]);
      ctx.strokeRect(px+2, py, T-4, 6);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${r},${g},${b},0.1)`;
      ctx.fillRect(px+2, py, T-4, 6);
      return;
    }
    if (def.id === 'goomba') {
      // Enemy body
      ctx.fillStyle = '#aa4400';
      ctx.beginPath();
      ctx.ellipse(px+T/2, py+T-8, T/2-2, T/3, 0, 0, Math.PI*2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#cc5500';
      ctx.beginPath();
      ctx.arc(px+T/2, py+T/2, T/2-4, 0, Math.PI*2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(px+T/2-5, py+T/2-2, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+T/2+5, py+T/2-2, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath(); ctx.arc(px+T/2-5, py+T/2-1, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+T/2+5, py+T/2-1, 1.5, 0, Math.PI*2); ctx.fill();
      return;
    }
    if (def.id === 'flag') {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px+T/2-1, py+2, 3, T-4);
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.beginPath();
      ctx.moveTo(px+T/2+2, py+4);
      ctx.lineTo(px+T/2+16, py+10);
      ctx.lineTo(px+T/2+2, py+16);
      ctx.closePath(); ctx.fill();
      return;
    }
    // Fallback
    ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
    ctx.fillRect(px+1, py+1, T-2, T-2);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = 1; ctx.strokeRect(px+1, py+1, T-2, T-2);
  }

  function open(opts) {
    opts = opts || {};
    forGauntlet = opts.gauntlet || false;
    courseTitle = opts.revengeOn ? 'Revenge of ' + opts.revengeOn.title : 'My Course';
    document.getElementById('editor-course-name').textContent = courseTitle;
    tileMap.clear();
    scrollX = 0; scrollY = Math.max(0, ROWS*T/2 - 200);
    erasing = false;
    selectedTile = 'ground';
    _buildPalette();
    _buildDefaultCourse();
    _render();
  }

  function _buildDefaultCourse() {
    // Interesting starter: introduces every mechanic
    // Starting flat
    for(let x=0;x<5;x++) tileMap.set(x+',12','ground');
    // First gap + platform hop
    tileMap.set('5,11','platform');tileMap.set('6,11','platform');
    // Spike then safe ground
    for(let x=7;x<12;x++) tileMap.set(x+',12','ground');
    tileMap.set('9,11','spike'); tileMap.set('11,11','goomba');
    // Saw zone
    for(let x=13;x<19;x++) tileMap.set(x+',12','ground');
    tileMap.set('14,11','saw'); tileMap.set('16,11','saw');
    // Spring launch to elevated section
    tileMap.set('18,11','spring');
    for(let x=20;x<27;x++) tileMap.set(x+',8','ground');
    tileMap.set('22,7','spike'); tileMap.set('24,7','goomba');
    // Disappear bridge
    tileMap.set('28,8','disappear'); tileMap.set('29,8','disappear');
    tileMap.set('30,8','disappear'); tileMap.set('31,8','disappear');
    // Final platform + flag
    for(let x=33;x<37;x++) tileMap.set(x+',8','ground');
    tileMap.set('33,7','crusher');
    tileMap.set('36,7','flag');
    scrollY = Math.max(0, 7*T - 120);
  }

  function toggleErase() {
    erasing = !erasing;
    const btn = document.getElementById('btn-erase');
    btn.classList.toggle('active', erasing);
    btn.textContent = erasing ? 'ERASING' : 'ERASE';
  }

  function clear() {
    if (!confirm('Clear all tiles?')) return;
    tileMap.clear(); _render();
  }

  function test() {
    const tiles = _getTiles();
    if (!tiles.length) { toast('Place some tiles first!', 'warn'); return; }
    const course = {
      id: 'test_' + Date.now(),
      authorId: window.GAME_STATE && window.GAME_STATE.userId || 'dev',
      authorName: window.GAME_STATE && window.GAME_STATE.username || 'Dev',
      title: courseTitle,
      tiles, medals: MEDAL_EASY, createdAt: Date.now(),
    };
    App.playGame(course, { fromEditor: true });
  }

  // Validate solvability heuristics + derive difficulty and calibrated medals.
  function _analyze(tiles) {
    const result = { ok: true, error: null, warnings: [], difficulty: 1, medals: MEDAL_EASY };
    if (tiles.length < 5) { result.ok = false; result.error = 'Add more tiles first'; return result; }
    const flag = tiles.find(t => t.type === 'flag');
    if (!flag) { result.ok = false; result.error = 'Add a FINISH (🚩) tile'; return result; }
    const ground = tiles.filter(t => t.type === 'ground' || t.type === 'platform');
    if (!ground.length) { result.ok = false; result.error = 'Add some GROUND to stand on'; return result; }

    // The finish must have at least one non-solid face so it can be touched.
    const solid = new Set(tiles.filter(t => { const d = TILE_MAP[t.type]; return d && d.solid; }).map(t => t.x + ',' + t.y));
    const faces = [[1,0],[-1,0],[0,1],[0,-1]];
    const flagOpen = faces.some(([dx,dy]) => !solid.has((flag.x+dx) + ',' + (flag.y+dy)));
    if (!flagOpen) { result.ok = false; result.error = 'FINISH is walled in — leave a way to reach it'; return result; }

    // Bounds, hazards, and the widest gap in the ground line.
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    tiles.forEach(t => { minX=Math.min(minX,t.x); maxX=Math.max(maxX,t.x); minY=Math.min(minY,t.y); maxY=Math.max(maxY,t.y); });
    const length = maxX-minX+1, vspan = maxY-minY+1;
    const hazards = tiles.filter(t => { const d = TILE_MAP[t.type]; return d && d.hazard; }).length;
    const cols = new Set(ground.map(t => t.x));
    let maxGap=0, run=0;
    for (let x=minX; x<=maxX; x++) { if (cols.has(x)) run=0; else { run++; maxGap=Math.max(maxGap,run); } }
    if (maxGap > 5) result.warnings.push('There is a ' + maxGap + '-tile gap — make sure it is jumpable');

    const score = hazards*1.2 + Math.max(0,maxGap-2)*1.5 + Math.max(0,vspan-6)*0.4 + length*0.03;
    result.difficulty = Math.max(1, Math.min(5, Math.round(1 + score/4)));

    // Calibrate medals from course length (~900ms per tile of progress).
    const base = Math.max(8000, length*900);
    result.medals = {
      bronze: Math.round(base*2.2), silver: Math.round(base*1.7),
      gold: Math.round(base*1.25), author: Math.round(base*0.9),
    };
    return result;
  }

  async function publish() {
    const tiles = _getTiles();
    const analysis = _analyze(tiles);
    if (!analysis.ok) { toast(analysis.error + '!', 'warn'); return; }
    analysis.warnings.forEach(w => toast(w, 'warn'));
    const course = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      authorId: window.GAME_STATE && window.GAME_STATE.userId || 'anon',
      authorName: window.GAME_STATE && window.GAME_STATE.username || 'Anonymous',
      title: courseTitle,
      tiles, medals: analysis.medals, difficulty: analysis.difficulty, createdAt: Date.now(),
    };
    // Play the published course as a real run (no fromEditor): finishing routes
    // to the results screen, which is where SHARE (post a run comment) lives.
    try {
      await rpc('SAVE_COURSE', { course }, 'COURSE_SAVED');
      toast('Course published!');
      App.invalidateCommunityCache();
      App.playGame(course);
    } catch(e) {
      toast('Saved locally, play now?');
      App.invalidateCommunityCache();
      App.playGame(course);
    }
  }

  function _getTiles() {
    const arr = [];
    tileMap.forEach((type, key) => {
      const [x,y] = key.split(',').map(Number);
      arr.push({x,y,type});
    });
    return arr;
  }

  function loadCourse(course) {
    tileMap.clear();
    (course.tiles||[]).forEach(t => tileMap.set(t.x+','+t.y, t.type));
    // Find min Y to center view
    let minY = 9999;
    course.tiles.forEach(t => { if(t.y < minY) minY = t.y; });
    scrollY = Math.max(0, (minY-2)*T);
    scrollX = 0;
    _render();
  }

  return { init, open, toggleErase, clear, test, publish, loadCourse };
})();
