import * as PIXI from "pixi.js";
import { getGlowTexture, lifecycleCurve, lifecyclePeaked } from "./GlowTexture";
import { perlin2 } from "./PerlinNoise";
import type {
  TrailParticleConfig,
  HitParticleConfig,
  ParticlePhysicsConfig,
  ParticleShape,
} from "../types";

// ─── Particular 风格粒子：生命周期渐变、发光纹理、湍流运动 ───

interface Particle {
  x: number;
  y: number;
  size: number;
  color: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  // 湍流种子
  seed: number;
  // 起始大小（用于生命周期变化）
  initialSize: number;
  initialAlpha: number;
}

export class ParticleSystem {
  private container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private spritePool: PIXI.Sprite[] = [];
  private activeSprites: PIXI.Sprite[] = [];
  private particles: Particle[] = [];

  private trailConfig: TrailParticleConfig;
  private hitConfig: HitParticleConfig;
  private physicsConfig: ParticlePhysicsConfig;
  private shape: ParticleShape = "circle";
  private useGlowTexture = true;
  private lifecycleEnabled = true;
  private hardLimit = 500;
  private degradeMode = false;

  constructor(container: PIXI.Container) {
    this.container = container;
    this.graphics = new PIXI.Graphics();
    container.addChild(this.graphics);

    this.trailConfig = {
      size: 4,
      colorDecay: 0.5,
      spreadAngle: 30,
      lifetime: 30,
      glowTexture: true,
      turbulence: 0.3,
    };
    this.hitConfig = {
      count: 8,
      speed: 3,
      lifetime: 20,
      glowTexture: true,
      turbulence: 0.3,
    };
    this.physicsConfig = { gravity: 0, windX: 0, windY: 0 };
  }

  setTrailConfig(config: TrailParticleConfig) {
    this.trailConfig = config;
  }

  setHitConfig(config: HitParticleConfig) {
    this.hitConfig = config;
  }

  setPhysicsConfig(config: ParticlePhysicsConfig) {
    this.physicsConfig = config;
  }

  setShape(shape: ParticleShape) {
    this.shape = shape;
  }

  setUseGlowTexture(enabled: boolean) {
    this.useGlowTexture = enabled;
  }

  setLifecycleEnabled(enabled: boolean) {
    this.lifecycleEnabled = enabled;
  }

  setHardLimit(limit: number) {
    this.hardLimit = limit;
  }

  setDegradeMode(enabled: boolean) {
    this.degradeMode = enabled;
  }

  // ─── 生成拖尾粒子 ───
  spawnTrail(
    x: number,
    y: number,
    color: number,
    direction: number, // -1 = 向上，1 = 向下
    density: number,
  ) {
    const cfg = this.trailConfig;
    const count = Math.ceil(density * 0.15 * (this.degradeMode ? 0.5 : 1));
    const spreadRad = (cfg.spreadAngle / 180) * Math.PI;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.hardLimit) break;
      const px = x + Math.random() * 0; // x 范围由调用者控制
      const py = y;
      const baseAngle = direction < 0 ? -Math.PI / 2 : Math.PI / 2;
      const spread = (Math.random() - 0.5) * spreadRad;
      const speed = 0.5 + Math.random() * 1.5;
      const initSize = cfg.size * (0.4 + Math.random() * 0.6);

