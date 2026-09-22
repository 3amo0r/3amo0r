import config from '../data/game_config.json';

export const PAL = config.palette;

/** Pixel font for Latin UI; falls back to monospace if the webfont is blocked. */
export const FONT_PIXEL = '"Press Start 2P", "Courier New", monospace';
/** Arabic needs a real text font — the pixel face has no Arabic glyphs. */
export const FONT_AR = '"Tajawal", "Cairo", "Segoe UI", Tahoma, sans-serif';

export const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;

/** Chunky bordered panel in the retro UI style. */
export function panel(scene, x, y, w, h, opts = {}) {
  const {
    fill = PAL.night,
    border = PAL.mist,
    accent = PAL.sky,
    alpha = 0.96,
    depth = 500,
  } = opts;
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  g.fillStyle(hex(PAL.ink), alpha * 0.9);
  g.fillRect(x + 2, y + 2, w, h);              // drop shadow
  g.fillStyle(hex(fill), alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, hex(border), 1);
  g.strokeRect(x, y, w, h);
  g.fillStyle(hex(accent), 1);                  // corner studs
  for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) {
    g.fillRect(cx, cy, 3, 3);
  }
  return g;
}

export function pixelText(scene, x, y, text, opts = {}) {
  const {
    size = 8, color = PAL.paper, align = 'left', origin = [0, 0],
    depth = 510, wrap = 0, font = FONT_PIXEL, lineSpacing = 4,
  } = opts;
  const t = scene.add.text(x, y, text, {
    fontFamily: font,
    fontSize: `${size}px`,
    color,
    align,
    lineSpacing,
    wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined,
  }).setOrigin(origin[0], origin[1]).setDepth(depth).setScrollFactor(0);
  t.setResolution(Math.max(2, Math.ceil(window.devicePixelRatio || 1) * 2));
  return t;
}

export function arabicText(scene, x, y, text, opts = {}) {
  return pixelText(scene, x, y, text, { font: FONT_AR, size: 12, align: 'right', ...opts });
}

/** Clickable retro button. Returns { rect, label, setEnabled }. */
export function button(scene, x, y, w, h, text, onClick, opts = {}) {
  const { color = PAL.sky, textColor = PAL.ink, size = 8, depth = 520, font = FONT_PIXEL } = opts;
  const rect = scene.add.rectangle(x, y, w, h, hex(color))
    .setDepth(depth).setScrollFactor(0).setInteractive({ useHandCursor: true });
  rect.setStrokeStyle(2, hex(PAL.ink));
  const label = scene.add.text(x, y, text, {
    fontFamily: font, fontSize: `${size}px`, color: textColor, align: 'center',
  }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
  label.setResolution(Math.max(2, Math.ceil(window.devicePixelRatio || 1) * 2));

  let enabled = true;
  rect.on('pointerover', () => enabled && rect.setFillStyle(hex(color), 0.82));
  rect.on('pointerout', () => enabled && rect.setFillStyle(hex(color), 1));
  rect.on('pointerdown', () => {
    if (!enabled) return;
    rect.setScale(0.97);
    scene.time.delayedCall(70, () => rect.setScale(1));
    onClick();
  });

  return {
    rect,
    label,
    setEnabled(v) {
      enabled = v;
      rect.setFillStyle(hex(v ? color : PAL.steel), 1);
      label.setAlpha(v ? 1 : 0.55);
      if (v) rect.setInteractive({ useHandCursor: true });
      else rect.disableInteractive();
    },
    destroy() { rect.destroy(); label.destroy(); },
  };
}

/** Horizontal meter used for the battery, the deploy bar and boss health. */
export function meter(scene, x, y, w, h, opts = {}) {
  const { bg = PAL.ink, border = PAL.mist, depth = 900 } = opts;
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  const draw = (ratio, color) => {
    g.clear();
    g.fillStyle(hex(bg), 0.85);
    g.fillRect(x, y, w, h);
    const filled = Math.max(0, Math.min(1, ratio));
    if (filled > 0) {
      g.fillStyle(hex(color), 1);
      g.fillRect(x + 1, y + 1, Math.round((w - 2) * filled), h - 2);
      g.fillStyle(hex(PAL.paper), 0.25);
      g.fillRect(x + 1, y + 1, Math.round((w - 2) * filled), 1);
    }
    g.lineStyle(1, hex(border), 1);
    g.strokeRect(x, y, w, h);
  };
  draw(1, PAL.mint);
  return { gfx: g, draw };
}

/** Short toast in the middle of the screen. */
export function toast(scene, text, opts = {}) {
  const { color = PAL.gold, y = 62, font = FONT_AR, size = 12, duration = 1500 } = opts;
  const cam = scene.cameras.main;
  const t = scene.add.text(cam.width / 2, y, text, {
    fontFamily: font, fontSize: `${size}px`, color, align: 'center',
    stroke: PAL.ink, strokeThickness: 3,
  }).setOrigin(0.5).setDepth(2000).setScrollFactor(0);
  t.setResolution(Math.max(2, Math.ceil(window.devicePixelRatio || 1) * 2));
  scene.tweens.add({
    targets: t, y: y - 14, alpha: 0, duration, ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
  return t;
}
