// HUD: timer + medal ticks + death counter
// All elements live in a fixed camera layer (setScrollFactor(0))

class HUD {
  constructor(scene, medals) {
    this.scene = scene;
    this.medals = medals; // { bronze, silver, gold, author }
    this.startTime = null;
    this.ghostTime = null;
    this.deaths = 0;

    const W = scene.cameras.main.width;

    // Timer text
    this.timerText = scene.add.text(W / 2, 12, '0.000', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);

    // Medal bar: horizontal track below timer
    const barY = 38;
    const barW = 200;
    const barX = W / 2 - barW / 2;
    this.barBg = scene.add.rectangle(barX, barY, barW, 4, 0x333333).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
    this.barFill = scene.add.rectangle(barX, barY, 0, 4, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(31);

    // Medal tick marks
    this.ticks = [];
    const thresholds = [
      { key: 'bronze', color: MEDAL_COLORS.bronze },
      { key: 'silver', color: MEDAL_COLORS.silver },
      { key: 'gold', color: MEDAL_COLORS.gold },
      { key: 'author', color: MEDAL_COLORS.author },
    ];
    const maxTime = medals.bronze;
    for (const { key, color } of thresholds) {
      const frac = 1 - medals[key] / maxTime;
      const tx = barX + frac * barW;
      const tick = scene.add.rectangle(tx, barY - 2, 2, 8, parseInt(color.replace('#', '0x'), 16))
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(32);
      this.ticks.push(tick);
    }

    // Death counter
    this.deathText = scene.add.text(W - 12, 12, '💀 0', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#ff3355',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
  }

  start(ghostTimeMs) {
    this.startTime = Date.now();
    this.ghostTime = ghostTimeMs;
  }

  addDeath() {
    this.deaths++;
    this.deathText.setText('💀 ' + this.deaths);
    // Flash red
    this.scene.tweens.add({
      targets: this.deathText, alpha: 0, duration: 100, yoyo: true, repeat: 2,
    });
  }

  update() {
    if (!this.startTime) return;
    const elapsed = Date.now() - this.startTime;
    const s = (elapsed / 1000).toFixed(3);
    this.timerText.setText(s);

    // Color based on ghost comparison
    if (this.ghostTime !== null) {
      this.timerText.setColor(elapsed <= this.ghostTime ? COLORS.TIMER_AHEAD.toString(16).padStart(6, '0').replace(/^/, '#') : '#ff3355');
    }

    // Update medal bar fill
    const maxTime = this.medals.bronze;
    const frac = Math.min(1, elapsed / maxTime);
    const barW = 200;
    this.barFill.setSize(frac * barW, 4);

    // Pulse timer when approaching a medal threshold
    const remaining = maxTime - elapsed;
    if (remaining > 0 && remaining < 2000) {
      const pulse = 1 + 0.1 * Math.sin(Date.now() * 0.02);
      this.timerText.setScale(pulse);
    } else {
      this.timerText.setScale(1);
    }
  }

  getElapsed() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  destroy() {
    this.timerText.destroy();
    this.barBg.destroy();
    this.barFill.destroy();
    this.ticks.forEach(t => t.destroy());
    this.deathText.destroy();
  }
}
