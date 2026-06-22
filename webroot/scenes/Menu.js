class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(0, 0, W, H, COLORS.BG).setOrigin(0, 0);

    // Title
    this.add.text(W / 2, H * 0.18, 'TRAPLINE', {
      fontSize: '52px', fontFamily: 'Courier New', fontStyle: 'bold',
      color: '#e8ff47', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.28, 'build. race. die. repeat.', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0.5);

    const username = window.GAME_STATE?.username || 'Anonymous';
    this.add.text(W / 2, H * 0.36, `welcome, ${username}`, {
      fontSize: '12px', fontFamily: 'Courier New', color: '#555555',
    }).setOrigin(0.5);

    const btnStyle = {
      fontSize: '18px', fontFamily: 'Courier New', color: '#0a0a0f',
      backgroundColor: '#e8ff47', padding: { x: 24, y: 10 },
    };
    const btnStyleSecondary = {
      fontSize: '16px', fontFamily: 'Courier New', color: '#e8ff47',
      backgroundColor: '#1a1a2f', padding: { x: 20, y: 8 },
      stroke: '#e8ff47', strokeThickness: 1,
    };

    const btnY = H * 0.48;
    const btnSpacing = 52;

    this._btn(W / 2, btnY, '▶  PLAY DAILY', btnStyle, () => this.playDaily());
    this._btn(W / 2, btnY + btnSpacing, '🏆  THE GAUNTLET', btnStyleSecondary, () => this.scene.start('Gauntlet'));
    this._btn(W / 2, btnY + btnSpacing * 2, '🔧  BUILD A COURSE', btnStyleSecondary, () => this.scene.start('Editor', {}));
    this._btn(W / 2, btnY + btnSpacing * 3, '📋  BROWSE COURSES', btnStyleSecondary, () => this.browseCourses());

    // Gauntlet teaser text
    this.add.text(W / 2, H * 0.92, '↑ today\'s community-built course gets longer at midnight', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#444444',
    }).setOrigin(0.5);
  }

  _btn(x, y, label, style, cb) {
    const btn = this.add.text(x, y, label, style).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1));
    btn.on('pointerdown', () => { btn.setScale(0.95); });
    btn.on('pointerup', () => { btn.setScale(1); cb(); });
    return btn;
  }

  async playDaily() {
    let daily = window.GAME_STATE?.daily;
    if (!daily) {
      const data = await rpc('GET_DAILY_COURSE', {}, 'DAILY_COURSE_DATA').catch(() => ({}));
      daily = data.course;
    }
    if (daily) {
      this.scene.start('Game', { course: daily });
    } else {
      // No daily yet — show browse
      this.browseCourses();
    }
  }

  async browseCourses() {
    const data = await rpc('LIST_COURSES', {}, 'COURSES_LIST').catch(() => ({ courses: [] }));
    this.scene.start('CourseList', { courses: data.courses || [] });
  }
}
