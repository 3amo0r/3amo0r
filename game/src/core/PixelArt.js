import { T, TILE_COUNT } from './Tiles.js';

/**
 * Every sprite in this game is drawn here with fillRect, at runtime.
 * No PNGs, no atlases to ship, nothing to lose track of: the whole campus,
 * all 188 classmates and every prop are generated from numbers, so the build
 * stays a few hundred kilobytes and loads instantly on a phone.
 */

export const CELL = 16;      // tile size
export const CHAR_W = 16;    // character frame width
export const CHAR_H = 24;    // character frame height
export const CHAR_COLS = 12; // 4 directions x 3 walk frames

export function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

/* ── colour helpers ───────────────────────────────────────────────────── */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** factor < 1 darkens, > 1 lightens. */
export function shade(hex, factor) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${clamp(r * factor)},${clamp(g * factor)},${clamp(b * factor)})`;
}

export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${clamp(r1 + (r2 - r1) * t)},${clamp(g1 + (g2 - g1) * t)},${clamp(b1 + (b2 - b1) * t)})`;
}

/** Small deterministic generator so textures are stable across reloads. */
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ── tileset ──────────────────────────────────────────────────────────── */

export function makeTileset(pal) {
  const { canvas, ctx } = newCanvas(CELL * TILE_COUNT, CELL);
  for (let i = 0; i < TILE_COUNT; i++) drawTile(ctx, i, i * CELL, 0, pal);
  return canvas;
}

