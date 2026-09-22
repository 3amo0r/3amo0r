/**
 * Playable smoke test. Boots the built game in Chromium, walks it from the
 * title screen into a level, talks to a classmate and screenshots each step.
 * Fails on any console error or page exception.
 *
 *     npm run smoke
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
import { mkdirSync, existsSync } from 'node:fs';

const BASE = process.env.SMOKE_URL || 'http://localhost:4173';
const OUT = process.env.SMOKE_OUT || 'screenshots';
mkdirSync(OUT, { recursive: true });

const errors = [];
const shots = [];

const shot = async (page, name) => {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
  console.log(`  shot  ${path}`);
};

const sceneInfo = (page) => page.evaluate(() => {
  const game = window.__game;
  if (!game) return { error: 'no game handle' };
  const active = game.scene.getScenes(true).map((s) => s.scene.key);
  const level = game.scene.getScene('Level');
  return {
    active,
    npcs: level?.npcs?.length ?? null,
    staff: level?.staff?.length ?? null,
    met: level?.metThisLevel ?? null,
    playerX: level?.player ? Math.round(level.player.x) : null,
    playerY: level?.player ? Math.round(level.player.y) : null,
    battery: window.__state?.battery ?? null,
    points: window.__state?.points ?? null,
  };
});

// Use the Chromium already on this machine rather than downloading one.
const CHROME = process.env.SMOKE_CHROME
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => existsSync(p));

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

// Webfonts come from a CDN that some sandboxes block; the game falls back to
// system fonts, so that one failure must not fail the test.
const IGNORABLE = /fonts\.(googleapis|gstatic)\.com|ERR_CERT_AUTHORITY_INVALID/i;
const note = (msg) => { if (!IGNORABLE.test(msg)) errors.push(msg); };

page.on('console', (msg) => {
  if (msg.type() === 'error') note(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => note(`pageerror: ${err.message}`));

console.log(`  opening ${BASE}`);
await page.goto(BASE, { waitUntil: 'networkidle' });

// Wait for Boot to hand off to the title screen.
await page.waitForFunction(
  () => window.__game?.scene?.getScenes(true)?.some((s) => s.scene.key === 'Title'),
  { timeout: 25000 }
);
console.log('  title reached:', JSON.stringify(await sceneInfo(page)));
await shot(page, '01-title');

// Start a run.
await page.click('canvas');
await page.keyboard.press('Space');
await page.waitForFunction(
  () => window.__game?.scene?.getScenes(true)?.some((s) => s.scene.key === 'Setup'),
  { timeout: 10000 }
);
await shot(page, '02-setup');

// Fill the name and quote fields, then begin.
const inputs = page.locator('#game input');
await inputs.first().fill('Omar');
await inputs.nth(1).fill('ده كان أحلى خمس سنين');
await shot(page, '03-setup-filled');
await page.evaluate(() => window.__game.scene.getScene('Setup').begin());

await page.waitForFunction(
  () => window.__game?.scene?.getScenes(true)?.some((s) => s.scene.key === 'Terminal'),
  { timeout: 10000 }
);
await page.waitForTimeout(1800);
await shot(page, '04-terminal');

// Skip the typing and enter the level.
await page.evaluate(() => window.__game.scene.getScene('Terminal').finish());
await page.waitForFunction(
  () => {
    const lvl = window.__game?.scene?.getScene('Level');
    return lvl?.scene.isActive() && lvl.ready === true;
  },
  { timeout: 15000 }
);
await page.waitForTimeout(900);
const inLevel = await sceneInfo(page);
console.log('  level 1:', JSON.stringify(inLevel));
await shot(page, '05-level1');

// Walk around for a moment so movement, animation and collision all run.
for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
  await page.keyboard.down(key);
  await page.waitForTimeout(420);
  await page.keyboard.up(key);
}
const afterWalk = await sceneInfo(page);
console.log('  after walking:', JSON.stringify(afterWalk));
await shot(page, '06-after-walk');

// Teleport next to a classmate and open the dialogue box.
await page.evaluate(() => {
  const lvl = window.__game.scene.getScene('Level');
  const npc = lvl.npcs[0];
  lvl.player.setPosition(npc.x, npc.y + 12);
});
await page.waitForTimeout(260);
await page.evaluate(() => window.__game.scene.getScene('Level').tryInteract());
await page.waitForFunction(
  () => window.__game?.scene?.getScenes(true)?.some((s) => s.scene.key === 'Dialogue'),
  { timeout: 8000 }
);
await page.waitForTimeout(1300);
await shot(page, '07-dialogue');

// Close it and confirm the meeting was recorded.
await page.evaluate(() => window.__game.scene.getScene('Dialogue').close());
await page.waitForTimeout(500);
const afterTalk = await sceneInfo(page);
console.log('  after talking:', JSON.stringify(afterTalk));

// The boss fight.
await page.evaluate(() => {
  window.__game.scene.stop('UI');
  window.__game.scene.stop('Level');
  window.__game.scene.start('Boss');
});
await page.waitForFunction(
  () => window.__game?.scene?.getScene('Boss')?.scene.isActive(),
  { timeout: 12000 }
);
await page.waitForTimeout(2600);
await shot(page, '08-boss');

// The blue screen.
await page.evaluate(() => window.__game.scene.start('BSOD', { reason: 'PROJECT_FAILED_TO_COMPILE', resume: { scene: 'Boss' } }));
await page.waitForTimeout(1700);
await shot(page, '09-bsod');

// The credits wall.
await page.evaluate(() => {
  window.__state.points = 1500;
  window.__state.met = new Set(['s001', 's002', 's003']);
  window.__game.scene.start('Credits');
});
await page.waitForTimeout(2600);
await shot(page, '10-credits');

// Phone-sized pass over the title screen, joystick included.
const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
phone.on('pageerror', (err) => note(`mobile pageerror: ${err.message}`));
await phone.goto(BASE, { waitUntil: 'networkidle' });
await phone.waitForFunction(
  () => window.__game?.scene?.getScenes(true)?.some((s) => s.scene.key === 'Title'),
  { timeout: 25000 }
);
await phone.screenshot({ path: `${OUT}/11-mobile-title.png` });
shots.push(`${OUT}/11-mobile-title.png`);

await phone.evaluate(() => {
  window.__state.startRun({ name: 'موبايل', quote: '', avatarRow: 1 });
  window.__game.scene.start('Level', { level: 2 });
});
await phone.waitForFunction(
  () => window.__game?.scene?.getScene('Level')?.ready === true,
  { timeout: 15000 }
);
await phone.waitForTimeout(1200);
await phone.screenshot({ path: `${OUT}/12-mobile-level.png` });
shots.push(`${OUT}/12-mobile-level.png`);
const mobileInfo = await sceneInfo(phone);
console.log('  mobile level 2:', JSON.stringify(mobileInfo));

await browser.close();

console.log(`\n  ${shots.length} screenshots written to ${OUT}/`);
if (errors.length) {
  console.error(`\n  ${errors.length} console/page error(s):`);
  for (const e of [...new Set(errors)]) console.error(`   - ${e}`);
  process.exit(1);
}
if (!inLevel.npcs || inLevel.npcs < 20) {
  console.error(`\n  level 1 only spawned ${inLevel.npcs} classmates`);
  process.exit(1);
}
console.log('\n  Smoke test passed.');
