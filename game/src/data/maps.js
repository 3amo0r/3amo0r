import { MapBuilder } from '../core/MapBuilder.js';
import { T } from '../core/Tiles.js';

/**
 * One painter per level. Each returns a MapBuilder carrying the tile grid,
 * named markers (spawn / exit / staff), zones (safe areas) and preferred NPC
 * spots. Edit freely — the level scene only reads markers by name, and every
 * map is reachability-checked at load, so a stray wall can never trap anyone.
 */

/* ── Level 1 · The Courtyard ───────────────────────────────────────────── */
function courtyard() {
  const b = new MapBuilder(52, 36, T.GRASS, 0x51ee7);

  // Tree line around the campus edge.
  b.outline(0, 0, 52, 36, T.TREE);
  b.outline(1, 1, 50, 34, T.TREE);
  b.rect(2, 2, 48, 32, T.GRASS);
  b.scatter(2, 2, 48, 32, T.GRASS_ALT, 130, [T.GRASS]);

  // Paved cross: the walk everyone knows by heart.
  b.hline(3, 48, 17, T.PATH, 3);
  b.vline(24, 3, 33, T.PATH, 3);

  // Brazilian Coffee — the safe zone. Counter inside, door onto the path.
  const cafe = b.room(4, 4, 14, 9, T.FLOOR, T.WALL);
  b.hline(6, 15, 6, T.COUNTER);
  b.furnitureRow(7, 9, 4, 3, T.TABLE);
  b.door(11, 12);
  b.vline(11, 13, 17, T.PATH);
  b.zone('safe', cafe.x, cafe.y, cafe.w, cafe.h, { label: 'البن البرازيلي', heal: 6 });
  b.mark('coffeeCounter', 11, 7);

  // Lecture block, north-east. Its door is the way out of prep year.
  // Desks sit in two banks so the centre aisle runs door-to-podium.
  b.room(32, 3, 17, 11, T.FLOOR, T.WALL);
  b.hline(34, 46, 5, T.BOARD);
  for (let r = 0; r < 3; r++) {
    b.furnitureRow(34, 8 + r * 2, 3, 2, T.DESK);
    b.furnitureRow(42, 8 + r * 2, 3, 2, T.DESK);
  }
  b.door(40, 13);
  b.vline(40, 14, 17, T.PATH);
  b.mark('exit', 40, 7);

  // Fountain, benches, greenery.
  b.rect(20, 22, 3, 2, T.FOUNTAIN);
  b.scatter(4, 21, 18, 11, T.PLANT, 10);
  b.scatter(30, 21, 18, 11, T.PLANT, 12);
  b.scatter(4, 21, 18, 11, T.BENCH, 6);
  b.scatter(30, 21, 18, 11, T.BENCH, 7);
  b.scatter(3, 3, 46, 12, T.PLANT, 6, [T.GRASS, T.GRASS_ALT]);

  // The gate — where five years start.
  b.rect(23, 31, 6, 2, T.PATH);
  b.mark('spawn', 25, 31);
  b.mark('staff:allam', 30, 18);

  b.npcSpotsIn(4, 19, 44, 13, 3);
  b.npcSpotsIn(4, 4, 44, 11, 4);
  return b;
}

/* ── Level 2 · Building G ──────────────────────────────────────────────── */
function buildingG() {
  const b = new MapBuilder(56, 40, T.WALL, 0x6ee12, T.FLOOR);

  // A deliberately over-complicated corridor grid. This is the joke.
  const cols = [5, 15, 25, 35, 45];
  const rows = [5, 13, 21, 29, 35];
  for (const y of rows) b.hline(4, 51, y, T.FLOOR, 3);
  for (const x of cols) b.vline(x, 4, 37, T.FLOOR, 3);

  // Dead ends, because Building G has those.
  b.vline(10, 5, 11, T.FLOOR, 2);
  b.vline(40, 22, 28, T.FLOOR, 2);
  b.hline(20, 30, 9, T.FLOOR, 2);
  b.hline(28, 42, 33, T.FLOOR, 2);

  // Lecture rooms hanging off the corridors; each door meets a corridor tile.
  const rooms = [
    [7, 16, 7, 4], [18, 16, 6, 4], [29, 16, 6, 4],
    [7, 24, 7, 4], [29, 24, 6, 4],
    [7, 8, 7, 4], [18, 8, 6, 4],
  ];
  for (const [x, y, w, h] of rooms) {
    const inner = b.room(x, y, w, h, T.FLOOR_ALT, T.WALL);
    b.hline(inner.x, inner.x + inner.w - 1, inner.y, T.BOARD);
    b.furnitureRow(inner.x, inner.y + 2, Math.max(1, Math.floor(inner.w / 2)), 2, T.DESK);
    b.door(x + Math.floor(w / 2), y + h - 1);
    b.set(x + Math.floor(w / 2), y + h - 2, T.FLOOR_ALT);
  }

  // The programming lab — what you spend the whole year looking for.
  const lab = b.room(40, 22, 14, 12, T.FLOOR_ALT, T.WALL);
  for (let r = 0; r < 4; r++) b.furnitureRow(lab.x, lab.y + 2 + r * 2, 5, 2, T.DESK);
  b.rect(lab.x + 11, lab.y + 1, 2, 4, T.RACK);
  b.vline(lab.x + 9, lab.y, lab.y + lab.h - 1, T.FLOOR_ALT);
  b.door(50, 22);
  b.mark('exit', 50, 27);
  b.zone('safe', lab.x, lab.y, lab.w, lab.h, { label: 'معمل البرمجة', heal: 4 });

  // Lockers and plants soften the corridors.
  b.scatter(4, 4, 48, 34, T.LOCKER, 24, [T.FLOOR]);
  b.scatter(4, 4, 48, 34, T.PLANT, 14, [T.FLOOR]);

  b.mark('spawn', 6, 36);
  b.mark('staff:moataz', 25, 22);
  b.npcSpotsIn(5, 5, 46, 32, 3);
  return b;
}