function drawTile(ctx, tile, ox, oy, pal) {
  const rnd = seeded(tile * 9176 + 13);
  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };
  const speckle = (color, count, x0 = 0, y0 = 0, w = CELL, h = CELL) => {
    for (let i = 0; i < count; i++) {
      p(x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), 1, 1, color);
    }
  };

  switch (tile) {
    case T.VOID:
      p(0, 0, CELL, CELL, pal.ink);
      break;

    case T.GRASS:
      p(0, 0, CELL, CELL, pal.grass);
      speckle(pal.grassDark, 10);
      speckle(shade(pal.grass, 1.14), 6);
      break;

    case T.GRASS_ALT:
      p(0, 0, CELL, CELL, pal.grass);
      speckle(pal.grassDark, 6);
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(rnd() * 14);
        const y = 2 + Math.floor(rnd() * 12);
        p(x, y, 1, 3, shade(pal.grass, 1.28));
      }
      break;

    case T.PATH:
      p(0, 0, CELL, CELL, pal.sand);
      p(0, 0, CELL, 1, shade(pal.sand, 0.86));
      p(0, 0, 1, CELL, shade(pal.sand, 0.86));
      speckle(shade(pal.sand, 0.92), 8);
      speckle(shade(pal.sand, 1.08), 5);
      break;

    case T.ROAD:
      p(0, 0, CELL, CELL, '#3b3f4a');
      speckle('#33373f', 14);
      speckle('#474c58', 8);
      p(0, 7, CELL, 2, '#59606e');
      break;

    case T.FLOOR:
      p(0, 0, CELL, CELL, '#d9dfe9');
      p(0, 0, CELL, 1, '#b9c2d1');
      p(0, 0, 1, CELL, '#b9c2d1');
      p(8, 0, 1, CELL, '#c8d0dd');
      p(0, 8, CELL, 1, '#c8d0dd');
      speckle('#e6ebf3', 6);
      break;

    case T.FLOOR_ALT:
      p(0, 0, CELL, CELL, '#c2ccdd');
      p(0, 0, 8, 8, '#b6c1d4');
      p(8, 8, 8, 8, '#b6c1d4');
      p(0, 0, CELL, 1, '#a3aec2');
      p(0, 0, 1, CELL, '#a3aec2');
      break;

    case T.WOOD:
      p(0, 0, CELL, CELL, pal.wood);
      for (let y = 0; y < CELL; y += 4) {
        p(0, y, CELL, 1, shade(pal.wood, 0.78));
        p(0, y + 1, CELL, 3, shade(pal.wood, 1 + rnd() * 0.12));
      }
      speckle(shade(pal.wood, 0.88), 6);
      break;

    case T.CARPET:
      p(0, 0, CELL, CELL, '#6d2b45');
      p(0, 0, CELL, 1, '#5a2138');
      p(0, 0, 1, CELL, '#5a2138');
      for (let i = 0; i < 4; i++) p(3 + i * 3, 3 + ((i % 2) * 6), 2, 2, '#8d3a59');
      break;

    case T.STAGE:
      p(0, 0, CELL, CELL, '#8a6a3a');
      p(0, 0, CELL, 2, '#a9854c');
      p(0, CELL - 2, CELL, 2, '#6b5029');
      speckle('#96743f', 6);
      break;

    case T.RUG:
      p(0, 0, CELL, CELL, '#3c5a7a');
      p(1, 1, CELL - 2, CELL - 2, '#4a6d92');
      p(3, 3, CELL - 6, CELL - 6, '#5b82aa');
      break;

    case T.WALL: {
      p(0, 0, CELL, CELL, pal.steel);
      for (let y = 0; y < CELL; y += 4) {
        p(0, y, CELL, 1, shade(pal.steel, 0.7));
        const off = (y / 4) % 2 === 0 ? 0 : 4;
        for (let x = off; x < CELL; x += 8) p(x, y + 1, 1, 3, shade(pal.steel, 0.78));
      }
      speckle(shade(pal.steel, 1.08), 5);
      break;
    }

    case T.WALL_TOP:
      p(0, 0, CELL, CELL, shade(pal.steel, 0.62));
      p(0, 0, CELL, 3, shade(pal.steel, 1.12));
      p(0, 3, CELL, 1, shade(pal.steel, 0.5));
      speckle(shade(pal.steel, 0.55), 6, 0, 4, CELL, CELL - 4);
      break;

    case T.WINDOW:
      p(0, 0, CELL, CELL, shade(pal.steel, 0.62));
      p(2, 3, 12, 10, pal.sky);
      p(2, 3, 12, 3, shade(pal.sky, 1.2));
      p(7, 3, 1, 10, shade(pal.steel, 0.8));
      p(2, 7, 12, 1, shade(pal.steel, 0.8));
      p(1, 2, 14, 1, shade(pal.steel, 1.1));
      break;

    case T.DOOR:
      p(0, 0, CELL, CELL, shade(pal.wood, 0.7));
      p(2, 1, 12, 14, pal.wood);
      p(3, 3, 10, 5, shade(pal.wood, 1.15));
      p(3, 9, 10, 5, shade(pal.wood, 1.15));
      p(11, 8, 2, 2, pal.gold);
      break;

    case T.TREE:
      p(6, 10, 4, 6, shade(pal.wood, 0.85));
      p(3, 1, 10, 10, pal.grassDark);
      p(2, 3, 12, 6, pal.grassDark);
      p(4, 2, 8, 4, shade(pal.grass, 0.95));
      p(5, 1, 5, 2, shade(pal.grass, 1.1));
      speckle(shade(pal.grassDark, 0.8), 8, 3, 2, 10, 8);
      break;

    case T.PLANT:
      p(5, 10, 6, 5, shade(pal.wood, 1.05));
      p(5, 10, 6, 1, shade(pal.wood, 1.25));
      p(6, 14, 4, 2, shade(pal.wood, 0.8));
      p(6, 4, 4, 7, pal.grassDark);
      p(4, 6, 3, 4, pal.grassDark);
      p(9, 5, 3, 5, shade(pal.grass, 0.95));
      p(7, 2, 2, 3, shade(pal.grass, 1.1));
      break;

    case T.BENCH:
      p(1, 5, 14, 4, pal.wood);
      p(1, 5, 14, 1, shade(pal.wood, 1.2));
      p(1, 2, 14, 2, shade(pal.wood, 0.9));
      p(2, 9, 2, 5, shade(pal.steel, 0.8));
      p(12, 9, 2, 5, shade(pal.steel, 0.8));
      break;

    case T.DESK:
      p(1, 4, 14, 6, mix(pal.sand, '#ffffff', 0.35));
      p(1, 4, 14, 1, '#ffffff');
      p(1, 9, 14, 1, shade(pal.sand, 0.7));
      p(2, 10, 2, 5, shade(pal.steel, 0.85));
      p(12, 10, 2, 5, shade(pal.steel, 0.85));
      p(3, 5, 6, 3, pal.paper);
      break;

    case T.TABLE:
      p(3, 3, 10, 8, mix(pal.wood, '#ffffff', 0.3));
      p(2, 5, 12, 5, mix(pal.wood, '#ffffff', 0.3));
      p(3, 3, 10, 2, mix(pal.wood, '#ffffff', 0.5));
      p(2, 9, 12, 1, shade(pal.wood, 0.72));
      p(7, 11, 2, 4, shade(pal.wood, 0.8));
      p(5, 14, 6, 2, shade(pal.wood, 0.68));
      break;

    case T.CHAIR:
      p(4, 6, 8, 7, shade(pal.steel, 1.05));
      p(4, 6, 8, 1, shade(pal.steel, 1.25));
      p(4, 3, 8, 2, shade(pal.steel, 0.85));
      p(5, 13, 2, 2, shade(pal.steel, 0.7));
      p(9, 13, 2, 2, shade(pal.steel, 0.7));
      break;

    case T.COUNTER:
      p(0, 3, CELL, 4, mix(pal.wood, '#ffffff', 0.45));
      p(0, 3, CELL, 1, '#ffffff');
      p(0, 7, CELL, 8, shade(pal.wood, 0.85));
      p(0, 7, CELL, 1, shade(pal.wood, 0.6));
      for (let x = 2; x < CELL; x += 5) p(x, 9, 3, 4, shade(pal.wood, 0.72));
      break;

    case T.SHELF: {
      p(0, 0, CELL, CELL, shade(pal.wood, 0.72));
      const books = [pal.coral, pal.gold, pal.mint, pal.sky, pal.violet, pal.amber];
      for (let row = 0; row < 3; row++) {
        const y = 1 + row * 5;
        p(1, y + 4, 14, 1, shade(pal.wood, 0.55));
        let x = 1;
        while (x < 14) {
          const w = 1 + Math.floor(rnd() * 2);
          p(x, y, w, 4, books[Math.floor(rnd() * books.length)]);
          x += w + 1;
        }
      }
      break;
    }

    case T.BOARD:
      p(0, 1, CELL, 12, '#f4f7fb');
      p(0, 1, CELL, 1, '#c6cede');
      p(0, 12, CELL, 2, shade(pal.steel, 0.8));
      p(2, 4, 7, 1, pal.sky);
      p(2, 6, 10, 1, pal.coral);
      p(2, 8, 5, 1, pal.mint);
      p(11, 3, 3, 3, pal.gold);
      break;

    case T.LABBENCH:
      p(0, 4, CELL, 6, mix(pal.slate, '#ffffff', 0.55));
      p(0, 4, CELL, 1, '#ffffff');
      p(0, 9, CELL, 1, shade(pal.slate, 0.7));
      p(2, 10, 2, 5, shade(pal.steel, 0.8));
      p(12, 10, 2, 5, shade(pal.steel, 0.8));
      p(3, 1, 6, 4, pal.night);       // oscilloscope
      p(4, 2, 4, 2, pal.mint);
      p(11, 2, 3, 3, pal.coral);      // breadboard-ish
      break;

    case T.RACK:
      p(0, 0, CELL, CELL, pal.night);
      p(0, 0, CELL, 1, shade(pal.night, 1.6));
      p(1, 1, 14, 14, shade(pal.night, 1.25));
      for (let row = 0; row < 5; row++) {
        const y = 2 + row * 3;
        p(2, y, 12, 2, pal.ink);
        p(3, y + 1, 1, 1, row % 2 ? pal.mint : pal.gold);
        p(5, y + 1, 1, 1, pal.mint);
        p(12, y + 1, 1, 1, row % 3 ? pal.sky : pal.coral);
      }
      break;

    case T.LOCKER:
      p(0, 0, CELL, CELL, shade(pal.steel, 0.9));
      p(0, 0, CELL, 1, shade(pal.steel, 1.2));
      p(7, 0, 1, CELL, shade(pal.steel, 0.65));
      for (const x of [1, 9]) {
        p(x, 2, 5, 1, shade(pal.steel, 0.7));
        p(x, 4, 5, 1, shade(pal.steel, 0.7));
        p(x + 4, 8, 1, 3, pal.gold);
      }
      break;

    case T.FOUNTAIN:                                // stone rim, water inside
      p(0, 0, CELL, CELL, mix(pal.sand, '#ffffff', 0.25));
      p(0, 0, CELL, 1, mix(pal.sand, '#ffffff', 0.5));
      p(2, 2, 12, 12, shade(pal.sky, 0.78));
      p(2, 2, 12, 2, shade(pal.sky, 1.05));
      speckle(shade(pal.sky, 1.3), 5, 3, 3, 10, 9);
      p(4, 6, 6, 1, shade(pal.sky, 1.45));          // ripples
      p(7, 9, 6, 1, shade(pal.sky, 1.25));
      p(3, 11, 5, 1, shade(pal.sky, 0.62));
      break;

    default:
      p(0, 0, CELL, CELL, pal.slate);
  }
}

