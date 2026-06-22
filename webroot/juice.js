// Juice system: squash/stretch, screen shake, particles, hit-stop, near-miss
// Operates on a Phaser scene reference.

class JuiceManager {
  constructor(scene) {
    this.scene = scene;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.hitStopTimer = 0;
    this.timeScaleTarget = 1;
    this.particles = [];
    this.nearMissTimer = 0;
    this.nearMissActive = false;
  }

  update(dt) {
    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = this.shakeTimer <= 0 ? 0 : this.shakeIntensity * (this.shakeTimer / 0.3);
      this.scene.cameras.main.setScroll(
        this.scene.cameras.main.scrollX + (Math.random() - 0.5) * t * 2,
        this.scene.cameras.main.scrollY + (Math.random() - 0.5) * t * 2
      );
    }

    // Hit-stop
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      this.scene.physics && (this.scene.physics.world.timeScale = this.hitStopTimer > 0 ? 0.05 : 1);
    }

    // Near-miss
    if (this.nearMissTimer > 0) {
      this.nearMissTimer -= dt;
      this.nearMissActive = true;
      this.scene.cameras.main.setZoom(1 + 0.04 * Math.sin(this.nearMissTimer * 30));
    } else if (this.nearMissActive) {
      this.nearMissActive = false;
      this.scene.cameras.main.setZoom(1);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 800 * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        p.gfx.destroy();
        this.particles.splice(i, 1);
      } else {
        p.gfx.setPosition(p.x, p.y);
        p.gfx.setAlpha(p.alpha);
        p.gfx.setScale(p.alpha);
      }
    }
  }

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  hitStop(duration) {
    this.hitStopTimer = duration;
  }

  nearMiss() {
    this.nearMissTimer = 0.08;
  }

  spawnDeathBurst(x, y) {
    this.hitStop(0.06);
    this.shake(5, 0.2);
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 80 + Math.random() * 200;
      this._spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 100, 0.4 + Math.random() * 0.3, COLORS.PLAYER);
    }
  }

  spawnLandDust(x, y) {
    for (let i = 0; i < 5; i++) {
      this._spawnParticle(x + (Math.random() - 0.5) * 20, y, (Math.random() - 0.5) * 60, -40 - Math.random() * 40, 0.2, 0x888888);
    }
  }

  spawnDashTrail(x, y, facing) {
    for (let i = 0; i < 4; i++) {
      this._spawnParticle(x - facing * i * 12, y + (Math.random() - 0.5) * 8, -facing * (20 + i * 10), (Math.random() - 0.5) * 20, 0.15, COLORS.DASH_TRAIL);
    }
  }

  _spawnParticle(x, y, vx, vy, life, color) {
    const gfx = this.scene.add.rectangle(x, y, 5, 5, color);
    gfx.setDepth(20);
    this.particles.push({ x, y, vx, vy, life, maxLife: life, alpha: 1, gfx });
  }
}
