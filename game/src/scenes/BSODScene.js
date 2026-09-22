import Phaser from 'phaser';
import { state } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { PAL, FONT_PIXEL, pixelText, hex } from '../core/Ui.js';

const MESSAGES = {
  PROJECT_FAILED_TO_COMPILE: 'Error: Project Failed to Compile',
  BATTERY_DEPLETED: 'Error: Laptop Battery Depleted',
  DEADLINE_EXCEEDED: 'Error: Deadline Exceeded',
};

const STOP_CODES = {
  PROJECT_FAILED_TO_COMPILE: 'DEFENSE_NOT_READY',
  BATTERY_DEPLETED: 'NO_POWER_NO_CODE',
  DEADLINE_EXCEEDED: 'TIME_IS_A_FLAT_CIRCLE',
};

/** The blue screen. Everyone in this class has earned the right to laugh at it. */
export default class BSODScene extends Phaser.Scene {
  constructor() { super('BSOD'); }

  init(data) {
    this._going = false;          // reset, or the second crash never recovers
    this.reason = data?.reason || 'PROJECT_FAILED_TO_COMPILE';
    this.resume = data?.resume || { scene: 'Level', level: state.level };
  }

  create() {
    audio.sfx('bsod');
    this.glitch();
    this.time.delayedCall(820, () => this.blueScreen());
  }

  /** Half a second of the screen falling apart before the blue lands. */
  glitch() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor('#000000');
    const g = this.add.graphics().setDepth(10);
    const colours = [PAL.coral, PAL.mint, PAL.sky, PAL.violet, PAL.gold, PAL.paper];

    this.glitchTimer = this.time.addEvent({
      delay: 34,
      repeat: 22,
      callback: () => {
        g.clear();
        for (let i = 0; i < 16; i++) {
          const y = Math.random() * h;
          const bh = 2 + Math.random() * 14;
          const x = (Math.random() - 0.5) * 60;
          g.fillStyle(hex(colours[Math.floor(Math.random() * colours.length)]),
            0.25 + Math.random() * 0.5);
          g.fillRect(x, y, w + 60, bh);
        }
      },
      callbackScope: this,
    });
    this.cameras.main.shake(800, 0.014);
    this.time.delayedCall(820, () => g.destroy());
  }

  blueScreen() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PAL.screenBlue);

    pixelText(this, 28, 34, ':(', { size: 34, color: PAL.paper });

    pixelText(this, 28, 86, 'Your project ran into a problem and needs', {
      size: 8, color: PAL.paper,
    });
    pixelText(this, 28, 100, 'to restart. Your classmates are still there.', {
      size: 8, color: PAL.paper,
    });

    this.pct = pixelText(this, 28, 128, '0% complete', { size: 9, color: PAL.paper });
    let value = 0;
    this.time.addEvent({
      delay: 48,
      repeat: 40,
      callback: () => {
        value = Math.min(100, value + Phaser.Math.Between(1, 7));
        this.pct.setText(`${value}% complete`);
      },
    });

    pixelText(this, 28, h - 74, MESSAGES[this.reason] || MESSAGES.PROJECT_FAILED_TO_COMPILE, {
      size: 8, color: PAL.gold,
    });
    pixelText(this, 28, h - 58, `Stop code: ${STOP_CODES[this.reason] || 'UNKNOWN'}`, {
      size: 7, color: PAL.mist,
    });
    pixelText(this, 28, h - 44, `Deaths this run: ${state.deaths}`, {
      size: 7, color: PAL.mist,
    });

    const prompt = pixelText(this, w / 2, h - 20, '▶ SPACE / TAP TO CONTINUE', {
      size: 8, color: PAL.paper, origin: [0.5, 0.5],
    });
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 620, yoyo: true, repeat: -1 });

    this.time.delayedCall(900, () => {
      this.input.keyboard.once('keydown-SPACE', () => this.continueRun());
      this.input.once('pointerdown', () => this.continueRun());
    });
  }

  continueRun() {
    if (this._going) return;
    this._going = true;
    audio.sfx('select');
    // A retry, not a reset: you keep your GPA, your classmates and your gear.
    state.battery = Math.max(60, state.maxBattery * 0.6);
    state.powerups.shield = 0;
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.resume.scene === 'Boss') this.scene.start('Boss');
      else this.scene.start('Level', { level: this.resume.level ?? state.level });
    });
  }
}
