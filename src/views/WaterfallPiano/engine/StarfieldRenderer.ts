import * as PIXI from "pixi.js";

// ─── 粒子星空：缓慢漂移的微弱星点 ───
// 演奏强度驱动：活跃音符数影响星点亮度/漂移速度

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  vx: number;
  vy: number;
  twinkleSeed: number;
}

export class StarfieldRenderer {
  private graphics: PIXI.Graphics;
  private stars: Star[] = [];
  private width = 0;
  private height = 0;
  private density = 0.5;
  private enabled = false;
  private degradeMode = false;
  private maxStars = 200;

  constructor(container: PIXI.Container) {
    this.graphics = new PIXI.Graphics();
    container.addChild(this.graphics);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  setDensity(density: number) {
    this.density = density;
    this.regenerate();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.regenerate();
  }

  setDegradeMode(enabled: boolean) {
    this.degradeMode = enabled;
    if (enabled) {
      this.maxStars = 100;
    } else {
      this.maxStars = 200;
    }
    this.regenerate();
  }

  private regenerate() {
    if (!this.enabled) return;
    const targetCount = Math.min(
      this.maxStars,
      Math.floor(this.density * this.maxStars),
    );
    this.stars = [];
    for (let i = 0; i < targetCount; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 1.5 + 0.3,
        baseAlpha: Math.random() * 0.5 + 0.2,
        alpha: 0,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        twinkleSeed: Math.random() * Math.PI * 2,
      });
    }
  }

  update(deltaSeconds: number, activeNoteCount: number) {
    if (!this.enabled || this.stars.length === 0) return;
    this.graphics.clear();

    // 演奏强度：活跃音符越多，星点越亮、漂移越快
    const intensity = Math.min(1, activeNoteCount / 10);
    const speedMultiplier = 1 + intensity * 2;
    const brightnessMultiplier = 1 + intensity * 0.8;

    const time = performance.now() / 1000;

    for (const star of this.stars) {
      star.x += star.vx * speedMultiplier * deltaSeconds * 60;
      star.y += star.vy * speedMultiplier * deltaSeconds * 60;

      // 环绕屏幕
      if (star.x < 0) star.x += this.width;
      else if (star.x > this.width) star.x -= this.width;
      if (star.y < 0) star.y += this.height;
      else if (star.y > this.height) star.y -= this.height;

      // 闪烁（降级时简化为静态亮度，减少 CPU 开销）
      const twinkle = this.degradeMode
        ? 0.85
        : 0.7 + 0.3 * Math.sin(time * 2 + star.twinkleSeed);
      const alpha = Math.min(
        1,
        star.baseAlpha * brightnessMultiplier * twinkle,
      );

      this.graphics.circle(star.x, star.y, star.size);
      this.graphics.fill({ color: 0xffffff, alpha });
    }
  }

  clear() {
    this.stars = [];
    this.graphics.clear();
  }

  destroy() {
    this.clear();
    this.graphics.destroy();
  }
}
