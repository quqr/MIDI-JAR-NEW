import { describe, it, expect } from "vitest";
import { perlin2, fbm2 } from "../engine/PerlinNoise";

describe("PerlinNoise", () => {
  describe("perlin2", () => {
    it("整数坐标返回 0（无梯度贡献）", () => {
      // 整数坐标处 perlin noise 通常为 0
      const result = perlin2(0, 0);
      expect(Math.abs(result)).toBeLessThan(1e-10);
    });

    it("输出在 [-1, 1] 范围内", () => {
      // 采样多个点
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 10;
        const y = Math.random() * 10;
        const result = perlin2(x, y);
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it("连续性：相近输入产生相近输出", () => {
      const x = 1.5;
      const y = 2.5;
      const r1 = perlin2(x, y);
      const r2 = perlin2(x + 0.001, y + 0.001);
      expect(Math.abs(r2 - r1)).toBeLessThan(0.01);
    });

    it("周期性：perlin2(x + 256, y) ≈ perlin2(x, y)", () => {
      const x = 1.5;
      const y = 2.5;
      const r1 = perlin2(x, y);
      const r2 = perlin2(x + 256, y);
      // 由于 PERMUTATION 数组长度为 256，噪声应具有 256 的周期性
      expect(r2).toBeCloseTo(r1, 5);
    });
  });

  describe("fbm2", () => {
    it("输出在 [-1, 1] 范围内", () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 10;
        const y = Math.random() * 10;
        const result = fbm2(x, y);
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it("默认 3 个倍频", () => {
      // 默认参数 octaves=3，应正常返回
      const result = fbm2(1.5, 2.5);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("不同倍频数产生不同结果", () => {
      const x = 1.5;
      const y = 2.5;
      const r1 = fbm2(x, y, 1);
      const r2 = fbm2(x, y, 4);
      // 倍频越多，细节越多，结果通常不同
      expect(r1).not.toBeCloseTo(r2, 3);
    });

    it("连续性", () => {
      const x = 1.5;
      const y = 2.5;
      const r1 = fbm2(x, y);
      const r2 = fbm2(x + 0.001, y + 0.001);
      expect(Math.abs(r2 - r1)).toBeLessThan(0.01);
    });
  });
});