/* ── items ───────────────────────────────────────────────────────────── */

export const ITEM = {
  COFFEE: 0, FLASH: 1, SHEET: 2, BUG: 3, MINE: 4, LAPTOP: 5,
  CAP: 6, ORB: 7, CLOCK: 8, SHIELD: 9, BOOK: 10, BATTERY: 11,
  CUP: 12, STAR: 13, EXIT: 14, TROPHY: 15,
};
export const ITEM_COUNT = 16;

export function makeItems(pal) {
  const { canvas, ctx } = newCanvas(CELL * ITEM_COUNT, CELL);
  for (let i = 0; i < ITEM_COUNT; i++) drawItem(ctx, i, i * CELL, 0, pal);
  return canvas;
}

function drawItem(ctx, item, ox, oy, pal) {
  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };

  switch (item) {
    case ITEM.COFFEE:
    case ITEM.CUP:
      p(4, 4, 8, 9, pal.paper);
      p(4, 4, 8, 2, pal.coral);
      p(5, 6, 6, 5, shade(pal.wood, 0.75));
      p(12, 6, 2, 4, pal.paper);
      p(5, 1, 1, 3, shade(pal.paper, 0.8));
      p(8, 0, 1, 3, shade(pal.paper, 0.8));
      p(4, 13, 8, 1, shade(pal.paper, 0.7));
      break;

    case ITEM.FLASH:
      p(2, 6, 9, 5, pal.violet);
      p(2, 6, 9, 1, shade(pal.violet, 1.3));
      p(11, 7, 3, 3, mix(pal.mist, '#ffffff', 0.4));
      p(4, 8, 4, 1, shade(pal.violet, 0.7));
      break;

    case ITEM.SHEET:
      p(3, 2, 10, 12, pal.paper);
      p(3, 2, 10, 1, shade(pal.paper, 0.85));
      p(5, 5, 6, 1, pal.mist);
      p(5, 7, 6, 1, pal.mist);
      p(5, 9, 4, 1, pal.mist);
      p(9, 10, 3, 1, pal.mint);
      p(10, 9, 1, 1, pal.mint);
      break;

    case ITEM.BUG:
      p(5, 5, 6, 6, pal.coral);
      p(5, 5, 6, 2, shade(pal.coral, 1.25));
      p(3, 6, 2, 1, shade(pal.coral, 0.7));
      p(11, 6, 2, 1, shade(pal.coral, 0.7));
      p(3, 9, 2, 1, shade(pal.coral, 0.7));
      p(11, 9, 2, 1, shade(pal.coral, 0.7));
      p(6, 7, 1, 1, pal.ink);
      p(9, 7, 1, 1, pal.ink);
      p(6, 3, 1, 2, pal.ink);
      p(9, 3, 1, 2, pal.ink);
      break;

    case ITEM.MINE:
      p(4, 5, 8, 7, pal.night);
      p(4, 5, 8, 2, shade(pal.night, 1.5));
      p(6, 3, 4, 2, pal.coral);
      p(7, 7, 2, 2, pal.gold);
      p(3, 12, 10, 1, shade(pal.night, 0.6));
      break;

    case ITEM.LAPTOP:
      p(2, 3, 12, 8, pal.slate);
      p(3, 4, 10, 6, pal.sky);
      p(4, 5, 5, 1, pal.paper);
      p(4, 7, 7, 1, shade(pal.paper, 0.8));
      p(1, 11, 14, 3, shade(pal.slate, 1.2));
      p(6, 12, 4, 1, shade(pal.slate, 0.7));
      break;

    case ITEM.CAP: {
      const board = shade(pal.ink, 2.2);
      p(5, 8, 6, 4, board);                        // the head beneath
      p(4, 7, 8, 1, shade(pal.ink, 1.4));
      p(1, 5, 14, 2, board);                       // mortarboard
      p(3, 4, 10, 1, board);
      p(6, 3, 4, 1, board);
      p(1, 5, 14, 1, shade(pal.ink, 3.1));         // top highlight
      p(7, 6, 2, 1, pal.gold);                     // button
      p(13, 6, 1, 5, pal.gold);                    // tassel
      p(12, 10, 3, 3, pal.gold);
      break;
    }

    case ITEM.ORB:
      p(5, 3, 6, 10, pal.violet);
      p(3, 5, 10, 6, pal.violet);
      p(5, 4, 4, 3, shade(pal.violet, 1.45));
      break;

    case ITEM.CLOCK:
      p(3, 3, 10, 10, pal.sky);
      p(4, 4, 8, 8, pal.paper);
      p(7, 5, 1, 4, pal.ink);
      p(8, 8, 3, 1, pal.ink);
      break;

    case ITEM.SHIELD:
      p(4, 2, 8, 8, pal.violet);
      p(5, 10, 6, 2, pal.violet);
      p(6, 12, 4, 1, pal.violet);
      p(5, 3, 3, 4, shade(pal.violet, 1.4));
      break;

    case ITEM.BOOK:
      p(3, 3, 10, 10, pal.mint);
      p(3, 3, 3, 10, shade(pal.mint, 0.7));
      p(7, 5, 5, 1, pal.paper);
      p(7, 7, 5, 1, pal.paper);
      p(7, 9, 3, 1, pal.paper);
      break;

    case ITEM.BATTERY:
      p(2, 5, 12, 7, pal.paper);
      p(3, 6, 10, 5, pal.mint);
      p(14, 7, 1, 3, pal.paper);
      p(7, 6, 1, 5, shade(pal.mint, 0.7));
      break;

    case ITEM.STAR:
      p(7, 2, 2, 12, pal.gold);
      p(2, 7, 12, 2, pal.gold);
      p(5, 5, 6, 6, pal.gold);
      p(6, 6, 2, 2, shade(pal.gold, 1.4));
      break;

    case ITEM.EXIT:
      p(2, 1, 12, 14, pal.mint);
      p(3, 2, 10, 12, shade(pal.mint, 0.75));
      p(5, 4, 6, 1, pal.paper);
      p(7, 4, 2, 7, pal.paper);
      p(5, 10, 6, 1, pal.paper);
      break;

    case ITEM.TROPHY:
      p(4, 2, 8, 6, pal.gold);
      p(2, 3, 2, 3, pal.gold);
      p(12, 3, 2, 3, pal.gold);
      p(7, 8, 2, 3, shade(pal.gold, 0.8));
      p(4, 11, 8, 2, shade(pal.gold, 0.7));
      p(5, 3, 2, 2, shade(pal.gold, 1.4));
      break;

    default:
      p(4, 4, 8, 8, pal.mist);
  }
}

