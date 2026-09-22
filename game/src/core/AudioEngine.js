/**
 * Chiptune, synthesized live. Five level themes, a title tune, a boss theme
 * and every sound effect are generated with oscillators and noise buffers —
 * the game ships with zero audio files and still has a soundtrack.
 */

const NOTES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function freq(note) {
  if (!note || note === '-' || note === '.') return 0;
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m) return 0;
  const semis = NOTES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

/** `-` rest, `.` hold the previous note. */
const seq = (s) => s.trim().split(/\s+/);

const SONGS = {
  title: {
    bpm: 108,
    lead: seq(`C5 - E5 - G5 - E5 - A5 - G5 - E5 - D5 - C5 - D5 - E5 - G5 - - - -
               F5 - A5 - C6 - A5 - G5 - E5 - D5 - C5 - D5 - E5 - D5 - C5 - - - -`),
    bass: seq(`C3 - - - G2 - - - A2 - - - E2 - - - F2 - - - C3 - - - G2 - - - G2 - - -
               C3 - - - G2 - - - A2 - - - E2 - - - F2 - - - G2 - - - C3 - - - C3 - - -`),
    drum: seq(`K - - - S - - - K - - - S - - - K - - K S - - - K - - - S - - h -`),
  },
  calm: {
    bpm: 96,
    lead: seq(`E5 - G5 - A5 - - - G5 - E5 - D5 - - - C5 - E5 - G5 - - - A5 - G5 - E5 - - -
               D5 - F5 - A5 - - - G5 - F5 - D5 - - - C5 - D5 - E5 - G5 - - - - - - -`),
    bass: seq(`A2 - - - A2 - - - E2 - - - E2 - - - C3 - - - C3 - - - G2 - - - G2 - - -
               D3 - - - D3 - - - F2 - - - F2 - - - C3 - - - G2 - - - A2 - - - A2 - - -`),
    drum: seq(`K - - - - - S - K - - - - - S - K - - - - - S - K - - h - S - - -`),
  },
  corridor: {
    bpm: 118,
    lead: seq(`A4 B4 C5 - E5 - C5 - B4 - D5 - C5 - A4 - G4 A4 B4 - D5 - B4 - A4 - C5 - B4 - G4 -
               F4 G4 A4 - C5 - A4 - G4 - B4 - A4 - F4 - E4 - G4 - B4 - C5 - E5 - D5 - C5 - B4 -`),
    bass: seq(`A2 - A2 - E2 - E2 - F2 - F2 - G2 - G2 - A2 - A2 - E2 - E2 - D2 - D2 - E2 - E2 -`),
    drum: seq(`K - h - S - h - K - h - S - h K K - h - S - h - K - h - S - h h`),
  },
  lab: {
    bpm: 124,
    lead: seq(`C5 - D#5 - G5 - D#5 - C5 - A#4 - G4 - A#4 - C5 - D#5 - F5 - D#5 - C5 - - - -
               G#4 - C5 - D#5 - C5 - G#4 - G4 - F4 - G4 - A#4 - C5 - D5 - D#5 - - - - - -`),
    bass: seq(`C2 - C2 - G#1 - G#1 - A#1 - A#1 - G1 - G1 - C2 - C2 - F1 - F1 - G1 - G1 - G1 -`),
    drum: seq(`K h - h S h - h K h - h S h K h K h - h S h - h K h K h S h h h`),
  },
  crunch: {
    bpm: 148,
    lead: seq(`E5 E5 - B4 - E5 - G5 F#5 - E5 - B4 - A4 - G4 G4 - D5 - G4 - B4 A4 - G4 - D4 - E4 -
               C5 C5 - G4 - C5 - E5 D5 - C5 - G4 - F4 - B4 B4 - F#4 - B4 - D5 C5 - B4 - A4 - B4 -`),
    bass: seq(`E2 E2 E2 - E2 - E2 E2 G2 G2 G2 - G2 - G2 G2 C2 C2 C2 - C2 - C2 C2 B1 B1 B1 - B1 - B1 B1`),
    drum: seq(`K h S h K h S h K K S h K h S h K h S h K h S h K K S h K h S S`),
  },
  tense: {
    bpm: 132,
    lead: seq(`D5 - - D#5 - - D5 - A4 - - A#4 - - A4 - F4 - - F#4 - - F4 - D4 - - D#4 - - D4 -
               A4 - - A#4 - - A4 - F5 - - E5 - - D5 - C#5 - - D5 - - E5 - D5 - - C#5 - - - -`),
    bass: seq(`D2 - D2 D2 - D2 - D2 A1 - A1 A1 - A1 - A1 A#1 - A#1 A#1 - A#1 - A#1 A1 - A1 A1 - A1 - A1`),
    drum: seq(`K - - K S - - - K - - K S - K - K - - K S - - - K K - - S - h h`),
  },
  boss: {
    bpm: 156,
    lead: seq(`D5 D5 - A4 - D5 - F5 E5 - D5 - A4 - G4 - F4 F4 - C5 - F4 - A4 G4 - F4 - C4 - D4 -
               A#4 A#4 - F4 - A#4 - D5 C5 - A#4 - F4 - E4 - A4 A4 - E4 - A4 - C5 D5 - E5 - F5 - A5 -`),
    bass: seq(`D2 D2 D2 D2 A1 A1 A1 A1 A#1 A#1 A#1 A#1 F1 F1 F1 F1 D2 D2 D2 D2 C2 C2 C2 C2 A#1 A#1 A#1 A#1 A1 A1 A1 A1`),
    drum: seq(`K h S h K h S h K K S h K h S K K h S h K h S h K K S h S S S S`),
  },
  victory: {
    bpm: 112,
    lead: seq(`C5 - E5 - G5 - C6 - - - G5 - C6 - - - - - E6 - D6 - C6 - - - - - - - - -
               F5 - A5 - C6 - F6 - - - E6 - D6 - C6 - - - G5 - C6 - - - - - - - - - - -`),
    bass: seq(`C3 - - - C3 - - - G2 - - - G2 - - - F2 - - - F2 - - - C3 - - - C3 - - -`),
    drum: seq(`K - S - K - S - K K S - K - S h K - S - K - S - K K S h S h S h`),
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.current = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.muted = false;
    this.musicVolume = 0.24;
    this.sfxVolume = 0.32;
    this._noise = null;
  }

  /** Browsers only allow audio after a gesture; call this from the first tap. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
    return this.muted;
  }

  toggleMute() { return this.setMuted(!this.muted); }

  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
    this._noise = buf;
    return buf;
  }

  /* ── one-shot voices ─────────────────────────────────────────────── */

  tone(f, start, dur, type = 'square', gain = 0.3, dest = null, slideTo = 0) {
    if (!this.ctx || !f) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    osc.connect(g).connect(dest || this.sfxGain);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  noise(start, dur, gain = 0.2, filterFreq = 3000, dest = null) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    src.connect(filter).connect(g).connect(dest || this.sfxGain);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  /* ── sequencer ───────────────────────────────────────────────────── */

  playSong(name) {
    if (!this.ctx || this.current === name) return;
    this.stopSong();
    if (!SONGS[name]) return;
    this.current = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.pump(), 25);
  }

  stopSong() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.current = null;
  }

  pump() {
    if (!this.ctx || !this.current) return;
    const song = SONGS[this.current];
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.18) {
      this.playStep(song, this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  playStep(song, step, when, dur) {
    const at = (track, mul = 1) => {
      if (!track || !track.length) return null;
      return track[Math.floor(step / mul) % track.length];
    };

    const lead = at(song.lead);
    if (lead && lead !== '-' && lead !== '.') {
      this.tone(freq(lead), when, dur * 2.6, 'square', 0.17, this.musicGain);
      this.tone(freq(lead) * 2, when, dur * 1.2, 'square', 0.04, this.musicGain);
    }

    const bass = at(song.bass);
    if (bass && bass !== '-' && bass !== '.') {
      this.tone(freq(bass), when, dur * 3.2, 'triangle', 0.3, this.musicGain);
    }

    const d = at(song.drum);
    if (d === 'K') {
      this.tone(120, when, 0.14, 'sine', 0.42, this.musicGain, 45);
      this.noise(when, 0.04, 0.1, 800, this.musicGain);
    } else if (d === 'S') {
      this.noise(when, 0.1, 0.17, 2200, this.musicGain);
    } else if (d === 'h') {
      this.noise(when, 0.03, 0.07, 7500, this.musicGain);
    }
  }

  /* ── sound effects ───────────────────────────────────────────────── */

  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'talk':                                   // mechanical keyboard tick
        this.noise(t, 0.016, 0.1, 5200);
        this.tone(1700 + Math.random() * 500, t, 0.02, 'square', 0.05);
        break;
      case 'select':
        this.tone(660, t, 0.07, 'square', 0.2);
        this.tone(990, t + 0.05, 0.09, 'square', 0.18);
        break;
      case 'back':
        this.tone(520, t, 0.07, 'square', 0.16);
        this.tone(330, t + 0.05, 0.1, 'square', 0.15);
        break;
      case 'coffee':                                 // quick sip, then a lift
        this.noise(t, 0.16, 0.14, 1400);
        this.tone(320, t + 0.04, 0.26, 'sine', 0.2, null, 780);
        this.tone(660, t + 0.16, 0.14, 'square', 0.1);
        break;
      case 'pickup':
        this.tone(880, t, 0.06, 'square', 0.2);
        this.tone(1320, t + 0.05, 0.1, 'square', 0.18);
        break;
      case 'powerup':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, t + i * 0.055, 0.18, 'square', 0.2));
        break;
      case 'error':                                  // a bug just bit you
        this.tone(300, t, 0.22, 'sawtooth', 0.26, null, 90);
        this.noise(t, 0.12, 0.14, 900);
        break;
      case 'hit':
        this.noise(t, 0.1, 0.22, 1600);
        this.tone(180, t, 0.14, 'square', 0.22, null, 70);
        break;
      case 'mine':
        this.noise(t, 0.3, 0.3, 700);
        this.tone(140, t, 0.34, 'sawtooth', 0.28, null, 50);
        break;
      case 'deploy':                                 // the good kind of chime
        [784, 1046, 1318, 1568].forEach((f, i) =>
          this.tone(f, t + i * 0.04, 0.3, 'triangle', 0.24));
        break;
      case 'xp':                                     // "project submitted"
        [392, 523, 659, 784].forEach((f, i) =>
          this.tone(f, t + i * 0.11, 0.55, 'triangle', 0.26));
        [1046, 1318].forEach((f, i) =>
          this.tone(f, t + 0.44 + i * 0.1, 0.5, 'sine', 0.14));
        break;
      case 'levelup':
        [523, 587, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, t + i * 0.07, 0.24, 'square', 0.22));
        break;
      case 'bsod':                                   // everything falls over
        this.noise(t, 0.5, 0.3, 500);
        this.tone(200, t, 0.5, 'sawtooth', 0.3, null, 42);
        this.tone(95, t + 0.2, 0.7, 'square', 0.22, null, 40);
        break;
      case 'lowbattery':
        this.tone(440, t, 0.1, 'square', 0.16);
        this.tone(330, t + 0.12, 0.16, 'square', 0.16);
        break;
      case 'bossHit':
        this.noise(t, 0.16, 0.2, 2600);
        this.tone(520, t, 0.18, 'square', 0.2, null, 190);
        break;
      default:
        this.tone(660, t, 0.06, 'square', 0.15);
    }
  }
}

export const audio = new AudioEngine();
export const SONG_NAMES = Object.keys(SONGS);
