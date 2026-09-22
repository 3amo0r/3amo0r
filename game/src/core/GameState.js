import config from '../data/game_config.json';

const SAVE_KEY = 'aast2026:save:v1';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Everything about the run in progress, plus the small bits we persist. */
export class GameState {
  constructor() {
    this.settings = { muted: false, showHints: true };
    this.best = null;              // fastest completed run
    this.load();
    this.reset();
  }

  reset() {
    this.playerName = '';
    this.playerQuote = '';
    this.avatarRow = 0;            // row in the player sprite sheet
    this.level = 1;
    this.battery = config.player.maxBattery;
    this.points = 0;
    this.met = new Set();
    this.powerups = { shield: 0, cleanCode: false, coffee: 0, extensions: 0 };
    this.timeLeft = 0;
    this.elapsedMs = 0;
    this.deaths = 0;
    this.flashDrives = 0;
    this.sheets = 0;
    this.coffees = 0;
    this.finished = false;
    this._levelStart = now();
  }

  startRun({ name, quote, avatarRow }) {
    this.reset();
    this.playerName = (name || 'Engineer').slice(0, 20);
    this.playerQuote = (quote || '').slice(0, 90);
    this.avatarRow = avatarRow ?? 0;
    this.elapsedMs = 0;
    this._levelStart = now();
  }

  /* ── level flow ──────────────────────────────────────────────────── */

  levelConfig(level = this.level) {
    return config.levels.find((l) => l.id === level) ?? config.levels[0];
  }

  beginLevel(level) {
    this.level = level;
    this.timeLeft = this.levelConfig(level).timeLimit;
    this._levelStart = now();
  }

  /** Total wall-clock time of the run, used for the speedrun leaderboard. */
  commitLevelTime() {
    this.elapsedMs += now() - this._levelStart;
    this._levelStart = now();
  }

  runTimeMs() {
    return this.elapsedMs + (now() - this._levelStart);
  }

  /* ── vitals ──────────────────────────────────────────────────────── */

  get maxBattery() { return config.player.maxBattery; }

  hasShield() { return this.powerups.shield > now(); }
  hasCoffee() { return this.powerups.coffee > now(); }

  /** Returns true if the hit actually landed. */
  damage(amount) {
    if (this.hasShield()) return false;
    this.battery = Math.max(0, this.battery - amount);
    return true;
  }

  heal(amount) {
    this.battery = Math.min(this.maxBattery, this.battery + amount);
  }

  drain(seconds) {
    this.battery = Math.max(0, this.battery - config.player.batteryDrainPerSecond * seconds);
  }

  get dead() { return this.battery <= 0; }

  /* ── score ───────────────────────────────────────────────────────── */

  addPoints(n) { this.points += n; }

  /** Points mapped onto a GPA the way everyone actually thinks about it. */
  gpa() {
    const g = 1 + (this.points / 1800) * 3;
    return Math.max(0, Math.min(4, g));
  }

  gpaText() { return this.gpa().toFixed(2); }

  meet(studentId) {
    if (this.met.has(studentId)) return false;
    this.met.add(studentId);
    this.addPoints(config.scoring.talkGpa);
    return true;
  }

  /* ── power-ups ───────────────────────────────────────────────────── */

  grant(kind) {
    const def = config.powerups[kind];
    if (!def) return null;
    switch (kind) {
      case 'extension':
        this.timeLeft += def.seconds;
        this.powerups.extensions++;
        break;
      case 'shield':
        this.powerups.shield = now() + def.durationMs;
        break;
      case 'cleanCode':
        this.powerups.cleanCode = true;
        break;
      case 'restore':
        this.battery = this.maxBattery;
        break;
      case 'coffee':
        this.powerups.coffee = now() + def.durationMs;
        this.heal(def.battery);
        this.coffees++;
        break;
      default:
        break;
    }
    return def;
  }

  speed() {
    return this.hasCoffee() ? config.player.coffeeSpeed : config.player.speed;
  }

  /* ── persistence ─────────────────────────────────────────────────── */

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.settings = { ...this.settings, ...(data.settings || {}) };
      this.best = data.best ?? null;
    } catch {
      /* private browsing, blocked storage — the game still runs */
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: this.settings, best: this.best }));
    } catch {
      /* ignore */
    }
  }

  recordFinish() {
    this.finished = true;
    const entry = {
      name: this.playerName,
      timeMs: Math.round(this.runTimeMs()),
      gpa: Number(this.gpaText()),
      met: this.met.size,
      at: Date.now(),
    };
    if (!this.best || entry.timeMs < this.best.timeMs) this.best = entry;
    this.save();
    return entry;
  }
}

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const state = new GameState();
export { config };
