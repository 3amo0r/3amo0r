import Phaser from 'phaser';
import config from '../data/game_config.json';
import { state } from '../core/GameState.js';
import { audio } from '../core/AudioEngine.js';
import { buildMap } from '../data/maps.js';
import { T, SOLID_TILES, isSolid } from '../core/Tiles.js';
import { CELL, ITEM, frameFor, seeded, hashString } from '../core/PixelArt.js';
import { byStage } from './BootScene.js';
import { PAL, FONT_PIXEL, pixelText, toast } from '../core/Ui.js';

/** Props drawn above the player so heads pass behind walls and tree canopies. */
const TALL = new Set([
  T.WALL, T.WALL_TOP, T.WINDOW, T.TREE, T.SHELF, T.RACK,
  T.LOCKER, T.BOARD, T.COUNTER, T.FOUNTAIN, T.PLANT,
]);

const DIR_OF = (vx, vy) => (Math.abs(vx) > Math.abs(vy)
  ? (vx < 0 ? 'left' : 'right')
  : (vy < 0 ? 'up' : 'down'));

export default class LevelScene extends Phaser.Scene {
  constructor() { super('Level'); }

  init(data) {
    this.levelId = data?.level ?? state.level ?? 1;
    // Everything below is per-level. Without this reset the second year
    // inherits year one's transition lock and its tile bookkeeping.
    this._transitioning = false;
    this._exitAnnounced = false;
    this._exitNagAt = 0;
    this._awaiting = null;
    this._free = null;
    this._usedSpots = null;
  }

  create() {
    // Stale references from the previous level survive until create() finishes,
    // so nothing outside this scene should touch it before the flag flips.
    this.ready = false;
    this.cfg = state.levelConfig(this.levelId);
    state.beginLevel(this.levelId);
    this.metThisLevel = 0;
    this.interactTarget = null;
    this.lastHitAt = -9999;
    this.lowBatteryWarned = false;

    this.mapData = buildMap(this.cfg.key);
    this.reach = this.mapData.reachableFrom(
      this.mapData.markers.spawn.x, this.mapData.markers.spawn.y
    );
    this.rnd = seeded(hashString(this.cfg.key) ^ 0x9e37);

    this.buildTilemap();
    this.createPlayer();
    this.createStaff();
    this.createNpcs();
    this.createPickups();
    this.createHazards();
    this.createExit();
    this.bindInput();

    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(280, 0, 0, 0);

    this.scene.launch('UI', { level: this.levelId });
    this.scene.bringToTop('UI');
    audio.unlock();
    audio.playSong(this.cfg.music);

    this.events.on('resume', (sys, data) => this.onResume(data));
    this.events.once('shutdown', () => {
      this.ready = false;
      this.events.off('resume');
      this.scene.stop('UI');
    });

    this.ready = true;
  }

  /* ── world ───────────────────────────────────────────────────────── */

  buildTilemap() {
    const grid = this.mapData.data();
    const ground = this.mapData.groundData();
    const low = grid.map((row) => row.map((t) => (TALL.has(t) || t === -1 || !isSolidOrProp(t) ? -1 : t)));
    const tall = grid.map((row) => row.map((t) => (TALL.has(t) ? t : -1)));

    this.worldW = this.mapData.width * CELL;
    this.worldH = this.mapData.height * CELL;

    this.groundLayer = this.makeLayer(ground, -20);
    this.lowLayer = this.makeLayer(low, -10);
    this.tallLayer = this.makeLayer(tall, 100000);

    this.lowLayer.setCollision(SOLID_TILES);
    this.tallLayer.setCollision(SOLID_TILES);
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
  }

  makeLayer(data, depth) {
    const map = this.make.tilemap({ data, tileWidth: CELL, tileHeight: CELL });
    const tileset = map.addTilesetImage('tiles');
    return map.createLayer(0, tileset, 0, 0).setDepth(depth);
  }

  tileToWorld(tx, ty) { return { x: tx * CELL + CELL / 2, y: ty * CELL + CELL / 2 }; }

  walkable(tx, ty) { return Boolean(this.reach[ty]?.[tx]); }