/* ── Level 3 · The Hardware Labs ───────────────────────────────────────── */
function hardwareLabs() {
  const b = new MapBuilder(52, 36, T.WALL, 0x3a99c, T.FLOOR);
  b.rect(2, 2, 48, 32, T.FLOOR);

  // Spine corridor.
  b.hline(3, 48, 17, T.FLOOR_ALT, 4);

  // Three lab wings along the north side. Benches stop short of the right
  // wall so the door column stays a clear aisle.
  const wings = [[3, 3, 14, 13], [19, 3, 14, 13], [35, 3, 14, 13]];
  wings.forEach(([x, y, w, h], i) => {
    const inner = b.room(x, y, w, h, T.FLOOR, T.WALL);
    for (let r = 0; r < 3; r++) {
      b.hline(inner.x + 1, inner.x + inner.w - 5, inner.y + 2 + r * 3, T.LABBENCH);
      b.hline(inner.x + 1, inner.x + inner.w - 5, inner.y + 3 + r * 3, T.CHAIR);
    }
    b.rect(inner.x + inner.w - 3, inner.y + 1, 2, 3, T.RACK);
    b.door(x + w - 2, y + h - 1);
    b.mark(`lab${i}`, x + w - 2, y + h - 3);
  });

  // The engineering cafeteria — the real lecture hall.
  const caf = b.room(4, 22, 22, 12, T.WOOD, T.WALL);
  b.hline(caf.x + 1, caf.x + 8, caf.y + 1, T.COUNTER);
  for (let r = 0; r < 2; r++) b.furnitureRow(caf.x + 2, caf.y + 4 + r * 3, 5, 4, T.TABLE);
  b.door(15, 22);
  b.zone('safe', caf.x, caf.y, caf.w, caf.h, { label: 'كافيتريا هندسة', heal: 7 });

  // Server room, south-east. Racks leave walking lanes between them.
  const srv = b.room(30, 22, 18, 12, T.FLOOR_ALT, T.WALL);
  for (let c = 0; c < 5; c++) b.rect(srv.x + 1 + c * 3, srv.y + 3, 2, 5, T.RACK);
  b.door(39, 22);
  b.mark('exit', 45, 31);

  b.scatter(3, 18, 46, 3, T.PLANT, 8, [T.FLOOR_ALT]);
  b.mark('spawn', 6, 19);
  b.mark('staff:mazen', 26, 19);
  b.mark('staff:doweib', 40, 19);
  b.npcSpotsIn(4, 4, 44, 30, 3);
  return b;
}

