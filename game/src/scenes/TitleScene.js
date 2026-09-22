import Phaser from 'phaser';
import config from '../data/game_config.json';
import { state, formatTime } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { PAL, FONT_PIXEL, FONT_AR, pixelText, button, panel, hex } from '../core/Ui.js';
import { top as leaderboardTop, remoteEnabled } from '../core/Leaderboard.js';
import { STUDENTS } from './BootScene.js';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this._started = false;        // reset, or "Play again" does nothing
    this.board = null;
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PAL.ink);
    this.drawSkyline(w, h);

    pixelText(this, w / 2, 40, 'THE AAST', { size: 20, color: PAL.gold, origin: [0.5, 0.5] });
    pixelText(this, w / 2, 66, '2026 ODYSSEY', { size: 20, color: PAL.gold, origin: [0.5, 0.5] });
    pixelText(this, w / 2, 90, config.subtitle, {
      size: 13, color: PAL.mint, origin: [0.5, 0.5], font: FONT_AR,
    });
    pixelText(this, w / 2, 108, `${STUDENTS.length} ENGINEERS · 5 YEARS · 1 RUN`, {
      size: 7, color: PAL.mist, origin: [0.5, 0.5],
    });

    const blink = pixelText(this, w / 2, 140, '▶ PRESS SPACE TO START', {
      size: 9, color: PAL.paper, origin: [0.5, 0.5],
    });
    this.tweens.add({ targets: blink, alpha: 0.25, duration: 620, yoyo: true, repeat: -1 });

    this.startBtn = button(this, w / 2, 172, 132, 22, 'START RUN', () => this.begin(), {
      color: PAL.mint, size: 9,
    });
    this.boardBtn = button(this, w / 2 - 62, 200, 118, 18, 'LEADERBOARD', () => this.showBoard(), {
      color: PAL.sky, size: 7,
    });
    this.muteBtn = button(this, w / 2 + 62, 200, 118, 18, this.muteLabel(), () => this.toggleMute(), {
      color: PAL.violet, size: 7,
    });

    if (state.best) {
      pixelText(this, w / 2, 226, `YOUR BEST  ${formatTime(state.best.timeMs)}  ·  GPA ${state.best.gpa.toFixed(2)}`, {
        size: 7, color: PAL.gold, origin: [0.5, 0.5],
      });
    }
    pixelText(this, w / 2, h - 26, 'WASD / ARROWS TO MOVE  ·  SPACE TO TALK', {
      size: 7, color: PAL.mist, origin: [0.5, 0.5],
    });

    this.input.keyboard.once('keydown-SPACE', () => this.begin());
    this.input.once('pointerdown', () => audio.unlock());
    this.time.delayedCall(60, () => {
      if (audio.unlock()) audio.playSong('title');
    });
  }

  muteLabel() { return state.settings.muted ? 'SOUND: OFF' : 'SOUND: ON'; }

  toggleMute() {
    audio.unlock();
    state.settings.muted = audio.toggleMute();
    state.save();
    this.muteBtn.label.setText(this.muteLabel());
    if (!state.settings.muted) audio.playSong('title');
    audio.sfx('select');
  }

  /** A pixel skyline of the campus, drawn once behind the logo. */
  drawSkyline(w, h) {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(hex(PAL.night), 1);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {                       // stars
      const x = (i * 97) % w;
      const y = (i * 53) % 110;
      g.fillStyle(hex(PAL.paper), 0.1 + ((i % 5) * 0.12));
      g.fillRect(x, y, 1, 1);
    }
    const buildings = [
      [10, 150, 46, 120], [58, 176, 30, 94], [92, 140, 58, 130],
      [154, 184, 40, 86], [198, 158, 52, 112], [254, 178, 34, 92],
      [292, 146, 62, 124], [358, 182, 38, 88], [400, 164, 46, 106],
      [450, 190, 30, 80],
    ];
    buildings.forEach(([x, y, bw, bh], i) => {
      g.fillStyle(hex(i % 2 ? PAL.slate : PAL.steel), 1);
      g.fillRect(x, y, bw, bh);
      g.fillStyle(hex(PAL.gold), 0.75);
      for (let wy = y + 6; wy < y + bh - 6; wy += 9) {
        for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
          if ((wx + wy + i) % 3 === 0) g.fillRect(wx, wy, 3, 4);
        }
      }
    });
    g.fillStyle(hex(PAL.ink), 1);
    g.fillRect(0, h - 18, w, 18);
    // Darken the skyline behind the menu so the buttons stay the focus.
    g.fillStyle(hex(PAL.ink), 0.45);
    g.fillRect(0, 126, w, h - 126);
  }

  begin() {
    if (this._started) return;
    this._started = true;
    audio.unlock();
    audio.sfx('select');
    this.scene.start('Setup');
  }

  async showBoard() {
    audio.unlock();
    audio.sfx('select');
    if (this.board) { this.closeBoard(); return; }

    const { width: w, height: h } = this.scale;
    const bw = 300;
    const bh = 190;
    const bx = (w - bw) / 2;
    const by = (h - bh) / 2;
    this.board = [];
    this.board.push(this.add.rectangle(0, 0, w, h, hex(PAL.ink), 0.78)
      .setOrigin(0).setDepth(700).setInteractive());
    this.board.push(panel(this, bx, by, bw, bh, { depth: 701 }));
    this.board.push(pixelText(this, w / 2, by + 16, 'SPEEDRUN BOARD', {
      size: 9, color: PAL.gold, origin: [0.5, 0.5], depth: 710,
    }));

    const loading = pixelText(this, w / 2, by + 60, 'LOADING...', {
      size: 8, color: PAL.mist, origin: [0.5, 0.5], depth: 710,
    });
    this.board.push(loading);

    const { source, rows } = await leaderboardTop(8);
    if (!this.board) return;                        // closed while loading
    loading.destroy();
    this.board = this.board.filter((o) => o !== loading);

    this.board.push(pixelText(this, w / 2, by + 30,
      source === 'global' ? 'GLOBAL' : (remoteEnabled ? 'OFFLINE · LOCAL' : 'THIS DEVICE'), {
        size: 6, color: PAL.steel, origin: [0.5, 0.5], depth: 710,
      }));

    if (!rows.length) {
      this.board.push(pixelText(this, w / 2, by + 80, 'NO RUNS YET.\nBE THE FIRST.', {
        size: 8, color: PAL.mist, origin: [0.5, 0.5], align: 'center', depth: 710,
      }));
    } else {
      rows.forEach((r, i) => {
        const y = by + 46 + i * 15;
        const colour = i === 0 ? PAL.gold : i < 3 ? PAL.mint : PAL.paper;
        this.board.push(pixelText(this, bx + 14, y, `${i + 1}`.padStart(2, '0'), {
          size: 7, color: PAL.steel, depth: 710,
        }));
        this.board.push(this.add.text(bx + 34, y, String(r.name).slice(0, 16), {
          fontFamily: FONT_AR, fontSize: '11px', color: colour,
        }).setDepth(710).setResolution(2));
        this.board.push(pixelText(this, bx + bw - 76, y, formatTime(r.timeMs), {
          size: 7, color: colour, depth: 710,
        }));
        this.board.push(pixelText(this, bx + bw - 30, y, (r.gpa ?? 0).toFixed(2), {
          size: 7, color: PAL.sky, depth: 710,
        }));
      });
    }

    const close = button(this, w / 2, by + bh - 16, 90, 18, 'CLOSE', () => this.closeBoard(), {
      color: PAL.coral, size: 7, depth: 712,
    });
    this.board.push(close);
  }

  closeBoard() {
    if (!this.board) return;
    this.board.forEach((o) => o.destroy());
    this.board = null;
    audio.sfx('back');
  }
}