  /** Shuffled list of free tiles, used to place people and pickups. */
  freeSpots() {
    if (this._free) return this._free;
    const spots = [];
    for (let y = 1; y < this.mapData.height - 1; y++) {
      for (let x = 1; x < this.mapData.width - 1; x++) {
        if (this.walkable(x, y)) spots.push({ x, y });
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    this._free = spots;
    return spots;
  }

  takeSpots(n, minDistFromPlayer = 3) {
    const spawn = this.mapData.markers.spawn;
    const out = [];
    const used = this._usedSpots || (this._usedSpots = new Set());
    for (const s of this.freeSpots()) {
      if (out.length >= n) break;
      const key = `${s.x},${s.y}`;
      if (used.has(key)) continue;
      if (Math.hypot(s.x - spawn.x, s.y - spawn.y) < minDistFromPlayer) continue;
      used.add(key);
      out.push(s);
    }
    return out;
  }

  /* ── actors ──────────────────────────────────────────────────────── */

  createPlayer() {
    const { x, y } = this.tileToWorld(this.mapData.markers.spawn.x, this.mapData.markers.spawn.y);
    this.player = this.physics.add.sprite(x, y, 'player', state.avatarRow * 12 + 1);
    this.player.setSize(10, 8).setOffset(3, 15);
    this.player.setCollideWorldBounds(true);
    this.facing = 'down';
    this.physics.add.collider(this.player, this.lowLayer);
    this.physics.add.collider(this.player, this.tallLayer);
  }

  createNpcs() {
    const people = byStage(this.levelId);
    const rows = this.registry.get('npcRows')?.[this.cfg.key] || [];
    const preferred = this.mapData.npcSpots.filter((s) => this.walkable(s.x, s.y));
    const used = this._usedSpots || (this._usedSpots = new Set());

    // Deterministic shuffle so everyone stands in the same place every run.
    for (let i = preferred.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [preferred[i], preferred[j]] = [preferred[j], preferred[i]];
    }

    this.npcs = [];
    const spawn = this.mapData.markers.spawn;
    const spots = preferred.filter((s) => {
      const key = `${s.x},${s.y}`;
      if (used.has(key)) return false;
      if (Math.hypot(s.x - spawn.x, s.y - spawn.y) < 3) return false;
      used.add(key);
      return true;
    });
    const extra = spots.length < people.length ? this.takeSpots(people.length - spots.length) : [];
    const all = [...spots, ...extra];

    people.forEach((student, i) => {
      const spot = all[i];
      if (!spot) return;                       // more classmates than floor: skip gracefully
      const { x, y } = this.tileToWorld(spot.x, spot.y);
      const row = Math.max(0, rows.indexOf(student.id));
      const dir = ['down', 'left', 'right', 'up'][Math.floor(this.rnd() * 4)];
      const sprite = this.add.sprite(x, y, `npc-${this.cfg.key}`, frameFor(row, dir, 1));
      sprite.setDepth(y);
      sprite.student = student;
      sprite.row = row;
      sprite.dir = dir;
      sprite.phase = this.rnd() * Math.PI * 2;
      sprite.kind = 'npc';
      this.npcs.push(sprite);
    });
  }

  createStaff() {
    this.staff = [];
    config.staff.forEach((member, index) => {
      const marker = this.mapData.markers[`staff:${member.id}`];
      if (!marker) return;
      const { x, y } = this.tileToWorld(marker.x, marker.y);
      const sprite = this.add.sprite(x, y, 'staff', frameFor(index, 'down', 1));
      sprite.setDepth(y);
      sprite.staff = member;
      sprite.row = index;
      sprite.dir = 'down';
      sprite.phase = index;
      sprite.kind = 'staff';
      sprite.used = false;
      this.staff.push(sprite);

      // A soft glow so professors read as "go talk to me".
      const halo = this.add.circle(x, y + 6, 12, Phaser.Display.Color.HexStringToColor(PAL.gold).color, 0.14)
        .setDepth(y - 1);
      this.tweens.add({ targets: halo, alpha: 0.32, scale: 1.15, duration: 1100, yoyo: true, repeat: -1 });
    });
  }

  createPickups() {
    this.pickups = this.physics.add.group();
    const counts = this.cfg.pickups || {};
    const plan = [
      ['coffee', counts.coffee || 0, ITEM.COFFEE],
      ['flash', counts.flash || 0, ITEM.FLASH],
      ['sheet', counts.sheet || 0, ITEM.SHEET],
    ];
    for (const [kind, count, frame] of plan) {
      for (const spot of this.takeSpots(count, 4)) {
        const { x, y } = this.tileToWorld(spot.x, spot.y);
        const item = this.pickups.create(x, y, 'items', frame);
        item.kind = kind;
        item.setDepth(y - 2);
        item.body.setAllowGravity(false);
        item.body.setSize(12, 12);
        this.tweens.add({
          targets: item, y: y - 3, duration: 780, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    }
    this.physics.add.overlap(this.player, this.pickups, (_p, item) => this.collect(item));
  }

  createHazards() {
    const h = this.cfg.hazard || {};
    this.sheets = this.physics.add.group();
    this.mines = this.physics.add.group();

    if (h.type === 'sheets') {
      for (const spot of this.takeSpots(h.count || 0, 6)) {
        const { x, y } = this.tileToWorld(spot.x, spot.y);
        const s = this.sheets.create(x, y, 'items', ITEM.SHEET);
        s.setDepth(y + 1);
        s.body.setAllowGravity(false);
        s.body.setSize(10, 10);
        s.setBounce(1, 1);
        s.setCollideWorldBounds(true);
        const angle = this.rnd() * Math.PI * 2;
        const speed = h.speed || 45;
        s.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        s.setTint(0xffd9d9);
        this.tweens.add({ targets: s, angle: 360, duration: 2200, repeat: -1 });
      }
      this.physics.add.collider(this.sheets, this.lowLayer);
      this.physics.add.collider(this.sheets, this.tallLayer);
      this.physics.add.collider(this.sheets, this.sheets);
      this.physics.add.overlap(this.player, this.sheets, () => this.takeHit(h.damage || 10, 'error'));
    }

    if (h.type === 'quizmines') {
      for (const spot of this.takeSpots(h.count || 0, 6)) {
        const { x, y } = this.tileToWorld(spot.x, spot.y);
        const m = this.mines.create(x, y, 'items', ITEM.MINE);
        m.setDepth(y - 2);
        m.body.setAllowGravity(false);
        m.body.setSize(12, 12);
        m.setAlpha(0.9);
        this.tweens.add({ targets: m, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
      }
      this.physics.add.overlap(this.player, this.mines, (_p, mine) => this.trigger(mine, h.damage || 16));
    }
  }

  createExit() {
    const marker = this.mapData.markers.exit;
    const { x, y } = this.tileToWorld(marker.x, marker.y);
    this.exit = this.physics.add.sprite(x, y, 'items', ITEM.EXIT);
    this.exit.body.setAllowGravity(false);
    this.exit.setDepth(y - 2);
    this.exit.setAlpha(0.4);
    this.exitGlow = this.add.circle(x, y, 14,
      Phaser.Display.Color.HexStringToColor(PAL.mint).color, 0.12).setDepth(y - 3);
    this.tweens.add({ targets: this.exitGlow, alpha: 0.3, scale: 1.2, duration: 900, yoyo: true, repeat: -1 });
    this.physics.add.overlap(this.player, this.exit, () => this.tryExit());
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
      interact: 'SPACE', interact2: 'E', pause: 'ESC', mute: 'M',
    });
    this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
    this.input.keyboard.on('keydown-E', () => this.tryInteract());
    this.input.keyboard.on('keydown-M', () => {
      state.settings.muted = audio.toggleMute();
      state.save();
    });

    this.promptText = pixelText(this, 0, 0, '</>', {
      size: 8, color: PAL.gold, origin: [0.5, 1], depth: 99000,
    });
    this.promptText.setScrollFactor(1).setVisible(false);
  }

  /* ── interaction ─────────────────────────────────────────────────── */

  nearestInteractable() {
    const range = config.player.interactRange;
    let best = null;
    let bestDist = range;
    for (const list of [this.staff, this.npcs]) {
      for (const sprite of list) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        if (d < bestDist) { bestDist = d; best = sprite; }
      }
    }
    return best;
  }

  tryInteract() {
    if (this.scene.isPaused() || this._transitioning) return;
    const target = this.interactTarget;
    if (!target) return;

    if (target.kind === 'staff') {
      this.scene.pause();
      this.scene.launch('Dialogue', {
        kind: 'staff', staff: target.staff, used: target.used, from: 'Level',
      });
      this.scene.bringToTop('Dialogue');
      target.pendingGrant = !target.used;
      this._awaiting = target;
      return;
    }

    const first = !state.met.has(target.student.id);
    this.scene.pause();
    this.scene.launch('Dialogue', {
      kind: 'npc', student: target.student, first, from: 'Level',
    });
    this.scene.bringToTop('Dialogue');
    this._awaiting = target;
  }

  onResume(data) {
    const target = this._awaiting;
    this._awaiting = null;
    if (!target || !data?.completed) return;

    if (target.kind === 'staff') {
      if (target.pendingGrant) {
        target.used = true;
        const def = state.grant(target.staff.grants);
        audio.sfx('powerup');
        if (def) toast(this, `${def.labelAr} — ${def.blurb}`, { color: def.color });
      }
      return;
    }

    if (state.meet(target.student.id)) {
      this.metThisLevel++;
      audio.sfx('pickup');
      this.updateExitState();
    }
  }

  /* ── pickups, hits, exit ─────────────────────────────────────────── */

  collect(item) {
    if (!item.active) return;
    const s = config.scoring;
    switch (item.kind) {
      case 'coffee': {
        const def = state.grant('coffee');
        audio.sfx('coffee');
        state.addPoints(s.coffeeGpa);
        toast(this, def?.blurb || 'قهوة', { color: PAL.gold });
        break;
      }
      case 'flash':
        state.flashDrives++;
        state.addPoints(s.flashDriveGpa);
        audio.sfx('powerup');
        toast(this, `فلاشة! +${s.flashDriveGpa} GPA`, { color: PAL.violet });
        break;
      default:
        state.sheets++;
        state.addPoints(s.solvedSheetGpa);
        audio.sfx('pickup');
        toast(this, `شيت متحلول! +${s.solvedSheetGpa} GPA`, { color: PAL.mint });
    }
    item.destroy();
  }

  takeHit(amount, sound = 'hit') {
    if (this.time.now - this.lastHitAt < config.player.invulnerableMs) return;
    this.lastHitAt = this.time.now;
    if (!state.damage(amount)) {
      audio.sfx('select');
      this.flash(PAL.violet);
      return;
    }
    audio.sfx(sound);
    this.cameras.main.shake(140, 0.006);
    this.flash(PAL.coral);
    this.player.setTint(0xff6b6b);
    this.time.delayedCall(260, () => this.player.clearTint());
    if (state.dead) this.fail('BATTERY_DEPLETED');
  }

  trigger(mine, damage) {
    if (!mine.active) return;
    mine.destroy();
    audio.sfx('mine');
    this.takeHit(damage, 'mine');
    toast(this, 'كويز مفاجئ!', { color: PAL.coral });
  }

  flash(color) {
    const c = Phaser.Display.Color.HexStringToColor(color);
    this.cameras.main.flash(180, c.red, c.green, c.blue, false);
  }

  updateExitState() {
    const goal = this.cfg.talkGoal || 0;
    const open = this.metThisLevel >= goal;
    this.exit.setAlpha(open ? 1 : 0.4);
    this.exitGlow.setAlpha(open ? 0.3 : 0.1);
    if (open && !this._exitAnnounced) {
      this._exitAnnounced = true;
      audio.sfx('levelup');
      toast(this, 'الباب اتفتح! امشي على العلامة الخضرا', { color: PAL.mint, duration: 2200 });
    }
  }

  tryExit() {
    if (this._transitioning) return;
    const goal = this.cfg.talkGoal || 0;
    if (this.metThisLevel < goal) {
      if (this.time.now - (this._exitNagAt || 0) > 2500) {
        this._exitNagAt = this.time.now;
        toast(this, `كلّم ${goal - this.metThisLevel} زمايل كمان الأول`, { color: PAL.amber });
      }
      return;
    }
    this._transitioning = true;
    state.addPoints(config.scoring.stageClearGpa);
    state.commitLevelTime();
    audio.sfx('xp');
    audio.stopSong();
    this.cameras.main.fadeOut(340, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const next = this.levelId + 1;
      if (this.levelId >= config.levels.length) this.scene.start('Terminal', { mode: 'boss' });
      else this.scene.start('Terminal', { level: next });
    });
  }

  fail(reason) {
    if (this._transitioning) return;
    this._transitioning = true;
    state.deaths++;
    state.commitLevelTime();
    audio.stopSong();
    this.scene.start('BSOD', { reason, resume: { scene: 'Level', level: this.levelId } });
  }

  /* ── loop ────────────────────────────────────────────────────────── */

  update(time, delta) {
    if (this._transitioning) return;
    const dt = delta / 1000;

    this.movePlayer();
    this.animateNpcs(time);
    this.updateTimers(dt);
    this.updatePrompt();
    this.applySafeZones(dt);
  }

  movePlayer() {
    const k = this.keys;
    const ui = this.scene.get('UI');
    const stick = ui?.joystick?.vector || { x: 0, y: 0 };

    let vx = (k.right.isDown || k.right2.isDown ? 1 : 0) - (k.left.isDown || k.left2.isDown ? 1 : 0);
    let vy = (k.down.isDown || k.down2.isDown ? 1 : 0) - (k.up.isDown || k.up2.isDown ? 1 : 0);
    if (Math.abs(stick.x) > 0.12 || Math.abs(stick.y) > 0.12) { vx = stick.x; vy = stick.y; }

    const len = Math.hypot(vx, vy);
    const speed = state.speed();
    if (len > 0.001) {
      this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
      this.facing = DIR_OF(vx, vy);
      this.player.anims.play(`p${state.avatarRow}-${this.facing}`, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.play(`p${state.avatarRow}-${this.facing}-idle`, true);
    }
    this.player.setDepth(this.player.y);

    if (state.hasCoffee() && this.time.now % 6 < 2) {
      this.player.setTint(0xfff0c0);
    } else if (!this.player.isTinted || this.time.now - this.lastHitAt > 300) {
      this.player.clearTint();
    }
  }

  animateNpcs(time) {
    const t = time / 620;
    for (const sprite of this.npcs) {
      const step = Math.sin(t + sprite.phase) > 0 ? 0 : 2;
      const frame = frameFor(sprite.row, sprite.dir, step);
      if (sprite.frame.name !== frame) sprite.setFrame(frame);
    }
    for (const sprite of this.staff) {
      const step = Math.sin(t * 0.7 + sprite.phase) > 0 ? 0 : 2;
      const frame = frameFor(sprite.row, sprite.dir, step);
      if (sprite.frame.name !== frame) sprite.setFrame(frame);
    }
  }

  updateTimers(dt) {
    state.timeLeft -= dt;
    state.drain(dt);
    if (state.timeLeft <= 0) { this.fail('DEADLINE_EXCEEDED'); return; }
    if (state.dead) { this.fail('BATTERY_DEPLETED'); return; }
    if (state.battery < 22 && !this.lowBatteryWarned) {
      this.lowBatteryWarned = true;
      audio.sfx('lowbattery');
      toast(this, 'البطارية بتخلص! دوّر على قهوة', { color: PAL.coral });
    } else if (state.battery > 40) {
      this.lowBatteryWarned = false;
    }
  }

  updatePrompt() {
    const target = this.nearestInteractable();
    this.interactTarget = target;
    if (!target) { this.promptText.setVisible(false); return; }
    this.promptText.setVisible(true);
    this.promptText.setPosition(target.x, target.y - 14);
    const seen = target.kind === 'npc' && state.met.has(target.student.id);
    const done = target.kind === 'staff' && target.used;
    this.promptText.setColor(seen || done ? PAL.steel : PAL.gold);
  }

  applySafeZones(dt) {
    const tx = Math.floor(this.player.x / CELL);
    const ty = Math.floor(this.player.y / CELL);
    for (const zone of this.mapData.zones) {
      if (zone.name !== 'safe') continue;
      const inside = tx >= zone.x && tx < zone.x + zone.w && ty >= zone.y && ty < zone.y + zone.h;
      if (inside) state.heal((zone.heal || 4) * dt);
    }
  }
}

/** Anything that is not ground is a prop we want drawn. */
function isSolidOrProp(tile) {
  return tile !== -1 && tile !== T.VOID;
}