/* ── Level 4 · Teues & Cilantro ────────────────────────────────────────── */
function crunch() {
  const b = new MapBuilder(54, 34, T.GRASS, 0x7c0ffee);
  b.outline(0, 0, 54, 34, T.TREE);
  b.outline(1, 1, 52, 32, T.TREE);
  b.rect(2, 2, 50, 30, T.GRASS);
  b.scatter(2, 2, 50, 30, T.GRASS_ALT, 90, [T.GRASS]);

  // The street between the two cafés.
  b.hline(2, 51, 15, T.ROAD, 4);
  b.hline(2, 51, 14, T.PATH);
  b.hline(2, 51, 19, T.PATH);

  // Teues — laptops, deadlines, three empty cups each.
  const teues = b.room(3, 2, 22, 12, T.WOOD, T.WALL);
  b.hline(teues.x + 1, teues.x + 7, teues.y + 1, T.COUNTER);
  for (let r = 0; r < 2; r++) b.furnitureRow(teues.x + 2, teues.y + 4 + r * 3, 5, 4, T.TABLE);
  b.door(14, 13);
  b.zone('safe', teues.x, teues.y, teues.w, teues.h, { label: 'Teues', heal: 5 });
  b.mark('teues', 14, 10);

  // Cilantro — same deadlines, different lighting.
  const cil = b.room(29, 2, 22, 12, T.WOOD, T.WALL);
  b.hline(cil.x + 12, cil.x + 18, cil.y + 1, T.COUNTER);
  for (let r = 0; r < 2; r++) b.furnitureRow(cil.x + 2, cil.y + 4 + r * 3, 5, 4, T.TABLE);
  b.door(40, 13);
  b.zone('safe', cil.x, cil.y, cil.w, cil.h, { label: 'Cilantro', heal: 5 });
  b.mark('cilantro', 40, 10);

  // South block: the co-working sprawl where the project actually got built.
  const work = b.room(6, 21, 42, 11, T.FLOOR, T.WALL);
  for (let r = 0; r < 3; r++) b.furnitureRow(work.x + 2, work.y + 1 + r * 3, 13, 3, T.DESK);
  b.rect(work.x + 1, work.y + 6, 4, 2, T.RUG);
  b.door(20, 21);
  b.door(34, 21);
  b.mark('exit', 46, 29);

  b.scatter(3, 16, 48, 3, T.PLANT, 10, [T.GRASS, T.GRASS_ALT]);
  b.scatter(3, 16, 48, 3, T.BENCH, 6, [T.GRASS, T.GRASS_ALT]);
  b.mark('spawn', 6, 18);
  b.mark('staff:reham', 30, 18);
  b.npcSpotsIn(4, 3, 46, 28, 3);
  return b;
}

/* ── Level 5 · The Defense Hall ────────────────────────────────────────── */
function defenseHall() {
  const b = new MapBuilder(46, 30, T.WALL, 0x1a57ed, T.FLOOR);
  b.rect(2, 2, 42, 26, T.FLOOR);

  // Waiting corridor: everyone rehearsing their slides out loud.
  b.rect(3, 19, 40, 8, T.FLOOR_ALT);
  b.scatter(3, 19, 40, 8, T.BENCH, 14, [T.FLOOR_ALT]);
  b.scatter(3, 19, 40, 8, T.PLANT, 8, [T.FLOOR_ALT]);

  // Side rooms where the last power-ups live.
  const prep = b.room(3, 3, 12, 9, T.FLOOR_ALT, T.WALL);
  b.furnitureRow(prep.x + 1, prep.y + 3, 4, 2, T.DESK);
  b.door(9, 11);

  const store = b.room(31, 3, 12, 9, T.FLOOR_ALT, T.WALL);
  b.rect(store.x + 1, store.y + 1, 2, 5, T.SHELF);
  b.rect(store.x + 7, store.y + 1, 2, 5, T.RACK);
  b.door(37, 11);

  // The hall itself. The door in the middle is the point of no return.
  const hall = b.room(17, 2, 12, 12, T.CARPET, T.WALL);
  b.rect(hall.x, hall.y + 1, hall.w, 2, T.STAGE);
  b.hline(hall.x, hall.x + hall.w - 1, hall.y, T.BOARD);
  for (let r = 0; r < 2; r++) b.furnitureRow(hall.x + 2, hall.y + 6 + r * 3, 4, 2, T.TABLE);
  b.door(23, 13);
  b.mark('exit', 23, 6);
  b.zone('boss', hall.x, hall.y, hall.w, hall.h, { label: 'قاعة المناقشة' });

  b.hline(3, 43, 15, T.FLOOR, 3);
  b.vline(23, 14, 20, T.FLOOR, 2);
  b.scatter(3, 13, 40, 2, T.PLANT, 8, [T.FLOOR]);

  b.mark('spawn', 6, 25);
  b.npcSpotsIn(4, 14, 38, 13, 3);
  b.npcSpotsIn(4, 4, 38, 8, 3);
  return b;
}

const PAINTERS = {
  prep: courtyard,
  buildingG,
  hardware: hardwareLabs,
  crunch,
  defense: defenseHall,
};

export function buildMap(levelKey) {
  const painter = PAINTERS[levelKey];
  if (!painter) throw new Error(`No map painter for level "${levelKey}"`);
  return painter().protectMarkers();
}

export const MAP_KEYS = Object.keys(PAINTERS);
