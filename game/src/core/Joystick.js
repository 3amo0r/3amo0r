/**
 * Thumb controls for phones. Roughly 80% of the class will open this on a
 * phone at the party, so the joystick appears automatically on touch devices
 * and stays out of the way on a laptop.
 */

export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);

export class Joystick {
  /**
   * @param {Phaser.Scene} scene  scene to draw into (usually the UI scene)
   * @param {object} opts  { radius, margin, depth }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.radius = opts.radius ?? 30;
    this.margin = opts.margin ?? 42;
    this.vector = { x: 0, y: 0 };
    this.actionDown = false;
    this.actionJustDown = false;
    this._pointerId = null;
    this._actionPointerId = null;

    const depth = opts.depth ?? 1000;
    const w = scene.scale.width;
    const h = scene.scale.height;

    this.baseX = this.margin;
    this.baseY = h - this.margin;

    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(depth).setAlpha(0.55);

    this.button = scene.add.circle(w - this.margin, h - this.margin, 22, 0xffffff, 0.16)
      .setScrollFactor(0).setDepth(depth).setStrokeStyle(2, 0xffffff, 0.5).setInteractive();
    this.buttonLabel = scene.add.text(w - this.margin, h - this.margin, 'A', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1).setAlpha(0.8);

    scene.input.addPointer(2);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', this.destroy, this);

    this.draw();
  }

  isActionArea(pointer) {
    const dx = pointer.x - this.button.x;
    const dy = pointer.y - this.button.y;
    return Math.hypot(dx, dy) <= 44;
  }

  onDown(pointer) {
    if (this.isActionArea(pointer)) {
      this._actionPointerId = pointer.id;
      this.actionDown = true;
      this.actionJustDown = true;
      return;
    }
    // Anywhere on the left half re-centres the stick under the thumb.
    if (pointer.x < this.scene.scale.width * 0.55 && this._pointerId === null) {
      this._pointerId = pointer.id;
      this.baseX = pointer.x;
      this.baseY = pointer.y;
      this.onMove(pointer);
    }
  }

  onMove(pointer) {
    if (pointer.id !== this._pointerId) return;
    let dx = pointer.x - this.baseX;
    let dy = pointer.y - this.baseY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) {
      dx = (dx / dist) * this.radius;
      dy = (dy / dist) * this.radius;
    }
    const dead = 4;
    this.vector = Math.hypot(dx, dy) < dead
      ? { x: 0, y: 0 }
      : { x: dx / this.radius, y: dy / this.radius };
    this.knob = { x: this.baseX + dx, y: this.baseY + dy };
    this.draw();
  }

  onUp(pointer) {
    if (pointer.id === this._actionPointerId) {
      this._actionPointerId = null;
      this.actionDown = false;
      return;
    }
    if (pointer.id !== this._pointerId) return;
    this._pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.knob = null;
    this.draw();
  }

  /** True once per press; call it from the scene's update loop. */
  consumeAction() {
    const was = this.actionJustDown;
    this.actionJustDown = false;
    return was;
  }

  draw() {
    const g = this.gfx;
    g.clear();
    const active = this._pointerId !== null;
    g.lineStyle(2, 0xffffff, active ? 0.75 : 0.35);
    g.strokeCircle(this.baseX, this.baseY, this.radius);
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(this.baseX, this.baseY, this.radius);
    const k = this.knob || { x: this.baseX, y: this.baseY };
    g.fillStyle(0xffffff, active ? 0.45 : 0.22);
    g.fillCircle(k.x, k.y, 12);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.gfx?.destroy();
    this.button?.destroy();
    this.buttonLabel?.destroy();
  }
}
