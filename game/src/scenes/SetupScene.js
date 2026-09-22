import Phaser from 'phaser';
import { state } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { PAL, FONT_PIXEL, FONT_AR, pixelText, button, panel, hex } from '../core/Ui.js';

const AVATAR_COUNT = 4;

export default class SetupScene extends Phaser.Scene {
  constructor() { super('Setup'); }

  create() {
    this._started = false;        // reset, or a second run never begins
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PAL.night);
    this.selected = 0;

    panel(this, 16, 10, w - 32, h - 20, { depth: 10 });
    pixelText(this, w / 2, 26, 'NEW RUN', { size: 12, color: PAL.gold, origin: [0.5, 0.5], depth: 20 });
    pixelText(this, w / 2, 44, 'اختار شكلك، واكتب اسمك ومقولتك للدفعة', {
      size: 12, color: PAL.mint, origin: [0.5, 0.5], depth: 20, font: FONT_AR,
    });

    // Avatar picker.
    this.avatars = [];
    const startX = w / 2 - ((AVATAR_COUNT - 1) * 46) / 2;
    for (let i = 0; i < AVATAR_COUNT; i++) {
      const x = startX + i * 46;
      const frame = i * 12 + 1;                       // facing-down idle frame
      const box = this.add.rectangle(x, 84, 40, 48, hex(PAL.slate))
        .setDepth(18).setStrokeStyle(2, hex(PAL.steel)).setInteractive({ useHandCursor: true });
      const sprite = this.add.sprite(x, 84, 'player', frame).setScale(1.6).setDepth(20);
      box.on('pointerdown', () => this.select(i));
      this.avatars.push({ box, sprite });
      this.tweens.add({
        targets: sprite, y: 82, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    this.select(0);

    // Text fields, as real DOM inputs so phone keyboards behave.
    this.nameInput = this.makeField(w / 2, 132, 'اسمك / Your name', 20, state.playerName);
    this.quoteInput = this.makeField(w / 2, 172, 'مقولتك للدفعة / Your line', 90, state.playerQuote);

    this.startBtn = button(this, w / 2, 214, 150, 22, 'BEGIN PREP YEAR', () => this.begin(), {
      color: PAL.mint, size: 9, depth: 40,
    });
    pixelText(this, w / 2, 238, 'ENTER TO START  ·  ← → TO SWITCH AVATAR', {
      size: 6, color: PAL.steel, origin: [0.5, 0.5], depth: 20,
    });

    this.input.keyboard.on('keydown-LEFT', () => this.select((this.selected + AVATAR_COUNT - 1) % AVATAR_COUNT));
    this.input.keyboard.on('keydown-RIGHT', () => this.select((this.selected + 1) % AVATAR_COUNT));
    this.input.keyboard.on('keydown-ENTER', () => this.begin());
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Title'));
  }

  makeField(x, y, placeholder, maxLength, value = '') {
    const html = `
      <input type="text" maxlength="${maxLength}" placeholder="${placeholder}" value="${value.replace(/"/g, '&quot;')}"
        style="width:280px;padding:7px 9px;border:2px solid ${PAL.steel};border-radius:3px;
               background:${PAL.ink};color:${PAL.paper};font-family:${FONT_AR};font-size:13px;
               outline:none;text-align:center;box-sizing:border-box;" />`;
    const el = this.add.dom(x, y).createFromHTML(html).setDepth(30);
    const input = el.node.querySelector('input');
    input.addEventListener('focus', () => { input.style.borderColor = PAL.mint; });
    input.addEventListener('blur', () => { input.style.borderColor = PAL.steel; });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.begin();
    });
    return input;
  }

  select(index) {
    this.selected = index;
    audio.sfx('select');
    this.avatars.forEach(({ box }, i) => {
      box.setStrokeStyle(2, hex(i === index ? PAL.gold : PAL.steel));
      box.setFillStyle(hex(i === index ? PAL.steel : PAL.slate));
    });
  }

  begin() {
    if (this._started) return;
    this._started = true;
    audio.unlock();
    audio.sfx('powerup');
    state.startRun({
      name: (this.nameInput?.value || '').trim() || 'Engineer',
      quote: (this.quoteInput?.value || '').trim(),
      avatarRow: this.selected,
    });
    this.scene.start('Terminal', { level: 1 });
  }
}
