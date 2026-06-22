// Course editor: click to place/erase tiles, set medals, publish
class EditorScene extends Phaser.Scene {
  constructor() { super('Editor'); }

  init(data) {
    this.revengeOn = data.revengeOn || null;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(0, 0, W * 10, H, COLORS.BG).setOrigin(0, 0);

    this.tilemap = new Tilemap();
    this.tileGfxMap = new Map(); // "x,y" -> Phaser object array
    this.selectedTile = 'ground';
    this.cameraOffsetX = 0;
    this.isDragging = false;
    this.dragStartX = 0;

    // Palette
    this._buildPalette();

    // Grid overlay
    this.gridGraphics = this.add.graphics();
    this._drawGrid();

    // Input
    this.input.on('pointerdown', (p) => this._onPointerDown(p));
    this.input.on('pointermove', (p) => this._onPointerMove(p));
    this.input.on('pointerup', () => { this.isDragging = false; });

    // Scroll camera with arrow keys
    this.cursors = this.input.keyboard.createCursorKeys();

    // Top bar
    this._buildTopBar(W);

    // Default floor: 16 ground tiles
    for (let x = 0; x < 16; x++) this._placeTile(x, 11, 'ground');
    this._placeTile(0, 10, 'flag'); // provisional, user replaces

    // Title hint
    this.titleInput = null;
    this.courseTitle = this.revengeOn ? `Revenge of ${this.revengeOn.title}` : 'My Course';
  }

