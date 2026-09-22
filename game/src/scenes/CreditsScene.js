import Phaser from 'phaser';
import config from '../data/game_config.json';
import { state, formatTime } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { makeBabyAtlas, registerSheet, ITEM } from '../core/PixelArt.js';
import { PAL, FONT_AR, FONT_PIXEL, pixelText, button, panel, toast, hex } from '../core/Ui.js';
import { submit, top as leaderboardTop, remoteEnabled } from '../core/Leaderboard.js';
import { STUDENTS } from './BootScene.js';

const THUMB = 32;
const COLS = 16;

/** You graduated. Now watch 188 people scroll past, then go brag about it. */
export default class CreditsScene extends Phaser.Scene {
  constructor() { super('Credits'); }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PAL.ink);
    this.entry = state.recordFinish();

    this.buildWall();
    this.buildHeader(w);
    this.buildPanel(w, h);
    this.syncLeaderboard();

    audio.unlock();
    audio.playSong('victory');
    this.cameras.main.fadeIn(700, 255, 255, 255);
  }

  /* ── the scrolling wall of classmates ────────────────────────────── */

  buildWall() {
    const { width: w, height: h } = this.scale;
    registerSheet(this, 'babies', makeBabyAtlas(STUDENTS, THUMB, COLS), THUMB, THUMB);

    this.wall = this.add.container(0, 0).setDepth(5).setAlpha(0.5);
    const gap = 6;
    const cell = THUMB + gap;
    const perRow = Math.max(1, Math.floor((w - 20) / cell));
    const startX = (w - perRow * cell + gap) / 2;

    this.tiles = [];
    STUDENTS.forEach((person, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = startX + col * cell;
      const y = h + 24 + row * (cell + 12);

      const img = this.add.image(x, y, 'babies', i).setOrigin(0);
      const label = this.add.text(x + THUMB / 2, y + THUMB + 2,
        (person.nickname || person.full_name).slice(0, 14), {
          fontFamily: FONT_AR, fontSize: '8px', color: PAL.mist, align: 'center',
        }).setOrigin(0.5, 0).setResolution(2);

      this.wall.add([img, label]);
      this.tiles.push({ img, person });
    });

    this.wallHeight = Math.ceil(STUDENTS.length / perRow) * (cell + 12) + h + 80;
    this.tweens.add({
      targets: this.wall,
      y: -this.wallHeight,
      duration: Math.max(38000, STUDENTS.length * 320),
      ease: 'Linear',
      repeat: -1,
    });

    this.loadRealPhotos();
  }

  /** Swap in real baby photos as they arrive; placeholders show meanwhile. */
  loadRealPhotos() {
    const withPhotos = STUDENTS
      .map((person, i) => ({ person, i }))
      .filter(({ person }) => person.baby_photo_url);
    if (!withPhotos.length) return;

    for (const { person, i } of withPhotos) {
      const key = `photo:${person.id}`;
      if (this.textures.exists(key)) { this.tiles[i]?.img.setTexture(key); continue; }
      this.load.image(key, person.baby_photo_url);
    }
    this.load.on('filecomplete', (key) => {
      const hit = withPhotos.find(({ person }) => `photo:${person.id}` === key);
      if (!hit) return;
      const tile = this.tiles[hit.i];
      if (!tile) return;
      tile.img.setTexture(key);
      tile.img.setDisplaySize(THUMB, THUMB);
    });
    this.load.start();
  }

  /* ── header and stats ────────────────────────────────────────────── */

  buildHeader(w) {
    this.add.rectangle(0, 0, w, 74, hex(PAL.ink), 0.86).setOrigin(0).setDepth(20);
    this.add.image(w / 2 - 84, 22, 'items', ITEM.CAP).setScale(1.6).setDepth(30);
    this.add.image(w / 2 + 84, 22, 'items', ITEM.TROPHY).setScale(1.6).setDepth(30);
    pixelText(this, w / 2, 14, 'YOU GRADUATED', {
      size: 14, color: PAL.gold, origin: [0.5, 0], depth: 30,
    });
    this.add.text(w / 2, 36, `مبروك يا ${state.playerName} — دفعة ٢٠٢٦`, {
      fontFamily: FONT_AR, fontSize: '13px', color: PAL.mint,
    }).setOrigin(0.5, 0).setDepth(30).setResolution(2);

    if (state.playerQuote) {
      this.add.text(w / 2, 55, `“${state.playerQuote}”`, {
        fontFamily: FONT_AR, fontSize: '11px', color: PAL.mist, align: 'center',
        wordWrap: { width: w - 60, useAdvancedWrap: true },
      }).setOrigin(0.5, 0).setDepth(30).setResolution(2);
    }
  }

  buildPanel(w, h) {
    const pw = 244;
    const ph = 150;
    const px = w / 2 - pw / 2;
    const py = 84;
    panel(this, px, py, pw, ph, { depth: 40, accent: PAL.gold });

    const stats = [
      ['TIME', formatTime(this.entry.timeMs), PAL.gold],
      ['GPA', this.entry.gpa.toFixed(2), PAL.mint],
      ['CLASSMATES', `${this.entry.met}/${STUDENTS.length}`, PAL.sky],
      ['BSODs', String(state.deaths), PAL.coral],
    ];
    stats.forEach(([label, value, colour], i) => {
      const y = py + 12 + i * 15;
      pixelText(this, px + 14, y, label, { size: 7, color: PAL.steel, depth: 50 });
      pixelText(this, px + pw - 14, y, value, {
        size: 8, color: colour, origin: [1, 0], depth: 50,
      });
    });

    this.boardText = pixelText(this, px + 14, py + 78, 'SUBMITTING RUN...', {
      size: 6, color: PAL.mist, depth: 50,
    });

    button(this, px + 60, py + ph - 38, 104, 18, 'SHARE ON X', () => this.share('x'), {
      color: PAL.sky, size: 7, depth: 60,
    });
    button(this, px + 178, py + ph - 38, 104, 18, 'LINKEDIN', () => this.share('linkedin'), {
      color: PAL.mint, size: 7, depth: 60,
    });
    button(this, px + 60, py + ph - 16, 104, 18, 'COPY TEXT', () => this.share('copy'), {
      color: PAL.violet, size: 7, depth: 60,
    });
    button(this, px + 178, py + ph - 16, 104, 18, 'PLAY AGAIN', () => this.again(), {
      color: PAL.gold, size: 7, depth: 60,
    });

    pixelText(this, w / 2, h - 10, 'THE CLASS OF 2026 · AASTMT', {
      size: 6, color: PAL.steel, origin: [0.5, 1], depth: 50,
    });
  }

  /* ── leaderboard + sharing ───────────────────────────────────────── */

  async syncLeaderboard() {
    const result = await submit(this.entry);
    const { source, rows } = await leaderboardTop(3);
    if (!this.boardText?.active) return;

    const place = rows.findIndex((r) =>
      r.name === this.entry.name && Math.abs(r.timeMs - this.entry.timeMs) < 1500);
    const where = source === 'global' ? 'GLOBAL' : 'THIS DEVICE';
    const rank = place >= 0 ? `  ·  #${place + 1} ${where}` : `  ·  ${where}`;
    this.boardText.setText(
      (result.synced ? 'RUN SAVED' : remoteEnabled ? 'SAVED LOCALLY (OFFLINE)' : 'RUN SAVED') + rank
    );
    this.boardText.setColor(place === 0 ? PAL.gold : PAL.mist);

    rows.slice(0, 3).forEach((r, i) => {
      pixelText(this, this.scale.width / 2 - 108, 174 + i * 11,
        `${i + 1}. ${String(r.name).slice(0, 12)}`, { size: 6, color: PAL.steel, depth: 50 });
      pixelText(this, this.scale.width / 2 + 108, 174 + i * 11, formatTime(r.timeMs), {
        size: 6, color: PAL.steel, origin: [1, 0], depth: 50,
      });
    });
  }

  shareText() {
    return config.share.template
      .replace('{time}', formatTime(this.entry.timeMs))
      .replace('{gpa}', this.entry.gpa.toFixed(2));
  }

  async share(where) {
    audio.sfx('select');
    const text = this.shareText();
    const url = window.location.origin + window.location.pathname;

    if (where === 'copy') {
      await this.copy(`${text}\n${url}`);
      return;
    }
    if (where === 'x') {
      const tags = config.share.hashtags;
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` +
        `&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(tags)}`,
        '_blank', 'noopener'
      );
      return;
    }
    // LinkedIn dropped pre-filled text, so put it on the clipboard first.
    await this.copy(`${text}\n${url}`);
    toast(this, 'النص اتنسخ — الصقه في البوست', { color: PAL.mint, y: 250, duration: 2600 });
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank', 'noopener'
    );
  }

  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(this, 'اتنسخ!', { color: PAL.mint, y: 250, duration: 1400 });
    } catch {
      toast(this, 'مش قادر أنسخ — اعمل Screenshot', { color: PAL.amber, y: 250, duration: 2000 });
    }
  }

  again() {
    audio.sfx('select');
    audio.stopSong();
    this.scene.start('Title');
  }
}
