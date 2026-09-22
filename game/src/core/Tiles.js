// Tile vocabulary shared by the art generator, the map builder and the levels.
export const T = {
  VOID: 0,
  GRASS: 1,
  GRASS_ALT: 2,
  PATH: 3,
  FLOOR: 4,
  FLOOR_ALT: 5,
  WOOD: 6,
  CARPET: 7,
  WALL: 8,
  WALL_TOP: 9,
  WINDOW: 10,
  DOOR: 11,
  TREE: 12,
  PLANT: 13,
  BENCH: 14,
  DESK: 15,
  TABLE: 16,
  CHAIR: 17,
  COUNTER: 18,
  SHELF: 19,
  BOARD: 20,
  LABBENCH: 21,
  RACK: 22,
  STAGE: 23,
  ROAD: 24,
  RUG: 25,
  LOCKER: 26,
  FOUNTAIN: 27,
};

export const TILE_COUNT = 28;

// Tiles the player cannot walk through.
export const SOLID_TILES = [
  T.VOID, T.WALL, T.WALL_TOP, T.WINDOW, T.TREE, T.PLANT, T.BENCH,
  T.DESK, T.TABLE, T.COUNTER, T.SHELF, T.BOARD, T.LABBENCH, T.RACK,
  T.LOCKER, T.FOUNTAIN,
];

const SOLID_SET = new Set(SOLID_TILES);
export const isSolid = (tile) => SOLID_SET.has(tile);

// Tiles that form the floor. Everything else is a prop drawn over the ground.
export const GROUND_TILES = [
  T.GRASS, T.GRASS_ALT, T.PATH, T.FLOOR, T.FLOOR_ALT, T.WOOD,
  T.CARPET, T.DOOR, T.STAGE, T.ROAD, T.RUG,
];

const GROUND_SET = new Set(GROUND_TILES);
export const isGround = (tile) => GROUND_SET.has(tile);
