import Phaser from 'phaser';
import config from '../data/game_config.json';
import { state, formatClock } from '../core/GameState.js';
import { ITEM } from '../core/PixelArt.js';
import { PAL, FONT_AR, pixelText, meter, hex } from '../core/Ui.js';
import { Joystick, isTouchDevice } from '../core/Joystick.js';

/** Heads-up display: laptop battery for health, GPA for score, deadline clock. */
export default class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  init(data) { this.levelId = data?.level ?? 1; }

  create() {
    const { width: w } = this.scale;
    const cfg = state.levelConfig(this.levelId);

    this.bar = this.add.graphics().setDepth(880).setScrollFactor(0);
    this.bar.fillStyle(hex(PAL.ink), 0.62);
    this.bar.fillRect(0, 0, w, 26);
    this.bar.lineStyle(1, hex(PAL.slate), 0.8);
    this.bar.lineBetween(0, 26, w, 26);

    // Battery = health.
    this.add.image(12, 9, 'items', ITEM.BATTERY).setScrollFactor(0).setDepth(900);
    this.battery = meter(this, 22, 5, 62, 9);
    this.batteryText = pixelText(this, 88, 4, '100%', { size: 8, color: PAL.mint, depth: 900 });

    // GPA = score.
    this.gpaLabel = pixelText(this, w - 8, 5, 'GPA 1.00', {
      size: 8, color: PAL.gold, origin: [1, 0], depth: 900,
    });
    this.pointsLabel = pixelText(this, w - 8, 16, '0 pts', {
      size: 7, color: PAL.mist, origin: [1, 0], depth: 900,
    });

    // Deadline clock and year progress.
    this.clock = pixelText(this, w / 2, 4, '0:00', {
      size: 10, color: PAL.paper, origin: [0.5, 0], depth: 900,
    });
    this.progress = pixelText(this, w / 2, 16, '', {
      size: 7, color: PAL.mist, origin: [0.5, 0], depth: 900,
    });

    // The year and place, on their own chip so they stay legible over grass.
    this.place = pixelText(this, 12, 33, `${cfg.nameAr} · ${cfg.placeAr}`, {
      size: 12, color: PAL.paper, depth: 901, font: FONT_AR,
    });
    this.add.rectangle(8, 30, this.place.width + 10, this.place.height + 5, hex(PAL.ink), 0.72)
      .setOrigin(0).setScrollFactor(0).setDepth(900);

    this.powerRow = [];
    this.buildPowerIcons();

    if (isTouchDevice()) {
      this.joystick = new Joystick(this, { depth: 1200 });
      this.joystick.button.on('pointerdown', () => {
        this.scene.get('Level')?.tryInteract?.();
      });
    }

    this.events.once('shutdown', () => this.joystick?.destroy());
  }

  buildPowerIcons() {
    const defs = [
      ['shield', ITEM.SHIELD, () => state.hasShield()],
      ['cleanCode', ITEM.BOOK, () => state.powerups.cleanCode],
      ['coffee', ITEM.CUP, () => state.hasCoffee()],
      ['extension', ITEM.CLOCK, () => state.powerups.extensions > 0],
    ];
    defs.forEach(([key, frame, test], i) => {
      const icon = this.add.image(14 + i * 18, 56, 'items', frame)
        .setScrollFactor(0).setDepth(900).setAlpha(0.18);
      this.powerRow.push({ icon, test });
    });
  }

  update() {
    const ratio = state.battery / state.maxBattery;
    const colour = ratio > 0.5 ? PAL.mint : ratio > 0.22 ? PAL.gold : PAL.coral;
    this.battery.draw(ratio, colour);
    this.batteryText.setText(`${Math.ceil(state.battery)}%`).setColor(colour);

    this.gpaLabel.setText(`GPA ${state.gpaText()}`);
    this.pointsLabel.setText(`${state.points} pts`);

    const low = state.timeLeft < 30;
    this.clock.setText(formatClock(state.timeLeft)).setColor(low ? PAL.coral : PAL.paper);
    if (low && !this._pulse) {
      this._pulse = this.tweens.add({
        targets: this.clock, scale: 1.12, duration: 380, yoyo: true, repeat: -1,
      });
    } else if (!low && this._pulse) {
      this._pulse.stop();
      this._pulse = null;
      this.clock.setScale(1);
    }

    const level = this.scene.get('Level');
    const goal = state.levelConfig(this.levelId).talkGoal || 0;
    const met = level?.metThisLevel ?? 0;
    this.progress.setText(met >= goal ? 'EXIT OPEN' : `CLASSMATES  ${met}/${goal}`);
    this.progress.setColor(met >= goal ? PAL.mint : PAL.mist);

    for (const { icon, test } of this.powerRow) icon.setAlpha(test() ? 1 : 0.18);
  }
}