/* ── characters ──────────────────────────────────────────────────────── */

const SKINS = ['#f2c8a0', '#e8b98c', '#dba877', '#c9925f', '#b47a4b', '#9a6138', '#7d4c2c'];
const HAIRS = ['#171514', '#241c18', '#31251d', '#412f22', '#523a26', '#2b2320', '#0f0f10', '#6b4a2c'];
const SHIRTS = ['#4fb4ff', '#ff5d5d', '#4fe0a8', '#ffc94a', '#9d7bff', '#ff9e3d',
  '#3f9a52', '#e8eef7', '#4a5b7d', '#d94f8a', '#22b8b0', '#f06a3c'];
const PANTS = ['#2f3b54', '#1b2233', '#3c4a68', '#39322c', '#26303f', '#4a3f52'];
const SHOES = ['#1b1f28', '#2b2119', '#3a3f4c', '#101216'];
const STYLES = ['short', 'short', 'short', 'curly', 'cap', 'long', 'long', 'hijab', 'hijab', 'bald'];

/** Deterministic appearance from any string (a name, an id). */
export function lookFromSeed(seedStr) {
  const rnd = seeded(hashString(String(seedStr)));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const style = pick(STYLES);
  return {
    skin: pick(SKINS),
    hair: style === 'hijab' ? pick(SHIRTS) : pick(HAIRS),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    shoes: pick(SHOES),
    style,
    glasses: rnd() < 0.3,
    beard: style !== 'hijab' && style !== 'long' && rnd() < 0.28,
  };
}

