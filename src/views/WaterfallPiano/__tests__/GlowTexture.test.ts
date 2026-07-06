import { describe, it, expect } from "vitest";
import { lifecycleCurve, lifecyclePeaked } from "../engine/GlowTexture";

describe("GlowTexture 生命周期曲线", () => {
  describe("lifecycleCurve", () => {
    it("lifeRatio=0 返回 0", () => {
      expect(lifecycleCurve(0)).toBeCloseTo(0, 5);
    });

    it("lifeRatio=1 返回 0", () => {
      expect(lifecycleCurve(1)).toBeCloseTo(0, 5);
    });

    it("lifeRatio=0.5 返回 1（峰值）", () => {
      // sin(π * 0.5) = sin(π/2) = 1
      expect(lifecycleCurve(0.5)).toBeCloseTo(1, 5);
    });

    it("曲线对称：lifecycleCurve(0.25) ≈ lifecycleCurve(0.75)", () => {
      // sin(π * 0.25) = sin(π * 0.75)（正弦对称性）
      expect(lifecycleCurve(0.25)).toBeCloseTo(lifecycleCurve(0.75), 5);
    });

    it("所有输出在 [0, 1] 范围内", () => {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const result = lifecycleCurve(t);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it("越界值被 clamp 到 [0, 1]", () => {
      expect(lifecycleCurve(-0.5)).toBeCloseTo(0, 5);
      expect(lifecycleCurve(1.5)).toBeCloseTo(0, 5);
    });

    it("单调递增到 0.5，然后单调递减", () => {
      const prev1 = lifecycleCurve(0.1);
      const mid = lifecycleCurve(0.5);
      const next1 = lifecycleCurve(0.9);
      expect(mid).toBeGreaterThan(prev1);
      expect(mid).toBeGreaterThan(next1);
    });
  });

  describe("lifecyclePeaked", () => {
    it("lifeRatio=0 返回 0", () => {
      expect(lifecyclePeaked(0)).toBeCloseTo(0, 5);
    });

    it("lifeRatio=1 返回 0", () => {
      expect(lifecyclePeaked(1)).toBeCloseTo(0, 5);
    });

    it("默认峰值在 0.3", () => {
      expect(lifecyclePeaked(0.3)).toBeCloseTo(1, 5);
    });

    it("自定义峰值位置", () => {
      expect(lifecyclePeaked(0.5, 0.5)).toBeCloseTo(1, 5);
      expect(lifecyclePeaked(0.2, 0.2)).toBeCloseTo(1, 5);
    });

    it("峰值前单调递增", () => {
      const peak = 0.3;
      for (let i = 0; i < 5; i++) {
        const t1 = (i / 10) * peak;
        const t2 = ((i + 1) / 10) * peak;
        expect(lifecyclePeaked(t2, peak)).toBeGreaterThanOrEqual(
          lifecyclePeaked(t1, peak),
        );
      }
    });

    it("峰值后单调递减", () => {
      const peak = 0.3;
      for (let i = 0; i < 5; i++) {
        const t1 = peak + (i / 10) * (1 - peak);
        const t2 = peak + ((i + 1) / 10) * (1 - peak);
        expect(lifecyclePeaked(t2, peak)).toBeLessThanOrEqual(
          lifecyclePeaked(t1, peak),
        );
      }
    });

    it("所有输出在 [0, 1] 范围内", () => {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const result = lifecyclePeaked(t);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it("越界值被 clamp", () => {
      expect(lifecyclePeaked(-0.5)).toBeCloseTo(0, 5);
      expect(lifecyclePeaked(1.5)).toBeCloseTo(0, 5);
    });
  });
});
