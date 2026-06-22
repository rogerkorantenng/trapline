// Player visual + input bridge
// PhysicsSim handles all movement logic; this handles rendering, input reading, and juice triggers.

class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.body = new PhysicsBody(x - 8, y - 16, 16, 16);
    this.body.facing = 1;
    this.gfx = scene.add.rectangle(x, y, 14, 14, COLORS.PLAYER).setDepth(10);
    this.wasOnGround = false;
    this.wasDashing = false;
    this.dashCooldown = 0;

    // Squash/stretch
    this.scaleX = 1; this.scaleY = 1;
    this.targetScaleX = 1; this.targetScaleY = 1;
  }

  getInput(cursors, wasd, dashKey, slideKey) {
    const left = cursors.left.isDown || wasd.A.isDown;
    const right = cursors.right.isDown || wasd.D.isDown;
    const jump = Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(wasd.W) || Phaser.Input.Keyboard.JustDown(wasd.SPACE);
    const jumpHeld = cursors.up.isDown || wasd.W.isDown || wasd.SPACE.isDown;
    const dash = Phaser.Input.Keyboard.JustDown(dashKey);
    const slide = slideKey.isDown;
    return { left, right, jump, jumpHeld, dash, slide };
  }

  update(input, sim, dt, juice) {
    const body = this.body;
    if (input.right) body.facing = 1;
    if (input.left) body.facing = -1;

    const events = sim.step(body, input, dt);

    // Sync visual
    const cx = body.x + body.w / 2;
    const cy = body.y + body.h / 2;

    // Squash/stretch
    const isDashing = body.dashTimer > 0;
    if (isDashing && !this.wasDashing) {
      this.targetScaleX = 1.6; this.targetScaleY = 0.6;
      juice.spawnDashTrail(cx, cy, body.facing);
    } else if (!body.onGround && this.wasOnGround) {
      // Just left ground: stretch upward on jump
      this.targetScaleX = 0.7; this.targetScaleY = 1.4;
    } else if (body.onGround && !this.wasOnGround) {
      // Landing squash
      this.targetScaleX = 1.4; this.targetScaleY = 0.6;
      juice.spawnLandDust(cx, cy + body.h / 2);
      juice.shake(2, 0.08);
    } else if (body.onGround && Math.abs(body.vx) < 10) {
      this.targetScaleX = 1; this.targetScaleY = 1;
    }

    this.scaleX += (this.targetScaleX - this.scaleX) * 15 * dt;
    this.scaleY += (this.targetScaleY - this.scaleY) * 15 * dt;
    // Enforce area conservation
    this.gfx.setScale(this.scaleX, this.scaleY);
    this.gfx.setPosition(cx, cy);

    this.wasOnGround = body.onGround;
    this.wasDashing = isDashing;

    return events;
  }

  destroy() {
    this.gfx.destroy();
  }
}

class GhostPlayer {
  constructor(scene) {
    this.scene = scene;
    this.gfx = scene.add.rectangle(0, 0, 12, 12, COLORS.GHOST, 0.4).setDepth(8);
    this.frames = [];
    this.frameIndex = 0;
    this.elapsed = 0;
  }

  load(frames) {
    this.frames = frames;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.gfx.setVisible(true);
  }

  update(dt) {
    if (!this.frames.length) return;
    this.elapsed += dt * 1000;
    while (this.frameIndex + 1 < this.frames.length && this.frames[this.frameIndex + 1].t <= this.elapsed) {
      this.frameIndex++;
    }
    const f = this.frames[this.frameIndex];
    this.gfx.setPosition(f.x + 8, f.y + 8);
  }

  destroy() {
    this.gfx.destroy();
  }
}
