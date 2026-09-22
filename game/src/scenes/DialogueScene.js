import Phaser from 'phaser';
import { audio } from '../core/AudioEngine.js';
import { makeBabyPortrait, registerImage } from '../core/PixelArt.js';
import { PAL, FONT_AR, FONT_PIXEL, pixelText, panel, hex } from '../core/Ui.js';

const PORTRAIT = 64;

/**
 * The retro conversation box: baby photo on the right, name and line on the
 * left, typed out one character at a time with a keyboard tick.
 */
export default class DialogueScene extends Phaser.Scene {
  constructor() { super('Dialogue'); }

  init(data) {
    this._closing = false;        // reset, or the box never closes again
    this.typing = false;
    this.payload = data || {};
    this.from = data?.from || 'Level';
  }

  create() {
    const { width: w, height: h } = this.scale;
    const boxH = 104;
    const boxY = h - boxH - 8;
    const boxX = 10;
    const boxW = w - 20;

    this.add.rectangle(0, 0, w, h, hex(PAL.ink), 0.55).setOrigin(0).setDepth(600).setInteractive();
    panel(this, boxX, boxY, boxW, boxH, { depth: 610, fill: PAL.night, accent: PAL.gold });

    const isStaff = this.payload.kind === 'staff';
    const person = isStaff ? this.payload.staff : this.payload.student;

    // Portrait, framed.
    const px = boxX + boxW - PORTRAIT - 14;
    const py = boxY + 18;
    const frame = this.add.graphics().setDepth(620);
    frame.fillStyle(hex(PAL.steel), 1);
    frame.fillRect(px - 3, py - 3, PORTRAIT + 6, PORTRAIT + 6);
    frame.lineStyle(2, hex(PAL.gold), 1);
    frame.strokeRect(px - 3, py - 3, PORTRAIT + 6, PORTRAIT + 6);

    this.showPortrait(px, py, person, isStaff);

    // Name and nickname.
    const nameX = boxX + 16;
    const title = isStaff ? person.nameAr : person.full_name;
    this.add.text(nameX, boxY + 12, title, {
      fontFamily: FONT_AR, fontSize: '15px', color: PAL.gold,
    }).setDepth(625).setResolution(2);

    const sub = isStaff
      ? person.name
      : (person.nickname ? `(${person.nickname})` : `Class of 2026 · #${person.id}`);
    this.add.text(nameX, boxY + 32, sub, {
      fontFamily: isStaff ? FONT_PIXEL : FONT_AR, fontSize: isStaff ? '7px' : '11px', color: PAL.mist,
    }).setDepth(625).setResolution(2);

    // The line itself, typed.
    this.line = this.add.text(nameX, boxY + 52, '', {
      fontFamily: FONT_AR,
      fontSize: '13px',
      color: PAL.paper,
      wordWrap: { width: boxW - PORTRAIT - 52, useAdvancedWrap: true },
      lineSpacing: 3,
    }).setDepth(625).setResolution(2);

    const text = this.pickLine(person, isStaff);
    this.typeOut(text);

    this.hint = pixelText(this, boxX + boxW - 12, boxY + boxH - 10, 'SPACE', {
      size: 7, color: PAL.steel, origin: [1, 1], depth: 630,
    });

    if (this.payload.first && !isStaff) {
      pixelText(this, nameX, boxY + boxH - 16, '+8 GPA  ·  NEW', {
        size: 8, color: PAL.mint, depth: 630,
      });
    }
    if (isStaff && this.payload.used) {
      pixelText(this, nameX, boxY + boxH - 16, 'ALREADY HELPED YOU', {
        size: 7, color: PAL.steel, depth: 630,
      });
    }

    this.input.keyboard.on('keydown-SPACE', () => this.advance());
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.on('pointerdown', () => this.advance());
  }

  pickLine(person, isStaff) {
    if (!isStaff) return person.custom_quote || '...';
    const lines = person.lines || ['...'];
    if (this.payload.used) return lines[lines.length - 1];
    return lines[Math.floor(Math.random() * Math.max(1, lines.length - 1))];
  }

  showPortrait(x, y, person, isStaff) {
    const key = `portrait:${isStaff ? person.id : person.id}`;
    const place = () => {
      this.add.image(x, y, key).setOrigin(0).setDisplaySize(PORTRAIT, PORTRAIT).setDepth(622);
    };

    if (this.textures.exists(key)) { place(); return; }

    const url = !isStaff ? person.baby_photo_url : '';
    if (url) {
      // A real baby photo, imported from the Drive folder.
      this.load.image(key, url);
      this.load.once('complete', () => {
        if (this.textures.exists(key)) place();
        else this.fallbackPortrait(key, person, place);
      });
      this.load.once('loaderror', () => this.fallbackPortrait(key, person, place));
      this.load.start();
      return;
    }
    this.fallbackPortrait(key, person, place);
  }

  /** No photo yet — draw a deterministic pixel baby instead of an empty box. */
  fallbackPortrait(key, person, place) {
    if (!this.textures.exists(key)) {
      registerImage(this, key, makeBabyPortrait(person.id + (person.full_name || ''), PORTRAIT));
    }
    place();
  }

  typeOut(text) {
    this.fullText = text;
    this.index = 0;
    this.typing = true;
    this.timer = this.time.addEvent({
      delay: 26,
      loop: true,
      callback: () => {
        if (this.index >= this.fullText.length) {
          this.typing = false;
          this.timer.remove();
          this.hint.setText('SPACE ▶');
          return;
        }
        this.index++;
        this.line.setText(this.fullText.slice(0, this.index));
        if (this.index % 2 === 0) audio.sfx('talk');
      },
    });
  }

  advance() {
    if (this.typing) {                       // first press fills the line in
      this.typing = false;
      this.timer?.remove();
      this.line.setText(this.fullText);
      this.hint.setText('SPACE ▶');
      return;
    }
    this.close();
  }

  close() {
    if (this._closing) return;
    this._closing = true;
    audio.sfx('back');
    this.scene.stop();
    this.scene.resume(this.from, { completed: true });
  }
}