const DIRS = ['down', 'left', 'right', 'up'];

/**
 * A sheet of characters: 12 columns (4 directions x 3 walk frames) and one
 * row per look. Frame index for look i, direction d, step s is
 * i * 12 + d * 3 + s.
 */
export function makeCharacterSheet(looks) {
  const { canvas, ctx } = newCanvas(CHAR_W * CHAR_COLS, CHAR_H * Math.max(1, looks.length));
  looks.forEach((look, row) => {
    DIRS.forEach((dir, d) => {
      for (let step = 0; step < 3; step++) {
        drawCharacter(ctx, (d * 3 + step) * CHAR_W, row * CHAR_H, look, dir, step - 1);
      }
    });
  });
  return canvas;
}

export const frameFor = (row, dir, step) =>
  row * CHAR_COLS + DIRS.indexOf(dir) * 3 + step;

function drawCharacter(ctx, ox, oy, look, dir, swing) {
  const { skin, hair, shirt, pants, shoes, style, glasses, beard } = look;
  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };

  const skinD = shade(skin, 0.82);
  const shirtD = shade(shirt, 0.74);
  const hairD = shade(hair, 0.76);
  const coat = style === 'coat';
  const top = coat ? '#f2f5fa' : shirt;
  const topD = coat ? '#d3dae6' : shirtD;

  const side = dir === 'left' || dir === 'right';
  const facingLeft = dir === 'left';
  const back = dir === 'up';

  // Ground shadow.
  p(4, 23, 8, 1, 'rgba(0,0,0,0.25)');

  /* legs + shoes */
  if (side) {
    const lead = swing > 0 ? 1 : 0;
    p(6, 18, 4, 4, pants);
    p(6, 18, 4, 1, shade(pants, 1.15));
    p(5 + lead, 22, 5, 2, shoes);
  } else {
    p(5, 18, 3, 4, pants);
    p(8, 18, 3, 4, pants);
    p(5, 18, 6, 1, shade(pants, 1.15));
    p(5, 22, 3, 2, swing > 0 ? shade(shoes, 1.3) : shoes);
    p(8, 22, 3, 2, swing < 0 ? shade(shoes, 1.3) : shoes);
  }

  /* torso */
  const bx = side ? 5 : 4;
  const bw = side ? 6 : 8;
  p(bx, 11, bw, 7, top);
  p(bx, 11, bw, 1, shade(top, 1.18));
  p(bx, 17, bw, 1, topD);
  if (coat) {                    // lab coat over a shirt
    p(bx + Math.floor(bw / 2) - 1, 11, 2, 6, shirt);
    p(bx, 11, 1, 6, '#dfe5ee');
    p(bx + bw - 1, 11, 1, 6, '#dfe5ee');
  }

  /* arms */
  if (side) {
    const ax = facingLeft ? 3 : 11;
    p(ax, 11, 2, 6, topD);
    p(ax, 17, 2, 2, skin);
  } else {
    const swingA = swing;
    p(2, 11 + (swingA > 0 ? 1 : 0), 2, 6, topD);
    p(12, 11 + (swingA < 0 ? 1 : 0), 2, 6, topD);
    p(2, 17 + (swingA > 0 ? 1 : 0), 2, 2, skin);
    p(12, 17 + (swingA < 0 ? 1 : 0), 2, 2, skin);
  }

  /* head */
  p(4, 3, 8, 8, skin);
  p(4, 3, 8, 1, shade(skin, 1.12));
  p(4, 10, 8, 1, skinD);
  p(6, 11, 4, 1, skinD);          // neck

  /* face */
  if (!back) {
    const eyeY = 7;
    if (side) {
      const ex = facingLeft ? 5 : 9;
      p(ex, eyeY, 2, 2, '#1a1a22');
      p(ex + (facingLeft ? 0 : 1), eyeY, 1, 1, '#ffffff');
      p(facingLeft ? 4 : 11, 9, 1, 1, skinD);
    } else {
      p(6, eyeY, 2, 2, '#1a1a22');
      p(9, eyeY, 2, 2, '#1a1a22');
      p(6, eyeY, 1, 1, '#ffffff');
      p(9, eyeY, 1, 1, '#ffffff');
      p(7, 9, 2, 1, skinD);       // mouth
    }
    if (glasses) {
      const gc = '#2b3242';
      if (side) {
        const gx = facingLeft ? 4 : 9;
        p(gx, eyeY - 1, 4, 1, gc);
        p(gx, eyeY, 1, 2, gc);
        p(gx + 3, eyeY, 1, 2, gc);
      } else {
        p(5, eyeY - 1, 3, 1, gc);
        p(8, eyeY - 1, 3, 1, gc);
        p(5, eyeY, 1, 2, gc);
        p(7, eyeY, 1, 2, gc);
        p(8, eyeY, 1, 2, gc);
        p(10, eyeY, 1, 2, gc);
      }
    }
    if (beard) {
      p(5, 9, 6, 2, hairD);
      p(4, 8, 1, 2, hairD);
      p(11, 8, 1, 2, hairD);
    }
  }

  /* hair */
  switch (style) {
    case 'hijab':
      p(3, 2, 10, 9, hair);
      p(3, 2, 10, 1, shade(hair, 1.2));
      p(3, 10, 10, 4, hair);       // drape over the shoulders
      p(3, 13, 10, 1, shade(hair, 0.8));
      if (!back) { p(5, 4, 6, 7, skin); p(5, 4, 6, 1, shade(skin, 1.1)); }
      if (!back && !side) { p(6, 7, 2, 2, '#1a1a22'); p(9, 7, 2, 2, '#1a1a22'); p(7, 9, 2, 1, skinD); }
      if (!back && side) { const ex = facingLeft ? 5 : 9; p(ex, 7, 2, 2, '#1a1a22'); }
      break;

    case 'long':
      p(4, 2, 8, 4, hair);
      p(3, 3, 1, 9, hair);
      p(12, 3, 1, 9, hair);
      p(4, 2, 8, 1, shade(hair, 1.25));
      if (back) p(4, 2, 8, 9, hair);
      break;

    case 'curly':
      p(4, 1, 8, 4, hair);
      p(3, 2, 2, 3, hair);
      p(11, 2, 2, 3, hair);
      p(5, 0, 2, 2, hair);
      p(9, 0, 2, 2, hair);
      p(5, 1, 6, 1, shade(hair, 1.3));
      if (back) p(4, 1, 8, 8, hair);
      break;

    case 'cap':
      p(4, 2, 8, 3, hair);
      p(3, 4, 10, 1, shade(hair, 0.7));
      if (!back) p(side ? (facingLeft ? 1 : 12) : 3, 5, 3, 1, shade(hair, 0.7));
      break;

    case 'bald':
      p(4, 3, 8, 1, shade(skin, 1.18));
      break;

    default: // short
      p(4, 2, 8, 3, hair);
      p(4, 2, 8, 1, shade(hair, 1.3));
      p(3, 3, 1, 3, hair);
      p(12, 3, 1, 3, hair);
      if (back) p(4, 2, 8, 7, hair);
  }
}

