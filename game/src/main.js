import Phaser from 'phaser';
import config from './data/game_config.json';
import { state } from './core/GameState.js';
import { audio } from './core/AudioEngine.js';

import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import SetupScene from './scenes/SetupScene.js';
import TerminalScene from './scenes/TerminalScene.js';
import LevelScene from './scenes/LevelScene.js';
import UIScene from './scenes/UIScene.js';
import DialogueScene from './scenes/DialogueScene.js';
import BossScene from './scenes/BossScene.js';
import BSODScene from './scenes/BSODScene.js';
import CreditsScene from './scenes/CreditsScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: config.viewWidth,
  height: config.viewHeight,
  backgroundColor: config.palette.ink,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [
    BootScene, TitleScene, SetupScene, TerminalScene,
    LevelScene, UIScene, DialogueScene, BossScene, BSODScene, CreditsScene,
  ],
});

// Audio needs a gesture before it is allowed to make a sound.
const unlock = () => {
  audio.unlock();
  audio.setMuted(state.settings.muted);
};
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// Hide the HTML fallback once Phaser has a canvas up.
game.events.once('ready', () => {
  document.getElementById('boot-fallback')?.remove();
});

// Handles for the automated smoke test (scripts/smoke.mjs).
window.__game = game;
window.__state = state;

export default game;