      this.particles.push({
        x: px,
        y: py,
        size: initSize,
        color,
        alpha: 0.7 + Math.random() * 0.3,
        vx: Math.cos(baseAngle + spread) * speed,
        vy: Math.sin(baseAngle + spread) * speed,
        life: 0,
        maxLife: cfg.lifetime + Math.random() * cfg.lifetime * 0.5,
        seed: Math.random() * 1000,
        initialSize: initSize,
        initialAlpha: 0.9,
      });
    }
  }

  // ─── 生成命中爆炸粒子 ───
  spawnHitExplosion(x: number, y: number, color: number, baseSize: number) {
    const cfg = this.hitConfig;
    const count = this.degradeMode ? Math.ceil(cfg.count * 0.5) : cfg.count;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.hardLimit) break;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = cfg.speed * (0.5 + Math.random());
      const initSize = baseSize * (0.5 + Math.random() * 1.2);
      this.particles.push({
        x,
        y,
        size: initSize,
        color,
        alpha: 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 0,
        maxLife: cfg.lifetime + Math.random() * cfg.lifetime * 0.5,
        seed: Math.random() * 1000,
        initialSize: initSize,
        initialAlpha: 1,
      });
    }
  }

  // ─── 生成表面散发粒子 ───
  spawnSurfaceEmission(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    rate: number,
    speed: number,
    lifetime: number,
  ) {
    if (Math.random() > rate * (this.degradeMode ? 0.5 : 1)) return;
    if (this.particles.length >= this.hardLimit) return;

    const side = Math.random() < 0.5 ? -1 : 1;
    const px = side < 0 ? x : x + width;
    const py = y + Math.random() * height;
    const s = speed * (0.3 + Math.random() * 0.7);
    const angle =
      side < 0
        ? Math.PI + (Math.random() - 0.5) * 0.8
        : (Math.random() - 0.5) * 0.8;
    const initSize = 2 + Math.random() * 3;

    this.particles.push({
      x: px,
      y: py,
      size: initSize,
      color,
      alpha: 0.6 + Math.random() * 0.4,
      vx: Math.cos(angle) * s,
      vy: (Math.random() - 0.5) * s * 0.5,
      life: 0,
      maxLife: lifetime + Math.random() * lifetime * 0.5,
      seed: Math.random() * 1000,
      initialSize: initSize,
      initialAlpha: 0.8,
    });
  }

  update(delta: number) {
    this.graphics.clear();

    // 释放多余的 sprite
    while (this.activeSprites.length > this.particles.length) {
      const sprite = this.activeSprites.pop()!;
      sprite.visible = false;
      this.spritePool.push(sprite);
    }

    const toRemove: number[] = [];
    const phys = this.physicsConfig;
    const turbulence = this.trailConfig.turbulence;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += delta;

      // 湍流（Perlin noise）
      if (turbulence > 0) {
        const t = p.life * 0.05;
        const nx = perlin2(p.seed + t, p.seed * 0.7) * turbulence * 0.5;
        const ny = perlin2(p.seed * 0.7, p.seed + t) * turbulence * 0.5;
        p.vx += nx * delta * 0.3;
        p.vy += ny * delta * 0.3;
      }

      // 物理
      p.vx += phys.windX * 0.01 * delta;
      p.vy += (phys.gravity * 0.01 + phys.windY * 0.01) * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio >= 1) {
        toRemove.push(i);
        continue;
      }

      // 生命周期曲线：大小和透明度变化
      const lifecycleT = this.lifecycleEnabled
        ? lifecycleCurve(lifeRatio)
        : 1 - lifeRatio;
      const size = p.initialSize * Math.max(0.1, lifecycleT);
      const alpha = p.initialAlpha * lifecycleT;

      if (alpha < 0.01) {
        toRemove.push(i);
        continue;
      }

      this.drawParticle(p.x, p.y, size, p.color, alpha);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.particles.splice(toRemove[i], 1);
    }
  }

  private drawParticle(
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number,
  ) {
    if (this.useGlowTexture) {
      // 使用发光纹理 sprite
      let sprite = this.activeSprites.shift();
      if (!sprite) {
        sprite = new PIXI.Sprite(getGlowTexture());
        this.container.addChild(sprite);
      }
      sprite.texture = getGlowTexture();
      sprite.anchor.set(0.5, 0.5);
      sprite.x = x;
      sprite.y = y;
      const scale = (size * 2) / 64; // 纹理尺寸为 64
      sprite.scale.set(scale);
      sprite.tint = color;
      sprite.alpha = alpha;
      sprite.visible = true;
      this.activeSprites.push(sprite);
    } else {
      // 使用 Graphics
      const g = this.graphics;
      switch (this.shape) {
        case "circle":
          g.circle(x, y, size);
          g.fill({ color, alpha });
          break;
        case "square":
          g.rect(x - size, y - size, size * 2, size * 2);
          g.fill({ color, alpha });
          break;
        case "note":
          g.circle(x, y, size);
          g.fill({ color, alpha });
          g.rect(x + size * 0.8, y - size * 2, 1, size * 2);
          g.fill({ color, alpha });
          break;
        case "star":
          g.circle(x, y, size);
          g.fill({ color, alpha });
          break;
      }
    }
  }

  clear() {
    this.particles = [];
    for (const sprite of this.activeSprites) {
      sprite.visible = false;
      this.spritePool.push(sprite);
    }
    this.activeSprites = [];
    this.graphics.clear();
  }

  getCount(): number {
    return this.particles.length;
  }

  destroy() {
    this.clear();
    for (const sprite of this.spritePool) {
      sprite.destroy();
    }
    this.spritePool = [];
    this.graphics.destroy();
  }
}

// 导出工具函数供外部使用
export { lifecycleCurve, lifecyclePeaked };
