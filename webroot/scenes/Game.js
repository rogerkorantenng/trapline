class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.courseData = data.course;
    this.isGauntlet = data.isGauntlet || false;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(0, 0, W * 10, H * 4, COLORS.BG).setOrigin(0, 0);

    // Build tilemap
    this.tilemap = Tilemap.fromData(this.courseData.tiles);
    this.tilemap.render(this);

    // Physics sim
    this.sim = new PhysicsSim(this.tilemap);

    // Spawn player
    const spawn = this.tilemap.findSpawn();
    this.player = new Player(this, spawn.x, spawn.y - 16);

    // Ghost (loaded async)
    this.ghost = new GhostPlayer(this);
    this.ghost.gfx.setVisible(false);

    // Camera
    this.gameCamera = new GameCamera(this);
    const worldW = (this.tilemap.width + 2) * TILE_SIZE;
    const worldH = (this.tilemap.height + 2) * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.worldW = worldW; this.worldH = worldH;

    // HUD
    const medals = this.courseData.medals || { bronze: 60000, silver: 45000, gold: 30000, author: 20000 };
    this.hud = new HUD(this, medals);

    // Juice
    this.juice = new JuiceManager(this);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ A: 'A', D: 'D', W: 'W', SPACE: 'SPACE' });
    this.dashKey = this.input.keyboard.addKey('SHIFT');
    this.slideKey = this.input.keyboard.addKey('S');

    // State
    this.running = false;
    this.finished = false;
    this.replayFrames = [];
    this.elapsed = 0;
    this.deaths = 0;
    this.retryCount = 0;
    this.spawnX = spawn.x;
    this.spawnY = spawn.y - 16;

    // Load ghost async
    rpc('GET_GHOST', { courseId: this.courseData.id }, 'GHOST_DATA').then((d) => {
      if (d.ghost && d.ghost.length) {
        this.ghost.load(d.ghost);
        this.hud.start(d.ghost[d.ghost.length - 1]?.t || null);
      } else {
        this.hud.start(null);
      }
    }).catch(() => this.hud.start(null));

    // Load graveyard async
    rpc('GET_DEATH_GRAVEYARD', { courseId: this.courseData.id }, 'GRAVEYARD_DATA').then((d) => {
      if (d.markers) this._renderGraveyard(d.markers);
    }).catch(() => {});

    // Start immediately
    this.running = true;
    this.hud.start(null);
  }

  _renderGraveyard(markers) {
    for (const m of markers) {
      const gfx = this.add.text(m.x * TILE_SIZE, m.y * TILE_SIZE, m.taunt ? m.taunt : '†', {
        fontSize: '10px', fontFamily: 'Courier New',
        color: '#' + COLORS.GRAVE.toString(16).padStart(6, '0'),
        alpha: 0.5,
      }).setDepth(5);
      // Slight random offset so overlapping markers spread
      gfx.setPosition(m.x + (Math.random() - 0.5) * 8, m.y + (Math.random() - 0.5) * 8);
    }
  }

  update(time, delta) {
    if (!this.running) return;
    const dt = Math.min(delta / 1000, 0.05); // cap at 50ms to avoid spiral of death

    const input = this.player.getInput(this.cursors, this.wasd, this.dashKey, this.slideKey);
    const events = this.player.update(input, this.sim, dt, this.juice);

    this.juice.update(dt);
    this.ghost.update(dt);
    this.hud.update();
    this.gameCamera.follow(this.player.body, this.worldW, this.worldH);

    // Record replay frame
    this.elapsed += delta;
    if (this.elapsed % 50 < delta) { // ~20fps replay
      const b = this.player.body;
      this.replayFrames.push({ t: Math.round(this.elapsed), x: b.x, y: b.y, vx: b.vx, vy: b.vy, state: b.onGround ? 'g' : 'a', facing: b.facing });
    }

    for (const ev of events) {
      if (ev === 'death') this._onDeath();
      if (ev === 'finish') this._onFinish();
      if (ev === 'near_miss') this.juice.nearMiss();
    }
  }

  _onDeath() {
    this.running = false;
    this.deaths++;
    this.hud.addDeath();

    const b = this.player.body;
    this.juice.spawnDeathBurst(b.x + b.w / 2, b.y + b.h / 2);

    // Record death position for graveyard
    send('RECORD_DEATH', {
      courseId: this.courseData.id,
      x: Math.round(b.x / TILE_SIZE),
      y: Math.round(b.y / TILE_SIZE),
    });

    // Instant retry after 300ms
    this.time.delayedCall(300, () => this._retry());
  }

  _retry() {
    this.retryCount++;
    this.player.body.x = this.spawnX - 8;
    this.player.body.y = this.spawnY - 16;
    this.player.body.vx = 0;
    this.player.body.vy = 0;
    this.player.body.dead = false;
    this.player.gfx.setVisible(true);
    this.sim.accumulator = 0;
    this.replayFrames = [];
    this.elapsed = 0;
    this.running = true;
  }

  _onFinish() {
    this.running = false;
    const timeMs = this.hud.getElapsed();
    this.player.gfx.setVisible(false);

    // Submit run to Devvit
    rpc('SUBMIT_RUN', {
      courseId: this.courseData.id,
      timeMs,
      deathCount: this.deaths,
      replayData: this.replayFrames,
    }, 'RUN_SUBMITTED').then((d) => {
      this.scene.start('Results', {
        course: this.courseData,
        timeMs,
        deaths: this.deaths,
        board: d.board || [],
        ghost: d.ghost || null,
      });
    }).catch(() => {
      this.scene.start('Results', {
        course: this.courseData,
        timeMs,
        deaths: this.deaths,
        board: [],
        ghost: null,
      });
    });
  }
}
