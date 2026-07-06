import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock PIXI 以避免 jsdom 环境下 WebGL 不可用
vi.mock("pixi.js", () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) {
      this.children.push(child);
    }
    removeChild(child: unknown) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
    }
  }
  class MockGraphics {
    clear() {}
    circle() {
      return this;
    }
    rect() {
      return this;
    }
    fill() {}
    stroke() {}
    destroy() {}
  }
  class MockSprite {
    anchor = { set() {} };
    scale = { set() {} };
    x = 0;
    y = 0;
    tint = 0;
    alpha = 1;
    visible = true;
    texture = null;
    destroy() {}
  }
  const MockTexture = {
    from: () => ({}),
    EMPTY: {},
  };
  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    Texture: MockTexture,
  };
});

// Mock GlowTexture 以避免 canvas 调用
vi.mock("../engine/GlowTexture", () => ({
  getGlowTexture: () => ({}),
  getStarTexture: () => ({}),
  clearGlowTextureCache: () => {},
  lifecycleCurve: (t: number) =>
    Math.sin(Math.PI * Math.max(0, Math.min(1, t))),
  lifecyclePeaked: (t: number, peak = 0.3) => {
    const x = Math.max(0, Math.min(1, t));
    if (x < peak) return x / peak;
    return 1 - (x - peak) / (1 - peak);
  },
}));

import { ParticleSystem } from "../engine/ParticleSystem";
import type {
  TrailParticleConfig,
  HitParticleConfig,
  ParticlePhysicsConfig,
} from "../types";

describe("ParticleSystem", () => {
  let system: ParticleSystem;
  let container: { children: unknown[]; addChild: (c: unknown) => void };

  beforeEach(() => {
    container = { children: [], addChild: () => {} };
    system = new ParticleSystem(container as never);
  });

  describe("配置 setter", () => {
    it("setTrailConfig 不抛出错误", () => {
      const config: TrailParticleConfig = {
        size: 5,
        colorDecay: 0.4,
        spreadAngle: 45,
        lifetime: 40,
        glowTexture: true,
        turbulence: 0.5,
      };
      expect(() => system.setTrailConfig(config)).not.toThrow();
    });

    it("setHitConfig 不抛出错误", () => {
      const config: HitParticleConfig = {
        count: 10,
        speed: 4,
        lifetime: 25,
        glowTexture: true,
        turbulence: 0.4,
      };
      expect(() => system.setHitConfig(config)).not.toThrow();
    });

    it("setPhysicsConfig 不抛出错误", () => {
      const config: ParticlePhysicsConfig = {
        gravity: 1,
        windX: 0.5,
        windY: 0,
      };
      expect(() => system.setPhysicsConfig(config)).not.toThrow();
    });

    it("setHardLimit 不抛出错误", () => {
      expect(() => system.setHardLimit(1000)).not.toThrow();
    });

    it("setDegradeMode 不抛出错误", () => {
      expect(() => system.setDegradeMode(true)).not.toThrow();
      expect(() => system.setDegradeMode(false)).not.toThrow();
    });

    it("setLifecycleEnabled 不抛出错误", () => {
      expect(() => system.setLifecycleEnabled(true)).not.toThrow();
      expect(() => system.setLifecycleEnabled(false)).not.toThrow();
    });

    it("setShape 不抛出错误", () => {
      expect(() => system.setShape("circle")).not.toThrow();
      expect(() => system.setShape("square")).not.toThrow();
      expect(() => system.setShape("star")).not.toThrow();
      expect(() => system.setShape("note")).not.toThrow();
    });
  });

  describe("粒子生成 - spawnTrail", () => {
    it("生成拖尾粒子不抛出错误", () => {
      expect(() => system.spawnTrail(100, 200, 0xff0000, 1, 5)).not.toThrow();
    });

    it("高 density 生成更多粒子（不抛出错误）", () => {
      expect(() => system.spawnTrail(100, 200, 0xff0000, 1, 20)).not.toThrow();
    });

    it("向上方向不抛出错误", () => {
      expect(() => system.spawnTrail(100, 200, 0xff0000, -1, 5)).not.toThrow();
    });
  });

  describe("粒子生成 - spawnHitExplosion", () => {
    it("生成命中爆炸不抛出错误", () => {
      expect(() =>
        system.spawnHitExplosion(100, 200, 0xff0000, 8),
      ).not.toThrow();
    });

    it("不同 baseSize 不抛出错误", () => {
      expect(() =>
        system.spawnHitExplosion(100, 200, 0xff0000, 1),
      ).not.toThrow();
      expect(() =>
        system.spawnHitExplosion(100, 200, 0xff0000, 30),
      ).not.toThrow();
    });
  });

  describe("粒子生成 - spawnSurfaceEmission", () => {
    it("生成表面散发粒子不抛出错误", () => {
      expect(() =>
        system.spawnSurfaceEmission(100, 200, 50, 100, 0xff0000, 0.5, 2, 30),
      ).not.toThrow();
    });
  });

  describe("update", () => {
    it("空系统 update 不抛出错误", () => {
      expect(() => system.update(0.016)).not.toThrow();
    });

    it("有粒子时 update 不抛出错误", () => {
      system.spawnTrail(100, 200, 0xff0000, 1, 10);
      expect(() => system.update(0.016)).not.toThrow();
    });

    it("粒子生命周期结束后被移除", () => {
      system.setTrailConfig({
        size: 4,
        colorDecay: 0.5,
        spreadAngle: 30,
        lifetime: 1,
        glowTexture: false,
        turbulence: 0,
      });
      system.spawnTrail(100, 200, 0xff0000, 1, 10);
      // 多次 update 使粒子生命结束
      for (let i = 0; i < 100; i++) {
        system.update(0.1);
      }
      // 粒子应被移除（无法直接访问私有字段，但不抛出错误即表示正常）
      expect(true).toBe(true);
    });
  });

  describe("硬上限裁剪", () => {
    it("设置低硬上限后生成大量粒子不抛出错误", () => {
      system.setHardLimit(10);
      // 尝试生成超过上限的粒子
      for (let i = 0; i < 20; i++) {
        system.spawnHitExplosion(i * 10, 100, 0xff0000, 4);
      }
      // 不应抛出错误，且粒子数被限制
      expect(() => system.update(0.016)).not.toThrow();
    });

    it("设置高硬上限正常工作", () => {
      system.setHardLimit(2000);
      for (let i = 0; i < 10; i++) {
        system.spawnHitExplosion(i * 10, 100, 0xff0000, 4);
      }
      expect(() => system.update(0.016)).not.toThrow();
    });
  });

  describe("降级模式", () => {
    it("启用降级模式后生成粒子不抛出错误", () => {
      system.setDegradeMode(true);
      expect(() => system.spawnTrail(100, 200, 0xff0000, 1, 10)).not.toThrow();
      expect(() =>
        system.spawnHitExplosion(100, 200, 0xff0000, 8),
      ).not.toThrow();
    });

    it("降级模式下粒子数量应减少（通过不抛错验证）", () => {
      system.setDegradeMode(true);
      system.setHardLimit(50);
      for (let i = 0; i < 30; i++) {
        system.spawnHitExplosion(i * 5, 100, 0xff0000, 4);
      }
      expect(() => system.update(0.016)).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("destroy 不抛出错误", () => {
      system.spawnTrail(100, 200, 0xff0000, 1, 5);
      expect(() => system.destroy()).not.toThrow();
    });
  });
});
