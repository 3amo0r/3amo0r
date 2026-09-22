/**
 * Map sanity check. Run it after editing src/data/maps.js:
 *
 *     npm run validate
 *
 * It walks every level from the player's spawn tile and fails the build if the
 * exit, a professor, a safe zone or too few NPC positions are walled off.
 */
import { buildMap, MAP_KEYS } from '../src/data/maps.js';

const MIN_NPC_SPOTS = 40;
let failures = 0;

const fail = (level, msg) => { failures++; console.error(`  FAIL  ${level}: ${msg}`); };

for (const key of MAP_KEYS) {
  const map = buildMap(key);
  const spawn = map.markers.spawn;
  if (!spawn) { fail(key, 'no spawn marker'); continue; }

  const reach = map.reachableFrom(spawn.x, spawn.y);
  const open = reach.flat().filter(Boolean).length;
  const canReach = ({ x, y }) => Boolean(reach[y]?.[x]);

  if (!map.markers.exit) fail(key, 'no exit marker');
  else if (!canReach(map.markers.exit)) fail(key, 'exit is unreachable from spawn');

  for (const [name, pos] of Object.entries(map.markers)) {
    if (name.startsWith('staff:') && !canReach(pos)) fail(key, `${name} is unreachable`);
  }

  for (const zone of map.zones) {
    let ok = false;
    for (let j = zone.y; j < zone.y + zone.h && !ok; j++) {
      for (let i = zone.x; i < zone.x + zone.w && !ok; i++) if (reach[j]?.[i]) ok = true;
    }
    if (!ok) fail(key, `zone "${zone.name}" (${zone.label ?? ''}) is unreachable`);
  }

  const spots = map.npcSpots.filter(canReach).length;
  if (spots < MIN_NPC_SPOTS) fail(key, `only ${spots} reachable NPC spots (need ${MIN_NPC_SPOTS})`);

  console.log(
    `  ${key.padEnd(11)} ${String(map.width).padStart(2)}x${map.height}  ` +
    `open=${String(open).padEnd(5)} npcSpots=${String(spots).padEnd(4)} zones=${map.zones.length}`
  );
}

if (failures) {
  console.error(`\n${failures} map problem(s) found.`);
  process.exit(1);
}
console.log('\nAll maps valid.');
