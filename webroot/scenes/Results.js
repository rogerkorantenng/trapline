class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  init(data) {
    this.course = data.course;
    this.timeMs = data.timeMs;
    this.deaths = data.deaths;
    this.board = data.board || [];
    this.ghost = data.ghost;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(0, 0, W, H, COLORS.BG).setOrigin(0, 0);

    // Determine medal
    const m = this.course.medals || { bronze: 60000, silver: 45000, gold: 30000, author: 20000 };
    let medal = null;
    if (this.timeMs <= m.author) medal = 'author';
    else if (this.timeMs <= m.gold) medal = 'gold';
    else if (this.timeMs <= m.silver) medal = 'silver';
    else if (this.timeMs <= m.bronze) medal = 'bronze';

    const medalColor = MEDAL_COLORS[medal] || MEDAL_COLORS[null];

    // Medal slam animation
    const medalText = medal ? medal.toUpperCase() : 'CLEAR';
    const medalGfx = this.add.text(W / 2, H * 0.22, medalText, {
      fontSize: '48px', fontFamily: 'Courier New', fontStyle: 'bold',
      color: medalColor, stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScale(3).setAlpha(0);

    this.tweens.add({
      targets: medalGfx, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut',
    });

    // Time
    const sec = (this.timeMs / 1000).toFixed(3);
    this.time.delayedCall(350, () => {
      this.add.text(W / 2, H * 0.35, sec + 's', {
        fontSize: '28px', fontFamily: 'Courier New', color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: this.children.list[this.children.list.length - 1], alpha: 1, duration: 200 });
    });

    this.time.delayedCall(500, () => {
      this.add.text(W / 2, H * 0.42, `💀 ${this.deaths} death${this.deaths !== 1 ? 's' : ''}`, {
        fontSize: '16px', fontFamily: 'Courier New', color: '#ff3355',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: this.children.list[this.children.list.length - 1], alpha: 1, duration: 200 });
    });

    // Leaderboard (top 5)
    this.time.delayedCall(700, () => {
      const topY = H * 0.52;
      this.add.text(W / 2, topY, 'LEADERBOARD', {
        fontSize: '12px', fontFamily: 'Courier New', color: '#555555',
      }).setOrigin(0.5);
      const top5 = this.board.slice(0, 5);
      top5.forEach((entry, i) => {
        const color = MEDAL_COLORS[entry.medal] || '#555555';
        const me = entry.userId === window.GAME_STATE?.userId;
        this.add.text(W / 2, topY + 18 + i * 20,
          `#${entry.rank}  ${entry.username}  ${(entry.timeMs / 1000).toFixed(3)}s`, {
            fontSize: me ? '14px' : '12px', fontFamily: 'Courier New', color: me ? color : '#888888',
          }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: this.children.list[this.children.list.length - 1], alpha: 1, delay: i * 80, duration: 150 });
      });
    });

    // Buttons
    this.time.delayedCall(900, () => {
      this._btn(W / 2 - 70, H * 0.88, 'RETRY', () => this.scene.start('Game', { course: this.course }));
      this._btn(W / 2 + 70, H * 0.88, 'MENU', () => this.scene.start('Menu'));
      if (this.course.authorId !== window.GAME_STATE?.userId) {
        this._btn(W / 2, H * 0.94, 'BUILD REVENGE COURSE', () => this.scene.start('Editor', { revengeOn: this.course }));
      }
    });
  }

  _btn(x, y, label, cb) {
    const btn = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: 'Courier New', color: '#e8ff47',
      backgroundColor: '#1a1a2f', padding: { x: 14, y: 8 },
      stroke: '#e8ff47', strokeThickness: 1,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerup', cb);
    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1));
    return btn;
  }
}
