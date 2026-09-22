/**
 * Progression test: drives a whole run from prep year to the credits, level by
 * level, checking that every exit opens and every transition lands.
 *
 *     npm run progression
 */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'This test needs Playwright, which is not installed by default because it\n' +
    'downloads a browser. To run it:\n\n' +
    '    npm install -D playwright\n' +
    '    npx playwright install chromium\n'
  );
  process.exit(1);
}
import { existsSync } from 'node:fs';

const BASE = process.env.SMOKE_URL || 'http://localhost:4173';
const CHROME = process.env.SMOKE_CHROME
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => existsSync(p));

const IGNORABLE = /fonts\.(googleapis|gstatic)\.com|ERR_CERT_AUTHORITY_INVALID/i;
const errors = [];
const problems = [];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', (m) => { if (m.type() === 'error' && !IGNORABLE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!IGNORABLE.test(e.message)) errors.push(e.message); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game?.scene?.getScenes(true)?.some((s) => s.scene.key === 'Title'), { timeout: 25000 });

await page.evaluate(() => window.__state.startRun({ name: 'Runner', quote: 'test', avatarRow: 0 }));

// Follow the game's own flow rather than forcing scenes: start the first
// terminal, then let each exit carry us to the next year on its own.
const activeKeys = () => page.evaluate(() =>
  window.__game.scene.getScenes(true).map((s) => s.scene.key));

const waitFor = (key, why) => page.waitForFunction(
  (k) => window.__game.scene.getScene(k)?.scene.isActive(), key, { timeout: 20000 }
).catch(() => problems.push(why));

const waitForLevel = (level) => page.waitForFunction((lvl) => {
  const s = window.__game.scene.getScene('Level');
  return s?.scene.isActive() && s.ready === true && s.levelId === lvl;
}, level, { timeout: 20000 }).catch(() => problems.push(`level ${level} never became playable`));

await page.evaluate(() => window.__game.scene.start('Terminal', { level: 1 }));
await waitFor('Terminal', 'the first terminal never appeared');

for (let level = 1; level <= 5; level++) {
  await page.evaluate(() => window.__game.scene.getScene('Terminal').finish());
  await waitForLevel(level);
  await page.waitForTimeout(400);

  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level');
    return {
      level: s.levelId,
      place: s.cfg.place,
      npcs: s.npcs.length,
      staff: s.staff.length,
      goal: s.cfg.talkGoal,
      pickups: s.pickups.countActive(),
      hazards: s.sheets.countActive() + s.mines.countActive(),
      exitOpen: s.exit.alpha >= 1,
    };
  });
  if (before.level !== level) problems.push(`expected level ${level}, got ${before.level}`);
  if (before.exitOpen) problems.push(`level ${level}: exit was open before meeting anyone`);

  // Meet exactly the required number of classmates, the way a player would.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level');
    for (let i = 0; i < s.cfg.talkGoal; i++) {
      const npc = s.npcs[i];
      if (npc && window.__state.meet(npc.student.id)) s.metThisLevel++;
    }
    s.updateExitState();
  });
  await page.waitForTimeout(250);

  const opened = await page.evaluate(() => window.__game.scene.getScene('Level').exit.alpha >= 1);
  if (!opened) problems.push(`level ${level}: exit did not open after meeting the goal`);

  // Walk onto the exit tile and let the game decide what comes next.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level');
    s.player.setPosition(s.exit.x, s.exit.y);
  });

  const next = level < 5 ? 'Terminal' : 'Terminal';
  await waitFor(next, `level ${level} never transitioned out`);
  await page.waitForTimeout(300);
  const terminalMode = await page.evaluate(() => {
    const t = window.__game.scene.getScene('Terminal');
    return t?.scene.isActive() ? { mode: t.mode, level: t.levelId } : null;
  });

  console.log(
    `  L${level} ${String(before.place).padEnd(20)} npcs=${String(before.npcs).padEnd(3)} ` +
    `staff=${before.staff} goal=${String(before.goal).padEnd(3)} pickups=${String(before.pickups).padEnd(3)} ` +
    `hazards=${String(before.hazards).padEnd(3)} -> ${terminalMode?.mode === 'boss' ? 'BOSS' : 'year ' + terminalMode?.level}`
  );

  if (level === 5 && terminalMode?.mode !== 'boss') {
    problems.push(`level 5 led to "${terminalMode?.mode}" instead of the boss`);
  }
  if (level < 5 && terminalMode?.level !== level + 1) {
    problems.push(`level ${level} led to year ${terminalMode?.level} instead of ${level + 1}`);
  }
}

