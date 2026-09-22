import Phaser from 'phaser';
import { state } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { PAL, FONT_PIXEL, FONT_AR, pixelText } from '../core/Ui.js';

/**
 * The black screen between years. Types out a build log, because that is how
 * every one of these transitions actually felt.
 */
export default class TerminalScene extends Phaser.Scene {
  constructor() { super('Terminal'); }

  init(data) {
    this.levelId = data.level ?? 1;
    this.mode = data.mode ?? 'enter';     // 'enter' | 'boss'
    // Scene instances are reused between years; clear last year's run state.
    this._done = false;
    this.ready = false;
    this.timer = null;
    this._probe = null;
  }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor('#04060a');

    const cfg = state.levelConfig(this.levelId);
    const lines = this.mode === 'boss'
      ? ['> linking Graduation_Project ...',
         '> Dr. Shereen Youssef has entered the room',
         '> starting defense ...']
      : cfg.terminal;

    pixelText(this, 16, 14, `AAST://year_${this.levelId}`, { size: 7, color: PAL.steel });
    this.body = pixelText(this, 16, 36, '', { size: 8, color: PAL.mint, lineSpacing: 7 });
    this.cursor = pixelText(this, 16, 36, '_', { size: 8, color: PAL.mint });

    this.header = pixelText(this, w / 2, h - 58, '', {
      size: 12, color: PAL.gold, origin: [0.5, 0.5],
    });
    this.subheader = pixelText(this, w / 2, h - 38, '', {
      size: 13, color: PAL.paper, origin: [0.5, 0.5], font: FONT_AR,
    });
    this.hint = pixelText(this, w / 2, h - 16, '', {
      size: 11, color: PAL.mist, origin: [0.5, 0.5], font: FONT_AR,
      wrap: w - 48, align: 'center',
    });

    this.typeLines(lines, cfg);
    this.input.keyboard.once('keydown-SPACE', () => this.finish());
    this.input.once('pointerdown', () => this.finish());
  }

  typeLines(lines, cfg) {
    let li = 0;
    let ci = 0;
    let shown = '';

    this.timer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (li >= lines.length) return;
        const line = lines[li];
        if (ci < line.length) {
          shown += line[ci];
          ci++;
          if (ci % 3 === 0) audio.sfx('talk');
          this.body.setText(shown);
          const lastLine = shown.slice(shown.lastIndexOf('\n') + 1);
          this.cursor.setPosition(16 + this.measure(lastLine), 36 + (li * 15));
        } else {
          shown += '\n';
          li++;
          ci = 0;
          if (li >= lines.length) this.onTyped(cfg);
        }
      },
    });
  }

  measure(text) {
    if (!this._probe) {
      this._probe = this.add.text(0, 0, '', { fontFamily: FONT_PIXEL, fontSize: '8px' })
        .setVisible(false);
    }
    this._probe.setText(text);
    return this._probe.width;
  }

  onTyped(cfg) {
    this.cursor.setVisible(false);
    if (this.mode === 'boss') {
      this.header.setText('FINAL DEFENSE');
      this.subheader.setText('قاعة المناقشة');
    } else {
      this.header.setText(`YEAR ${this.levelId} · ${cfg.place.toUpperCase()}`);
      this.subheader.setText(`${cfg.nameAr} — ${cfg.placeAr}`);
      if (state.settings.showHints) this.hint.setText(cfg.hint);
    }
    const prompt = pixelText(this, this.scale.width / 2, this.scale.height - 76,
      '▶ SPACE / TAP TO CONTINUE', {
        size: 7, color: PAL.steel, origin: [0.5, 0.5],
      });
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.ready = true;
    this.time.delayedCall(6000, () => this.ready && this.finish());
  }

  finish() {
    if (this._done) return;
    this._done = true;
    this.timer?.remove();
    audio.sfx('select');
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.mode === 'boss') this.scene.start('Boss');
      else this.scene.start('Level', { level: this.levelId });
    });
  }
}
