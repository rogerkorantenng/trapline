// The Collective Gauntlet scene
// Shows the community-built course + proposal UI

class GauntletScene extends Phaser.Scene {
  constructor() { super('Gauntlet'); }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(0, 0, W, H, COLORS.BG).setOrigin(0, 0);

    // Loading state
    const loading = this.add.text(W / 2, H / 2, 'LOADING GAUNTLET...', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#e8ff47',
    }).setOrigin(0.5);

    rpc('GET_GAUNTLET', {}, 'GAUNTLET_DATA').then((d) => {
      loading.destroy();
      this._buildUI(d.gauntlet);
    }).catch(() => {
      loading.setText('could not load gauntlet');
    });
  }

  _buildUI(gauntlet) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    if (!gauntlet) {
      this.add.text(W / 2, H / 2, 'No Gauntlet yet — check back soon!', {
        fontSize: '14px', fontFamily: 'Courier New', color: '#888888',
      }).setOrigin(0.5);
      this._backBtn();
      return;
    }

    // Header
    this.add.text(W / 2, 16, '⚡ THE COLLECTIVE GAUNTLET', {
      fontSize: '18px', fontFamily: 'Courier New', fontStyle: 'bold', color: '#e8ff47',
    }).setOrigin(0.5);

    const sectionCount = gauntlet.sections.length;
    this.add.text(W / 2, 40, `Season ${gauntlet.seasonId}  •  ${sectionCount} section${sectionCount !== 1 ? 's' : ''}  •  grows nightly`, {
      fontSize: '11px', fontFamily: 'Courier New', color: '#555555',
    }).setOrigin(0.5);

    // Merge all sections into one course
    const allTiles = this._mergeSections(gauntlet.sections);
    const course = {
      id: `gauntlet_s${gauntlet.seasonId}`,
      authorId: 'gauntlet',
      authorName: 'The Community',
      title: `Gauntlet Season ${gauntlet.seasonId}`,
      tiles: allTiles,
      medals: { bronze: 120000, silver: 90000, gold: 60000, author: 40000 },
      createdAt: gauntlet.updatedAt,
    };

    // Play button
    this._btn(W / 2, H * 0.48, '▶ RACE THE GAUNTLET', '#0a0a0f', '#e8ff47', () => {
      this.scene.start('Game', { course, isGauntlet: true });
    });

    // Latest contributors
    const recent = gauntlet.sections.slice(-3).reverse();
    if (recent.length) {
      this.add.text(W / 2, H * 0.6, 'RECENT ADDITIONS', {
        fontSize: '11px', fontFamily: 'Courier New', color: '#555555',
      }).setOrigin(0.5);
      recent.forEach((sec, i) => {
        this.add.text(W / 2, H * 0.64 + i * 18, `${sec.proposerName} — ${sec.tiles.length} tiles`, {
          fontSize: '12px', fontFamily: 'Courier New', color: '#888888',
        }).setOrigin(0.5);
      });
    }

    // Propose next section
    this.add.text(W / 2, H * 0.78, 'Want to add a section? Build one:', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#444444',
    }).setOrigin(0.5);

    this._btn(W / 2, H * 0.84, '+ PROPOSE A SECTION', '#e8ff47', '#1a1a2f', () => {
      this.scene.start('Editor', { proposingGauntlet: true });
    });

    this._backBtn();
  }

  _mergeSections(sections) {
    const tiles = [];
    let offsetX = 0;
    for (const sec of sections) {
      for (const t of sec.tiles) {
        tiles.push({ ...t, x: t.x + offsetX });
      }
      offsetX += sec.width;
    }
    return tiles;
  }

  _btn(x, y, label, bgColor, textColor, cb) {
    const btn = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: 'Courier New', color: textColor,
      backgroundColor: bgColor === '#e8ff47' ? '#e8ff47' : bgColor,
      padding: { x: 16, y: 10 }, stroke: textColor, strokeThickness: bgColor === '#e8ff47' ? 0 : 1,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerup', cb);
    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1));
    return btn;
  }

  _backBtn() {
    const back = this.add.text(12, 12, '← BACK', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('Menu'));
  }
}
