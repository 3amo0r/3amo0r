import { T, isSolid, isGround } from './Tiles.js';

/**
 * A tiny grid painter. Levels describe themselves with rooms, corridors and
 * scattered props instead of hand-aligned ASCII, so a map can never come out
 * ragged or disconnected by a miscounted character.
 */
export class MapBuilder {
  constructor(width, height, fill = T.VOID, seed = 1, groundDefault = null) {
    this.width = width;
    this.height = height;
    const base = groundDefault ?? (isGround(fill) ? fill : T.FLOOR);
    this.grid = Array.from({ length: height }, () => new Array(width).fill(fill));
    // What the floor looks like *underneath* each prop, so walls, tables and
    // trees can be drawn as a transparent layer over real ground.
    this.ground = Array.from({ length: height }, () => new Array(width).fill(base));
    this.markers = {};       // name -> {x, y} in tile coords
    this.zones = [];         // named rectangles (safe areas, cafes, lab wings)
    this.npcSpots = [];      // preferred NPC positions, filled before auto-placement
    this._seed = seed >>> 0 || 1;
  }

  // Deterministic RNG so every player gets the same campus.
  rnd() {
    this._seed ^= this._seed << 13; this._seed >>>= 0;
    this._seed ^= this._seed >> 17;
    this._seed ^= this._seed << 5; this._seed >>>= 0;
    return this._seed / 0xffffffff;
  }

  rndInt(min, max) { return min + Math.floor(this.rnd() * (max - min + 1)); }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  set(x, y, tile) {
    if (!this.inBounds(x, y)) return this;
    this.grid[y][x] = tile;
    if (isGround(tile)) this.ground[y][x] = tile;
    return this;
  }

  get(x, y) { return this.inBounds(x, y) ? this.grid[y][x] : T.VOID; }

  fill(tile) {
    for (let y = 0; y < this.height; y++) {
      this.grid[y].fill(tile);
      if (isGround(tile)) this.ground[y].fill(tile);
    }
    return this;
  }

  /** Solid rectangle of one tile. */
  rect(x, y, w, h, tile) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.set(i, j, tile);
    }
    return this;
  }

  /** Rectangle outline only. */
  outline(x, y, w, h, tile) {
    for (let i = x; i < x + w; i++) { this.set(i, y, tile); this.set(i, y + h - 1, tile); }
    for (let j = y; j < y + h; j++) { this.set(x, j, tile); this.set(x + w - 1, j, tile); }
    return this;
  }

  /** Walled room with a floor. Returns its inner rectangle.
   *  The top wall gets the taller "wall face" tile automatically — drawing it
   *  on the wall row rather than the first floor row keeps doorways open. */
  room(x, y, w, h, floor = T.FLOOR, wall = T.WALL) {
    this.rect(x, y, w, h, floor);
    this.outline(x, y, w, h, wall);
    this.hline(x, x + w - 1, y, T.WALL_TOP);
    return { x: x + 1, y: y + 1, w: w - 2, h: h - 2 };
  }

  hall(x, y, w, h, tile = T.PATH) { return this.rect(x, y, w, h, tile); }

  hline(x1, x2, y, tile, thickness = 1) {
    const [a, b] = x1 <= x2 ? [x1, x2] : [x2, x1];
    for (let t = 0; t < thickness; t++) {
      for (let i = a; i <= b; i++) this.set(i, y + t, tile);
    }
    return this;
  }

  vline(x, y1, y2, tile, thickness = 1) {
    const [a, b] = y1 <= y2 ? [y1, y2] : [y2, y1];
    for (let t = 0; t < thickness; t++) {
      for (let j = a; j <= b; j++) this.set(x + t, j, tile);
    }
    return this;
  }

  door(x, y, tile = T.DOOR) { return this.set(x, y, tile); }

  /** Sprinkle a prop on free floor tiles inside a rectangle. */
  scatter(x, y, w, h, tile, count, allowed = null) {
    let placed = 0;
    let guard = count * 60;
    while (placed < count && guard-- > 0) {
      const i = this.rndInt(x, x + w - 1);
      const j = this.rndInt(y, y + h - 1);
      const cur = this.get(i, j);
      if (isSolid(cur)) continue;
      if (allowed && !allowed.includes(cur)) continue;
      this.set(i, j, tile);
      placed++;
    }
    return this;
  }

  /** A run of desks/tables with chairs tucked under them. */
  furnitureRow(x, y, count, gap, tile, chair = T.CHAIR) {
    for (let k = 0; k < count; k++) {
      const px = x + k * gap;
      this.set(px, y, tile);
      this.set(px, y + 1, chair);
    }
    return this;
  }

  mark(name, x, y) { this.markers[name] = { x, y }; return this; }

  zone(name, x, y, w, h, meta = {}) {
    this.zones.push({ name, x, y, w, h, ...meta });
    return this;
  }

  npcSpot(x, y) { this.npcSpots.push({ x, y }); return this; }

  /** Every NPC spot inside a rectangle, skipping solids. */
  npcSpotsIn(x, y, w, h, step = 2) {
    for (let j = y; j < y + h; j += step) {
      for (let i = x; i < x + w; i += step) {
        if (!isSolid(this.get(i, j))) this.npcSpot(i, j);
      }
    }
    return this;
  }

  /** Flood fill from the spawn; anything unreachable is walled off so we never
   *  strand an NPC, a pickup or the exit behind a bad wall. */
  reachableFrom(sx, sy) {
    const seen = Array.from({ length: this.height }, () => new Array(this.width).fill(false));
    if (!this.inBounds(sx, sy) || isSolid(this.get(sx, sy))) return seen;
    const stack = [[sx, sy]];
    seen[sy][sx] = true;
    while (stack.length) {
      const [x, y] = stack.pop();
      const around = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of around) {
        if (!this.inBounds(nx, ny) || seen[ny][nx]) continue;
        if (isSolid(this.get(nx, ny))) continue;
        seen[ny][nx] = true;
        stack.push([nx, ny]);
      }
    }
    return seen;
  }

  /** Force a tile to be walkable, borrowing the look of a walkable neighbour. */
  ensureWalkable(x, y, fallback = T.FLOOR) {
    if (!this.inBounds(x, y)) return this;
    if (!isSolid(this.get(x, y))) return this;
    const neighbours = [
      this.get(x + 1, y), this.get(x - 1, y),
      this.get(x, y + 1), this.get(x, y - 1),
    ].filter((t) => !isSolid(t));
    this.set(x, y, neighbours.length ? neighbours[0] : fallback);
    return this;
  }

  /** Props are scattered randomly, so a plant can land on a doorway or on a
   *  professor. Run this last and nothing important is ever buried. */
  protectMarkers() {
    for (const { x, y } of Object.values(this.markers)) this.ensureWalkable(x, y);
    this.npcSpots = this.npcSpots.filter(({ x, y }) => !isSolid(this.get(x, y)));
    return this;
  }

  /** Tile indices for the walkable ground layer. */
  groundData() { return this.ground.map((row) => row.slice()); }

  /** Props only (walls, furniture, trees); -1 means "nothing here". */
  propData() {
    return this.grid.map((row) => row.map((t) => (isGround(t) ? -1 : t)));
  }

  data() { return this.grid.map((row) => row.slice()); }
}