// The final defense.
await page.evaluate(() => window.__game.scene.getScene('Terminal').finish());
await waitFor('Boss', 'the boss scene never started');
await page.waitForTimeout(2000);
const bossInfo = await page.evaluate(() => {
  const b = window.__game.scene.getScene('Boss');
  if (!b?.scene.isActive()) return null;
  return { deploy: b.deploy, orbs: b.orbs.countActive(), shots: b.projectiles.countActive() };
});
if (!bossInfo) problems.push('boss scene was not active');
else {
  console.log(`  BOSS  deploy=${bossInfo.deploy}% orbs=${bossInfo.orbs} projectiles=${bossInfo.shots}`);
  if (bossInfo.shots === 0) problems.push('boss fired no projectiles');
  if (bossInfo.orbs === 0) problems.push('no commit orbs spawned');
}

// Grab commits until the deploy bar is full, exactly as a player would.
await page.evaluate(async () => {
  const b = window.__game.scene.getScene('Boss');
  for (let i = 0; i < 40 && b.deploy < 100 && !b.over; i++) {
    b.spawnOrb();
    const orb = b.orbs.getChildren().find((o) => o.active);
    if (orb) { b.player.setPosition(orb.x, orb.y); b.commit(orb); }
  }
});
await waitFor('Credits', 'winning the defense did not reach the credits');
await page.waitForTimeout(1600);

const finish = await page.evaluate(() => {
  const c = window.__game.scene.getScene('Credits');
  return { entry: c?.entry, tiles: c?.tiles?.length, best: window.__state.best };
});
console.log(`  CREDITS  time=${finish.entry?.timeMs}ms gpa=${finish.entry?.gpa} met=${finish.entry?.met} wall=${finish.tiles} portraits`);
if (!finish.entry) problems.push('credits produced no run entry');
if (!finish.best) problems.push('personal best was not saved');
console.log(`  scenes at the end: ${(await activeKeys()).join(', ')}`);

// Replay. Scene instances are reused, so a second run exercises every
// "already done" guard in the game; this is where stale flags show up.
await page.evaluate(() => window.__game.scene.getScene('Credits').again());
await waitFor('Title', 'Play Again did not return to the title');
await page.waitForTimeout(400);
await page.evaluate(() => window.__game.scene.getScene('Title').begin());
await waitFor('Setup', 'a second run could not leave the title screen');
await page.waitForTimeout(300);
await page.evaluate(() => window.__game.scene.getScene('Setup').begin());
await waitFor('Terminal', 'a second run could not leave the setup screen');
await page.evaluate(() => window.__game.scene.getScene('Terminal').finish());
await waitForLevel(1);
const replay = await page.evaluate(() => {
  const s = window.__game.scene.getScene('Level');
  return { level: s.levelId, npcs: s.npcs.length, met: s.metThisLevel, points: window.__state.points };
});
console.log(`  REPLAY   back in year ${replay.level} with ${replay.npcs} classmates, score reset to ${replay.points}`);
if (replay.level !== 1) problems.push(`replay started at year ${replay.level}`);
if (replay.met !== 0 || replay.points !== 0) problems.push('replay did not reset the run');

// Dying and continuing: the blue screen must hand control back.
await page.evaluate(() => {
  window.__state.battery = 0;
  window.__game.scene.getScene('Level').fail('BATTERY_DEPLETED');
});
await waitFor('BSOD', 'losing all battery did not show the blue screen');
await page.waitForTimeout(2200);
await page.evaluate(() => window.__game.scene.getScene('BSOD').continueRun());
await waitForLevel(1);
const revived = await page.evaluate(() => ({
  battery: Math.round(window.__state.battery),
  deaths: window.__state.deaths,
  playable: window.__game.scene.getScene('Level').ready,
}));
console.log(`  CONTINUE recovered at ${revived.battery}% battery after ${revived.deaths} BSOD(s), playable=${revived.playable}`);
if (!revived.playable || revived.battery < 50) problems.push('continuing after a BSOD left the run broken');

await page.screenshot({ path: 'screenshots/15-full-run-credits.png' });
await browser.close();

if (errors.length) {
  console.error('\n  console/page errors:');
  for (const e of [...new Set(errors)]) console.error(`   - ${e}`);
}
if (problems.length) {
  console.error('\n  progression problems:');
  for (const p of problems) console.error(`   - ${p}`);
}
if (errors.length || problems.length) process.exit(1);
console.log('\n  Full run completed: 5 levels, boss, credits.');
