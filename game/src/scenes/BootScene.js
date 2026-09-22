import Phaser from 'phaser';
import config from '../data/game_config.json';
import studentData from '../data/students.json';
import {
  makeTileset, makeItems, makeCharacterSheet, lookFromSeed,
  registerSheet, CELL, CHAR_W, CHAR_H,
} from '../core/PixelArt.js';
import { PAL, FONT_PIXEL } from '../core/Ui.js';

export const STUDENTS = studentData.students || [];

/** Students grouped by the year they appear in, in a stable order. */
export const byStage = (stage) => STUDENTS.filter((s) => s.stage === stage);

const PLAYER_LOOKS = [
  { skin: '#e8b98c', hair: '#241c18', shirt: '#4fb4ff', pants: '#2f3b54', shoes: '#1b1f28', style: 'short', glasses: false, beard: false },
  { skin: '#e8b98c', hair: '#7a2f52', shirt: '#ff5d5d', pants: '#3c4a68', shoes: '#2b2119', style: 'hijab', glasses: false, beard: false },
  { skin: '#c9925f', hair: '#171514', shirt: '#4fe0a8', pants: '#1b2233', shoes: '#101216', style: 'curly', glasses: true, beard: true },
  { skin: '#f2c8a0', hair: '#412f22', shirt: '#ffc94a', pants: '#26303f', shoes: '#3a3f4c', style: 'long', glasses: true, beard: false },
];

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PAL.ink);
    const label = this.add.text(width / 2, height / 2, 'COMPILING CAMPUS...', {
      fontFamily: FONT_PIXEL, fontSize: '10px', color: PAL.mint,
    }).setOrigin(0.5);
    label.setResolution(2);
    this.add.text(width / 2, height / 2 + 18, 'AAST 2026', {
      fontFamily: FONT_PIXEL, fontSize: '8px', color: PAL.steel,
    }).setOrigin(0.5).setResolution(2);
  }

  async create() {
    // Give webfonts a moment so the first frame is not drawn in fallback type.
    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
    }

    const pal = config.palette;
    registerSheet(this, 'tiles', makeTileset(pal), CELL, CELL);
    registerSheet(this, 'items', makeItems(pal), CELL, CELL);
    registerSheet(this, 'player', makeCharacterSheet(PLAYER_LOOKS), CHAR_W, CHAR_H);

    const staffLooks = config.staff.map((s) => ({
      ...lookFromSeed(s.id),
      ...s.look,
      glasses: true,
      beard: s.look.style !== 'hijab',
    }));
    registerSheet(this, 'staff', makeCharacterSheet(staffLooks), CHAR_W, CHAR_H);

    const bossLook = { ...lookFromSeed('shereen'), ...config.boss.look, glasses: true, beard: false };
    registerSheet(this, 'boss', makeCharacterSheet([bossLook]), CHAR_W, CHAR_H);

    // One NPC sheet per level keeps every texture well under the 2048px limit
    // that older phones enforce.
    this.registry.set('npcRows', {});
    const rows = {};
    for (const level of config.levels) {
      const people = byStage(level.id);
      const looks = people.map((s) => lookFromSeed(s.id + s.full_name));
      registerSheet(this, `npc-${level.key}`, makeCharacterSheet(looks), CHAR_W, CHAR_H);
      rows[level.key] = people.map((s) => s.id);
    }
    this.registry.set('npcRows', rows);

    this.buildPlayerAnimations();
    this.scene.start('Title');
  }

  buildPlayerAnimations() {
    const dirs = ['down', 'left', 'right', 'up'];
    PLAYER_LOOKS.forEach((_, row) => {
      dirs.forEach((dir, d) => {
        const base = row * 12 + d * 3;
        const key = `p${row}-${dir}`;
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: [base, base + 1, base + 2, base + 1].map((f) => ({ key: 'player', frame: f })),
          frameRate: 7,
          repeat: -1,
        });
        const idle = `p${row}-${dir}-idle`;
        if (!this.anims.exists(idle)) {
          this.anims.create({
            key: idle,
            frames: [{ key: 'player', frame: base + 1 }],
            frameRate: 1,
          });
        }
      });
    });
  }
}
