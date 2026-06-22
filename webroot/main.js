const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 640,
  },
  scene: [BootScene, MenuScene, GameScene, EditorScene, ResultsScene, GauntletScene],
};

const game = new Phaser.Game(config);
