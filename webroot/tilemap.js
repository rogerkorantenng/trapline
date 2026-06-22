// Tilemap: stores tile grid + renders with Phaser graphics
// Each tile: { x, y, type }

class Tilemap {
  constructor() {
    this._map = new Map(); // "x,y" -> tile
    this.width = 0;
    this.height = 0;
  }

  static fromData(tiles) {
    const tm = new Tilemap();
    for (const t of tiles) tm.set(t.x, t.y, t.type, t.variant);
    return tm;
  }

  set(x, y, type, variant = 0) {
    this._map.set(`${x},${y}`, { x, y, type, variant });
    this.width = Math.max(this.width, x + 1);
    this.height = Math.max(this.height, y + 1);
  }

  get(x, y) {
    return this._map.get(`${x},${y}`) || null;
  }

  remove(x, y) {
    this._map.delete(`${x},${y}`);
  }

  toArray() {
    return Array.from(this._map.values());
  }

  findFlag() {
    for (const t of this._map.values()) {
      if (t.type === 'flag') return t;
    }
    return null;
  }

  findSpawn() {
    // Spawn at the leftmost ground tile's top
    let best = null;
    for (const t of this._map.values()) {
      if (t.type === 'ground') {
        if (!best || t.x < best.x) best = t;
      }
    }
    return best ? { x: best.x * TILE_SIZE + TILE_SIZE / 2, y: best.y * TILE_SIZE } : { x: 64, y: 300 };
  }

  render(scene, offsetX = 0) {
    const gfxGroup = scene.add.group();
    const T = TILE_SIZE;

    for (const tile of this._map.values()) {
      const px = tile.x * T + offsetX;
      const py = tile.y * T;
      this._renderTile(scene, tile, px, py, gfxGroup);
    }
    return gfxGroup;
  }

  _renderTile(scene, tile, px, py, group) {
    const T = TILE_SIZE;
    let gfx;

    switch (tile.type) {
      case 'ground': {
        const body = scene.add.rectangle(px, py + 2, T - 1, T - 2, COLORS.TILE_GROUND).setOrigin(0, 0);
        const top = scene.add.rectangle(px, py, T - 1, 3, COLORS.TILE_GROUND_TOP).setOrigin(0, 0);
        group.add(body); group.add(top);
        return;
      }
      case 'wall': {
        gfx = scene.add.rectangle(px, py, T - 1, T - 1, COLORS.TILE_GROUND).setOrigin(0, 0);
        break;
      }
      case 'platform': {
        gfx = scene.add.rectangle(px, py, T - 1, 6, COLORS.TILE_PLATFORM).setOrigin(0, 0);
        break;
      }
      case 'spike': {
        const tri = scene.add.triangle(
          px + T / 2, py + T,
          0, 0,
          T / 2, -T + 4,
          T, 0,
          COLORS.TILE_SPIKE
        ).setOrigin(0.5, 1);
        group.add(tri);
        return;
      }
      case 'saw': {
        const saw = scene.add.circle(px + T / 2, py + T / 2, T / 2 - 2, COLORS.TILE_SAW);
        saw.setDepth(2);
        // Animate rotation via tween
        scene.tweens.add({ targets: saw, rotation: Math.PI * 2, duration: 800, repeat: -1 });
        group.add(saw);
        return;
      }
      case 'spring': {
        const base = scene.add.rectangle(px + 4, py + T - 8, T - 8, 8, COLORS.TILE_SPRING).setOrigin(0, 0);
        group.add(base);
        return;
      }
      case 'crusher': {
        const c = scene.add.rectangle(px, py, T - 1, T - 1, COLORS.TILE_CRUSHER).setOrigin(0, 0);
        scene.tweens.add({
          targets: c, y: py + T * 0.3, duration: 400, yoyo: true, repeat: -1,
          ease: 'Bounce.easeOut',
        });
        group.add(c);
        return;
      }
      case 'disappear': {
        const d = scene.add.rectangle(px, py, T - 1, 6, COLORS.TILE_DISAPPEAR).setOrigin(0, 0);
        group.add(d);
        return;
      }
      case 'flag': {
        const pole = scene.add.rectangle(px + 4, py, 3, T, COLORS.TILE_FLAG).setOrigin(0, 0);
        const flag = scene.add.rectangle(px + 7, py, 16, 12, COLORS.TILE_FLAG).setOrigin(0, 0);
        scene.tweens.add({ targets: flag, scaleX: 0.6, duration: 400, yoyo: true, repeat: -1 });
        group.add(pole); group.add(flag);
        return;
      }
    }

    if (gfx) group.add(gfx);
  }
}
