import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { MoonScene } from './scenes/MoonScene';

const debugParams = new URLSearchParams(window.location.search);
const isDebug = debugParams.get('debug') === '1';

const setViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

setViewportHeight();
window.addEventListener('resize', setViewportHeight);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 480,
  height: 854,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#1A1E2A',
  scene: [PreloadScene, GameScene, UIScene, MoonScene],
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0.9 },
      positionIterations: 8,
      velocityIterations: 6,
      debug: isDebug,
    },
  },
  pixelArt: true, // No anti-aliasing
  antialias: false,
  roundPixels: true,
};

export default new Phaser.Game(config);
