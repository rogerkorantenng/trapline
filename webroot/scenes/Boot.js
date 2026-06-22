class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // Fetch initial data from Devvit
    rpc('INIT', {}, 'INIT_RESPONSE').then((data) => {
      window.GAME_STATE = {
        username: data.username || 'Anonymous',
        userId: data.userId || 'anon',
        gauntlet: data.gauntlet || null,
        daily: data.daily || null,
      };
      document.getElementById('loading').style.display = 'none';
      this.scene.start('Menu');
    }).catch(() => {
      // Offline/dev fallback
      window.GAME_STATE = { username: 'Dev', userId: 'dev', gauntlet: null, daily: null };
      document.getElementById('loading').style.display = 'none';
      this.scene.start('Menu');
    });
  }
}