  _buildPalette() {
    const W = this.cameras.main.width;
    const paletteY = this.cameras.main.height - 48;
    const types = TILE_TYPES;
    const spacing = Math.min(48, (W - 20) / types.length);

    this.paletteBtns = [];
    types.forEach((type, i) => {
      const x = 10 + i * spacing + spacing / 2;
      const bg = this.add.rectangle(x, paletteY, spacing - 4, 36, 0x1a1a2f)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(50);
      const label = this.add.text(x, paletteY, type.slice(0, 3).toUpperCase(), {
        fontSize: '9px', fontFamily: 'Courier New', color: '#aaaaaa',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

      bg.on('pointerdown', () => {
        this.selectedTile = type;
        this.paletteBtns.forEach(b => b.bg.setFillStyle(0x1a1a2f));
        bg.setFillStyle(0x2a2a4f);
      });
      this.paletteBtns.push({ bg, label, type });
    });
    // Select ground by default
    if (this.paletteBtns[0]) this.paletteBtns[0].bg.setFillStyle(0x2a2a4f);
  }

  _buildTopBar(W) {
    // Publish button
    const pub = this.add.text(W - 12, 12, 'PUBLISH', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#0a0a0f',
      backgroundColor: '#e8ff47', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(50);
    pub.on('pointerdown', () => this._publish());

    // Test button
    const test = this.add.text(W - 12, 44, 'TEST ▶', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#e8ff47',
      backgroundColor: '#1a1a2f', padding: { x: 12, y: 6 }, stroke: '#e8ff47', strokeThickness: 1,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(50);
    test.on('pointerdown', () => this._test());

    // Back
    const back = this.add.text(12, 12, '← BACK', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(50);
    back.on('pointerdown', () => this.scene.start('Menu'));

    // Erase toggle
    const erase = this.add.text(12, 36, 'ERASE OFF', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#ff3355',
      backgroundColor: '#1a1a0f', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(50);
    this.erasing = false;
    erase.on('pointerdown', () => {
      this.erasing = !this.erasing;
      erase.setText(this.erasing ? 'ERASE ON' : 'ERASE OFF');
      erase.setStyle({ color: this.erasing ? '#0a0a0f' : '#ff3355', backgroundColor: this.erasing ? '#ff3355' : '#1a1a0f' });
    });
  }

  _drawGrid() {
    const W = this.cameras.main.width * 6;
    const H = this.cameras.main.height * 3;
    const T = TILE_SIZE;
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x222233, 0.4);
    for (let x = 0; x < W; x += T) this.gridGraphics.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += T) this.gridGraphics.lineBetween(0, y, W, y);
  }

  _worldToTile(px, py) {
    return {
      x: Math.floor((px + this.cameras.main.scrollX) / TILE_SIZE),
      y: Math.floor((py + this.cameras.main.scrollY) / TILE_SIZE),
    };
  }

  _onPointerDown(p) {
    if (p.y > this.cameras.main.height - 56 || p.y < 60) return; // palette / topbar area
    const { x, y } = this._worldToTile(p.x, p.y);
    this.isDragging = true;
    this._applyTile(x, y);
  }

  _onPointerMove(p) {
    if (!this.isDragging) return;
    if (p.y > this.cameras.main.height - 56 || p.y < 60) return;
    const { x, y } = this._worldToTile(p.x, p.y);
    this._applyTile(x, y);
  }

  _applyTile(x, y) {
    if (this.erasing) {
      this._eraseTile(x, y);
    } else {
      this._placeTile(x, y, this.selectedTile);
    }
  }

  _placeTile(x, y, type) {
    this._eraseTile(x, y); // remove existing
    this.tilemap.set(x, y, type);
    const T = TILE_SIZE;
    const objs = [];
    const px = x * T; const py = y * T;

    // Simple placeholder rendering (same palette as tilemap.js _renderTile)
    let color = 0x3a3a5f;
    if (type === 'spike') color = COLORS.TILE_SPIKE;
    else if (type === 'saw') color = COLORS.TILE_SAW;
    else if (type === 'spring') color = COLORS.TILE_SPRING;
    else if (type === 'crusher') color = COLORS.TILE_CRUSHER;
    else if (type === 'platform') color = COLORS.TILE_PLATFORM;
    else if (type === 'disappear') color = COLORS.TILE_DISAPPEAR;
    else if (type === 'flag') color = COLORS.TILE_FLAG;
    else if (type === 'wall') color = 0x2a2a3f;

    const rect = this.add.rectangle(px + T / 2, py + T / 2, T - 2, T - 2, color, type === 'ground' ? 0.9 : 0.8).setDepth(2);
    objs.push(rect);

    // Label for non-ground types
    if (type !== 'ground') {
      const lbl = this.add.text(px + T / 2, py + T / 2, type.slice(0, 2).toUpperCase(), {
        fontSize: '8px', fontFamily: 'Courier New', color: '#ffffff',
      }).setOrigin(0.5).setDepth(3);
      objs.push(lbl);
    }

    this.tileGfxMap.set(`${x},${y}`, objs);
  }

  _eraseTile(x, y) {
    const key = `${x},${y}`;
    const objs = this.tileGfxMap.get(key);
    if (objs) { objs.forEach(o => o.destroy()); this.tileGfxMap.delete(key); }
    this.tilemap.remove(x, y);
  }

  update(_t, delta) {
    const dt = delta / 1000;
    const speed = 300;
    if (this.cursors.left.isDown) this.cameras.main.scrollX -= speed * dt;
    if (this.cursors.right.isDown) this.cameras.main.scrollX += speed * dt;
  }

  _test() {
    const tiles = this.tilemap.toArray();
    if (!tiles.length) return;
    const fakeCourse = {
      id: 'test_' + Date.now(),
      authorId: window.GAME_STATE?.userId || 'dev',
      authorName: window.GAME_STATE?.username || 'Dev',
      title: this.courseTitle,
      tiles,
      medals: { bronze: 60000, silver: 45000, gold: 30000, author: 20000 },
      createdAt: Date.now(),
    };
    this.scene.start('Game', { course: fakeCourse });
  }

  async _publish() {
    const tiles = this.tilemap.toArray();
    if (tiles.length < 5) { return; } // need a real course
    const flag = tiles.find(t => t.type === 'flag');
    if (!flag) { return; } // must have a finish

    const course = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      authorId: window.GAME_STATE?.userId || 'anon',
      authorName: window.GAME_STATE?.username || 'Anonymous',
      title: this.courseTitle,
      tiles,
      medals: { bronze: 60000, silver: 45000, gold: 30000, author: 20000 },
      createdAt: Date.now(),
    };

    const data = await rpc('SAVE_COURSE', { course }, 'COURSE_SAVED').catch(() => null);
    if (data) {
      this.scene.start('Game', { course });
    }
  }
}