/* ── baby portraits ──────────────────────────────────────────────────── */

/**
 * Stand-in for a classmate's baby photo: a chunky 16x16 portrait scaled up,
 * deterministic per person, so the dialogue box always looks finished even
 * before the real photos are imported.
 */
export function makeBabyPortrait(seedStr, size = 64) {
  const rnd = seeded(hashString('baby:' + seedStr));
  const small = newCanvas(16, 16);
  const ctx = small.ctx;
  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  const skin = SKINS[Math.floor(rnd() * SKINS.length)];
  const hair = HAIRS[Math.floor(rnd() * HAIRS.length)];
  const bib = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
  const bg = ['#8fc7e8', '#f2c8d8', '#d8e8b0', '#f5dfa8', '#cbc3ef'][Math.floor(rnd() * 5)];

  p(0, 0, 16, 16, bg);
  p(0, 12, 16, 4, shade(bg, 0.86));

  p(3, 11, 10, 5, bib);                  // body
  p(5, 11, 6, 2, shade(bib, 1.2));
  p(3, 2, 10, 10, skin);                 // head
  p(2, 5, 1, 4, skin);                   // ears
  p(13, 5, 1, 4, skin);
  p(3, 2, 10, 1, shade(skin, 1.12));

  const tuft = Math.floor(rnd() * 3);
  if (tuft === 0) { p(6, 0, 4, 2, hair); p(5, 1, 6, 1, hair); }
  else if (tuft === 1) { p(4, 1, 8, 2, hair); p(7, 0, 2, 1, hair); }
  else { p(4, 1, 8, 1, hair); }

  p(5, 6, 2, 2, '#241c1a');              // eyes
  p(9, 6, 2, 2, '#241c1a');
  p(5, 6, 1, 1, '#ffffff');
  p(9, 6, 1, 1, '#ffffff');
  p(7, 8, 2, 1, shade(skin, 0.82));      // nose
  p(6, 10, 4, 1, '#c2626a');             // smile
  p(4, 8, 2, 1, '#f0a0a4');              // cheeks
  p(10, 8, 2, 1, '#f0a0a4');

  const out = newCanvas(size, size);
  out.ctx.imageSmoothingEnabled = false;
  out.ctx.drawImage(small.canvas, 0, 0, 16, 16, 0, 0, size, size);
  return out.canvas;
}

/**
 * Register a generated canvas with Phaser as an indexed sprite sheet.
 * Skipping the data-URL round trip keeps the loading screen under a second
 * even though every frame in the game is drawn at start-up.
 */
export function registerSheet(scene, key, canvas, frameW, frameH) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas);
  const cols = Math.max(1, Math.floor(canvas.width / frameW));
  const rows = Math.max(1, Math.floor(canvas.height / frameH));
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tex.add(i++, 0, c * frameW, r * frameH, frameW, frameH);
    }
  }
  return tex;
}

/** Register a single-frame canvas (a portrait, a logo) as an image texture. */
export function registerImage(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, canvas);
}

/**
 * All the baby portraits packed into one grid texture, so the credits wall
 * costs a single upload instead of 188 of them.
 */
export function makeBabyAtlas(people, size = 32, cols = 16) {
  const rows = Math.max(1, Math.ceil(people.length / cols));
  const { canvas, ctx } = newCanvas(cols * size, rows * size);
  people.forEach((person, i) => {
    const portrait = makeBabyPortrait(person.id + (person.full_name || ''), size);
    ctx.drawImage(portrait, (i % cols) * size, Math.floor(i / cols) * size);
  });
  return canvas;
}
