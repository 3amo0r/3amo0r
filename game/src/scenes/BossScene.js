import Phaser from 'phaser';
import config from '../data/game_config.json';
import { state, formatClock } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { MapBuilder } from '../core/MapBuilder.js';
import { T, SOLID_TILES } from '../core/Tiles.js';
import { CELL, ITEM, frameFor } from '../core/PixelArt.js';
import { PAL, FONT_AR, pixelText, meter, toast, hex } from '../core/Ui.js';
import { Joystick, isTouchDevice } from '../core/Joystick.js';

const BOSS = config.boss;

/**
 * The defense. Dr. Shereen fires requirements at you; you dodge, grab commits
 * and push the deploy bar to 100%. Everything the professors gave you along
 * the way matters here: the shield eats a hit, Clean Code doubles each commit,
 * extensions buy time, coffee buys speed.
 */
export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  create() {
    this.deploy = 0;
    this.over = false;
    this.attackIndex = 0;
    state.beginLevel(5);
    state.timeLeft = Math.max(state.timeLeft, 120);

    this.buildArena();
    this.createPlayer();
    this.createBoss();
    this.createHud();
    this.bindInput();

    this.projectiles = this.physics.add.group();
    this.orbs = this.physics.add.group();
    this.physics.add.overlap(this.player, this.projectiles, (_p, shot) => this.hitBy(shot));
    this.physics.add.overlap(this.player, this.orbs, (_p, orb) => this.commit(orb));

    this.attackTimer = this.time.addEvent({
      delay: 1250, loop: true, callback: () => this.fire(),
    });
    this.orbTimer = this.time.addEvent({
      delay: 1800, loop: true, callback: () => this.spawnOrb(),
    });
    this.spawnOrb();

    audio.unlock();
    audio.playSong('boss');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.say(BOSS.openingLines[0]);
  }

  buildArena() {
    const b = new MapBuilder(30, 17, T.WALL, 0x5eed, T.CARPET);
    b.room(0, 0, 30, 17, T.CARPET, T.WALL);
    b.rect(1, 1, 28, 3, T.STAGE);
    b.hline(1, 28, 1, T.BOARD);
    for (let r = 0; r < 2; r++) {
      b.furnitureRow(3, 11 + r * 3, 8, 3, T.TABLE);
    }
    b.rect(26, 12, 2, 3, T.RACK);
    b.rect(2, 12, 2, 3, T.SHELF);

    this.worldW = b.width * CELL;
    this.worldH = b.height * CELL;

    const mk = (data, depth) => {
      const map = this.make.tilemap({ data, tileWidth: CELL, tileHeight: CELL });
      return map.createLayer(0, map.addTilesetImage('tiles'), 0, 0).setDepth(depth);
    };
    mk(b.groundData(), -20);
    this.props = mk(b.propData(), -10);
    this.props.setCollision(SOLID_TILES);

    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.arena = { x: CELL * 2, y: CELL * 6, w: CELL * 26, h: CELL * 10 };
  }

  createPlayer() {
    this.player = this.physics.add.sprite(this.worldW / 2, this.worldH - 44,
      'player', state.avatarRow * 12 + 9);
    this.player.setSize(10, 8).setOffset(3, 15);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.props);
    this.facing = 'up';
  }

  createBoss() {
    this.boss = this.add.sprite(this.worldW / 2, 58, 'boss', frameFor(0, 'down', 1)).setScale(1.5);
    this.boss.setDepth(60);
    this.tweens.add({
      targets: this.boss,
      x: { from: this.worldW * 0.28, to: this.worldW * 0.72 },
      duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.boss, y: 54, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  createHud() {
    const w = this.scale.width;
    this.add.rectangle(0, 0, w, 40, hex(PAL.ink), 0.68).setOrigin(0).setScrollFactor(0).setDepth(880);
    pixelText(this, w / 2, 4, 'FINAL DEFENSE', { size: 8, color: PAL.coral, origin: [0.5, 0], depth: 900 });
    this.add.text(w / 2, 15, BOSS.nameAr, {
      fontFamily: FONT_AR, fontSize: '12px', color: PAL.paper,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(900).setResolution(2);

    pixelText(this, 8, 30, 'DEPLOY', { size: 6, color: PAL.mint, depth: 900 });
    this.deployBar = meter(this, 46, 30, 150, 8);
    this.deployText = pixelText(this, 200, 30, '0%', { size: 7, color: PAL.mint, depth: 900 });

    pixelText(this, w - 8, 30, 'BATTERY', { size: 6, color: PAL.mist, origin: [1, 0], depth: 900 });
    this.batteryBar = meter(this, w - 150, 30, 90, 8);
    this.clock = pixelText(this, w - 8, 4, '0:00', { size: 8, color: PAL.paper, origin: [1, 0], depth: 900 });

    this.callout = this.add.text(this.scale.width / 2, 58, '', {
      fontFamily: FONT_AR, fontSize: '13px', color: PAL.coral, align: 'center',
      stroke: PAL.ink, strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(950).setResolution(2);
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
    });
    if (isTouchDevice()) this.joystick = new Joystick(this, { depth: 1200 });
    this.events.once('shutdown', () => {
      this.joystick?.destroy();
      this.attackTimer?.remove();
      this.orbTimer?.remove();
    });
  }

  say(text, color = PAL.coral) {
    this.callout.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.callout, alpha: 0, delay: 1400, duration: 700 });
  }

  /* ── combat ──────────────────────────────────────────────────────── */

  fire() {
    if (this.over) return;
    const attack = BOSS.attacks[this.attackIndex % BOSS.attacks.length];
    this.attackIndex++;
    this.say(attack.labelAr, attack.color);
    audio.sfx('bossHit');

    const hard = this.deploy > 55;             // she gets sharper near the end
    const shots = attack.id === 'hardware' ? (hard ? 7 : 5) : (hard ? 3 : 2);
    const speed = 78 + Math.min(52, this.deploy * 0.7);

    for (let i = 0; i < shots; i++) {
      const shot = this.projectiles.create(this.boss.x, this.boss.y + 10, 'items', ITEM.ORB);
      shot.body.setAllowGravity(false);
      shot.body.setSize(9, 9);
      shot.damage = attack.damage;
      shot.setTint(Phaser.Display.Color.HexStringToColor(attack.color).color);
      shot.setDepth(70);

      let angle;
      if (attack.id === 'hardware') {          // a fan across the room
        angle = Math.PI / 2 + (i - (shots - 1) / 2) * 0.34;
      } else {                                 // aimed, with a little spread
        const aim = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
        angle = aim + (i - (shots - 1) / 2) * 0.22;
      }
      shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      this.tweens.add({ targets: shot, angle: 360, duration: 900, repeat: -1 });
      this.time.delayedCall(7000, () => shot.active && shot.destroy());
    }
  }

  spawnOrb() {
    if (this.over || this.orbs.countActive() >= 3) return;
    const a = this.arena;
    const x = Phaser.Math.Between(a.x + 12, a.x + a.w - 12);
    const y = Phaser.Math.Between(a.y + 12, a.y + a.h - 12);
    const orb = this.orbs.create(x, y, 'items', ITEM.FLASH);
    orb.body.setAllowGravity(false);
    orb.body.setSize(14, 14);
    orb.setDepth(y);
    orb.setTint(Phaser.Display.Color.HexStringToColor(PAL.mint).color);
    this.tweens.add({ targets: orb, scale: 1.25, duration: 620, yoyo: true, repeat: -1 });
  }

  commit(orb) {
    if (!orb.active || this.over) return;
    orb.destroy();
    const gain = BOSS.deployPerHit * (state.powerups.cleanCode
      ? config.powerups.cleanCode.damageMultiplier : 1);
    this.deploy = Math.min(BOSS.deployGoal, this.deploy + gain);
    state.addPoints(12);
    audio.sfx('deploy');
    toast(this, state.powerups.cleanCode ? `Commit ×2  +${gain}%` : `Commit  +${gain}%`, {
      color: PAL.mint, y: 74, duration: 900,
    });
    if (this.deploy >= BOSS.deployGoal) this.win();
  }

  hitBy(shot) {
    if (!shot.active || this.over) return;
    shot.destroy();
    if (!state.damage(shot.damage)) {
      audio.sfx('select');
      toast(this, 'الدرع صدّها', { color: PAL.violet, y: 74, duration: 800 });
      return;
    }
    audio.sfx('error');
    this.cameras.main.shake(160, 0.008);
    this.player.setTint(0xff6b6b);
    this.time.delayedCall(240, () => this.player.clearTint());
    if (state.dead) this.lose();
  }

  win() {
    if (this.over) return;
    this.over = true;
    this.attackTimer.remove();
    this.orbTimer.remove();
    this.projectiles.clear(true, true);
    state.addPoints(config.scoring.bossClearGpa);
    state.commitLevelTime();
    audio.stopSong();
    audio.sfx('xp');
    this.say(BOSS.defeatLines[0], PAL.mint);
    this.cameras.main.fadeOut(1100, 255, 255, 255);
    this.time.delayedCall(1200, () => this.scene.start('Credits'));
  }

  lose() {
    if (this.over) return;
    this.over = true;
    this.attackTimer.remove();
    this.orbTimer.remove();
    state.deaths++;
    state.commitLevelTime();
    audio.stopSong();
    this.scene.start('BSOD', { reason: 'PROJECT_FAILED_TO_COMPILE', resume: { scene: 'Boss' } });
  }

  /* ── loop ────────────────────────────────────────────────────────── */

  update(time, delta) {
    if (this.over) return;
    const dt = delta / 1000;
    const k = this.keys;
    const stick = this.joystick?.vector || { x: 0, y: 0 };

    let vx = (k.right.isDown || k.right2.isDown ? 1 : 0) - (k.left.isDown || k.left2.isDown ? 1 : 0);
    let vy = (k.down.isDown || k.down2.isDown ? 1 : 0) - (k.up.isDown || k.up2.isDown ? 1 : 0);
    if (Math.abs(stick.x) > 0.12 || Math.abs(stick.y) > 0.12) { vx = stick.x; vy = stick.y; }

    const len = Math.hypot(vx, vy);
    const speed = state.speed();
    if (len > 0.001) {
      this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
      this.facing = Math.abs(vx) > Math.abs(vy)
        ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      this.player.anims.play(`p${state.avatarRow}-${this.facing}`, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.play(`p${state.avatarRow}-${this.facing}-idle`, true);
    }
    this.player.setDepth(this.player.y);

    state.timeLeft -= dt;
    state.drain(dt * 0.6);
    this.deployBar.draw(this.deploy / BOSS.deployGoal, PAL.mint);
    this.deployText.setText(`${Math.round(this.deploy)}%`);
    const ratio = state.battery / state.maxBattery;
    this.batteryBar.draw(ratio, ratio > 0.4 ? PAL.mint : PAL.coral);
    this.clock.setText(formatClock(state.timeLeft));

    if (state.timeLeft <= 0) this.lose();
    else if (state.dead) this.lose();
  }
}
