import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  private static readonly BASE_WIDTH = 480;
  private static readonly BASE_HEIGHT = 854;

  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.applyViewport();
    this.scale.on('resize', this.applyViewport, this);

    // Generate synthesized sounds and graphic assets here
    // Example: Create ball texture, peg bloom textures, synth WebAudio

    // Draw loading text using pixel font
    const loadingText = this.add.text(
      PreloadScene.BASE_WIDTH / 2,
      PreloadScene.BASE_HEIGHT / 2,
      'LOADING...',
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '24px',
        color: '#FFB300',
      }
    );
    loadingText.setOrigin(0.5, 0.5);

    this.generateAssets();
    this.synthesizeAudio();
  }

  create() {
    // Launch game scene and UI scene in parallel
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  private applyViewport(): void {
    const { width, height } = this.scale;
    const zoom = Math.min(
      width / PreloadScene.BASE_WIDTH,
      height / PreloadScene.BASE_HEIGHT
    );
    const roundedZoom = Math.max(0.5, Math.floor(zoom * 100) / 100);
    this.cameras.main.setZoom(roundedZoom);
    this.cameras.main.centerOn(
      PreloadScene.BASE_WIDTH / 2,
      PreloadScene.BASE_HEIGHT / 2
    );
  }

  private generateAssets(): void {
    const g = this.add.graphics();

    // 1. Ball (20x20) bounds (scaled down to match smaller hitbox)
    g.clear();
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(10, 11, 18, 15); // drop shadow
    g.fillStyle(0x1a1a2a);
    g.fillCircle(8, 8, 9); // shadow hemi
    g.fillStyle(0x6a6e78);
    g.fillCircle(8, 8, 8); // chrome mid
    g.fillStyle(0xb0b8c8);
    g.fillCircle(6, 6, 6); // chrome light
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(4, 4, 3); // spec
    g.generateTexture('ball', 20, 20);

    // 2. Peg (14x14) bounds (scaled to match hitbox)
    g.clear();
    g.fillStyle(0x1a1a2e, 0.8);
    g.fillCircle(8, 8, 6); // shadow offset
    g.fillStyle(0x3a3f50);
    g.fillCircle(7, 7, 5); // base body
    g.fillStyle(0x6a6e78);
    g.fillCircle(7, 7, 4); // mid ring
    g.fillStyle(0xb0b8c8);
    g.fillCircle(6, 6, 3); // highlight
    g.fillStyle(0xffffff);
    g.fillRect(5, 5, 2, 2); // pin highlight
    g.generateTexture('peg', 14, 14);

    // 2b. Elastic washer (16x16) — first peg row bumper ring
    g.clear();
    g.fillStyle(0x1a1a2e, 0.8);
    g.fillCircle(8, 9, 7);
    g.fillStyle(0x7a1828);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0x0a1628);
    g.fillCircle(8, 8, 3);
    g.lineStyle(2, 0xff3344);
    g.strokeCircle(8, 8, 6);
    g.fillStyle(0xff8899);
    g.fillRect(5, 5, 2, 2);
    g.generateTexture('peg_washer', 16, 16);

    // 3. Peg Bloom (32x32)
    g.clear();
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0xffffff, 1.0);
    g.fillCircle(16, 16, 4);
    g.generateTexture('peg_bloom', 32, 32);

    // 3b. Moon Rock Bloom (32x32)
    g.clear();
    g.fillStyle(0x9fb5c9, 0.3);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xbad0df, 0.7);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(16, 16, 4);
    g.generateTexture('moon_bloom', 32, 32);

    // 4. Lit Tunnel LED (20x20)
    g.clear();
    g.fillStyle(0xff1a1a, 0.12);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0xff1a1a, 0.25);
    g.fillCircle(10, 10, 8);
    g.fillStyle(0xff1a1a, 0.5);
    g.fillCircle(10, 10, 6);
    g.fillStyle(0xff1a1a, 1.0);
    g.fillCircle(10, 10, 4);
    g.fillStyle(0xffffff, 1.0);
    g.fillRect(9, 9, 2, 2);
    g.generateTexture('led_lit', 20, 20);

    // 4. Unlit Tunnel LED
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillCircle(10, 10, 5);
    g.generateTexture('led_unlit', 20, 20);

    // 5. Astronaut Mascot (64x64)
    g.clear();
    g.fillStyle(0x4a7fa8);
    g.fillRect(16, 24, 32, 40); // suit body
    g.fillStyle(0x3a3f50);
    g.fillRect(8, 24, 12, 16);
    g.fillRect(44, 24, 12, 16); // shoulders
    g.fillStyle(0x888ea0);
    g.fillCircle(32, 24, 18); // helmet
    g.fillStyle(0x0d2040);
    g.fillRect(20, 14, 24, 16); // visor
    g.fillStyle(0xffffff);
    g.fillRect(22, 16, 4, 2); // glint
    g.fillStyle(0xffb300);
    g.fillRect(24, 40, 16, 10); // badge
    g.fillStyle(0x888ea0);
    g.fillRect(30, 0, 2, 10); // antenna
    g.fillStyle(0xff1a1a);
    g.fillRect(29, 0, 4, 4); // red tip
    g.generateTexture('astronaut', 64, 64);

    // 5b. Moon Rock Peg (14x14)
    g.clear();
    g.fillStyle(0x2b313a, 0.9);
    g.fillCircle(8, 8, 6);
    g.fillStyle(0x6a6e78);
    g.fillCircle(7, 7, 5);
    g.fillStyle(0x9fb5c9);
    g.fillCircle(6, 6, 3);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(5, 5, 2, 2);
    g.generateTexture('moon_rock', 14, 14);

    // 5c. Moon Rock Peg (Big 20x20)
    g.clear();
    g.fillStyle(0x2b313a, 0.9);
    g.fillCircle(10, 10, 8);
    g.fillStyle(0x6a6e78);
    g.fillCircle(9, 9, 7);
    g.fillStyle(0x9fb5c9);
    g.fillCircle(8, 8, 5);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(6, 6, 3, 3);
    g.generateTexture('moon_rock_big', 20, 20);

    // 5d. Moon Background (64x64)
    g.clear();
    g.fillStyle(0x0b1420);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x111c2b, 0.9);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x1a2433, 0.7);
    for (let i = 0; i < 60; i++) {
      g.fillRect(Phaser.Math.Between(0, 63), Phaser.Math.Between(0, 63), 1, 1);
    }
    g.fillStyle(0x2a3646, 0.5);
    for (let i = 0; i < 10; i++) {
      const cx = Phaser.Math.Between(6, 58);
      const cy = Phaser.Math.Between(6, 58);
      const r = Phaser.Math.Between(6, 14);
      g.fillCircle(cx, cy, r);
    }
    g.fillStyle(0x0f1722, 0.6);
    for (let i = 0; i < 8; i++) {
      const cx = Phaser.Math.Between(8, 56);
      const cy = Phaser.Math.Between(8, 56);
      const r = Phaser.Math.Between(4, 10);
      g.fillCircle(cx, cy, r);
    }
    g.generateTexture('moon_bg', 64, 64);

    // 6. Repeating Tile Texture (8x8)
    g.clear();
    g.fillStyle(0x050b14);
    g.fillRect(0, 0, 8, 8);
    g.fillStyle(0x0a1628);
    g.fillRect(0, 0, 4, 4);
    g.fillRect(4, 4, 4, 4);
    g.generateTexture('bg_tile', 8, 8);

    g.destroy();
  }

  private synthesizeAudio(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const sampleRate = audioCtx.sampleRate;

      // Helper to add buffer
      const addBuffer = (
        key: string,
        duration: number,
        fillFunc: (i: number, t: number) => number
      ) => {
        const length = Math.ceil(sampleRate * duration);
        const buffer = audioCtx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = fillFunc(i, i / sampleRate);
        }
        this.cache.audio.add(key, buffer);
      };

      // sfx_launch: White noise burst, exp decay 18x, 0.15s
      addBuffer('sfx_launch', 0.15, (_i, t) => {
        return (Math.random() * 2 - 1) * Math.exp(-18 * t);
      });

      // sfx_peg: Sine wave 1000Hz, exp decay 40x, 0.06s
      addBuffer('sfx_peg', 0.06, (_i, t) => {
        return Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-40 * t);
      });

      // sfx_win: Rising 4-note chime C5(523.25)->E5(659.25)->G5(783.99)->C6(1046.50), 0.8s
      addBuffer('sfx_win', 0.8, (_i, t) => {
        const noteIdx = Math.floor(t / 0.2);
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        const f = freqs[noteIdx] || 1046.5;
        const noteT = t % 0.2;
        return Math.sin(2 * Math.PI * f * t) * Math.exp(-10 * noteT) * 0.5;
      });

      // sfx_lose: Falling drone 300->100Hz, 0.4s
      addBuffer('sfx_lose', 0.4, (_i, t) => {
        const f = 300 - 200 * (t / 0.4);
        return Math.sin(2 * Math.PI * f * t) * Math.exp(-5 * t) * 0.5;
      });
    } catch (e) {
      console.warn('AudioContext not supported or failed to init headless', e);
    }
  }
}
