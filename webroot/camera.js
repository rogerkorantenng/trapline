// Look-ahead camera: leads in direction of movement
class GameCamera {
  constructor(scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.targetX = 0;
    this.targetY = 0;
    this.lookAheadX = 80;
  }

  follow(body, worldW, worldH) {
    const cx = body.x + body.w / 2 + body.facing * this.lookAheadX;
    const cy = body.y + body.h / 2;
    this.targetX += (cx - this.targetX) * 0.1;
    this.targetY += (cy - this.targetY) * 0.08;

    const hw = this.cam.width / 2;
    const hh = this.cam.height / 2;
    const scrollX = Math.max(0, Math.min(this.targetX - hw, worldW - this.cam.width));
    const scrollY = Math.max(0, Math.min(this.targetY - hh, worldH - this.cam.height));
    this.cam.setScroll(scrollX, scrollY);
  }
}
