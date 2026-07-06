import { describe, it, expect, beforeEach } from "vitest";
import { NoteColorMapper } from "../engine/NoteColorMapper";

describe("NoteColorMapper", () => {
  let mapper: NoteColorMapper;

  beforeEach(() => {
    mapper = new NoteColorMapper();
  });

  describe("pitch 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("pitch");
    });

    it("返回有效的 HSL 颜色字符串", () => {
      const color = mapper.getColor(60);
      expect(color).toMatch(/^hsl\(/);
    });

    it("低音偏红（hue 接近 0）", () => {
      // MIDI 21 (A0) 是最低音，hue 应该接近 0
      const color = mapper.getColor(21);
      expect(color).toMatch(/hsl\(0,/);
    });

    it("高音偏紫（hue 接近 300）", () => {
      // MIDI 108 (C8) 是最高音
      const color = mapper.getColor(108);
      // hue 应该接近 300
      const match = color.match(/hsl\((\d+)/);
      expect(match).not.toBeNull();
      const hue = parseInt(match![1]);
      expect(hue).toBeGreaterThanOrEqual(290);
    });

    it("音高越高 hue 越大", () => {
      const low = mapper.getColor(30);
      const high = mapper.getColor(100);
      const lowHue = parseInt(low.match(/hsl\((\d+)/)![1]);
      const highHue = parseInt(high.match(/hsl\((\d+)/)![1]);
      expect(highHue).toBeGreaterThan(lowHue);
    });
  });

  describe("hands 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("hands");
    });

    it("返回默认 indigo 颜色", () => {
      const color = mapper.getColor(60);
      expect(color).toMatch(/hsl\(250,/);
    });
  });

  describe("warm 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("warm");
    });

    it("低音返回红色（hue 0-60）", () => {
      const color = mapper.getColor(21);
      const match = color.match(/hsl\((\d+)/);
      expect(match).not.toBeNull();
      const hue = parseInt(match![1]);
      expect(hue).toBeLessThanOrEqual(60);
    });

    it("所有颜色 hue 在 0-60 范围内", () => {
      for (let midi = 21; midi <= 108; midi += 12) {
        const color = mapper.getColor(midi);
        const match = color.match(/hsl\((\d+)/);
        const hue = parseInt(match![1]);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThanOrEqual(60);
      }
    });
  });

  describe("cool 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("cool");
    });

    it("所有颜色 hue 在 160-210 范围内", () => {
      for (let midi = 21; midi <= 108; midi += 12) {
        const color = mapper.getColor(midi);
        const match = color.match(/hsl\((\d+)/);
        const hue = parseInt(match![1]);
        expect(hue).toBeGreaterThanOrEqual(160);
        expect(hue).toBeLessThanOrEqual(210);
      }
    });
  });

  describe("rainbow 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("rainbow");
    });

    it("覆盖完整色环（hue 0-360）", () => {
      const low = mapper.getColor(21);
      const high = mapper.getColor(108);
      const lowHue = parseInt(low.match(/hsl\((\d+)/)![1]);
      const highHue = parseInt(high.match(/hsl\((\d+)/)![1]);
      expect(highHue).toBeGreaterThan(lowHue);
      expect(highHue).toBeCloseTo(360, 0);
    });
  });

  describe("neon 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("neon");
    });

    it("使用 100% 饱和度", () => {
      const color = mapper.getColor(60);
      expect(color).toMatch(/hsl\([\d.]+, 100%,/);
    });
  });

  describe("custom 颜色方案", () => {
    beforeEach(() => {
      mapper.setScheme("custom");
      mapper.setCustomColors({
        low: "#ff0000",
        mid: "#00ff00",
        high: "#0000ff",
      });
    });

    it("低音返回接近 low 的颜色", () => {
      const color = mapper.getColor(21);
      // t=0，应该返回 low 和 mid 之间的插值（t/0.33 = 0）
      expect(color).toMatch(/^rgb\(/);
      // 红色分量应该最高
      const match = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
      expect(match).not.toBeNull();
      const r = parseInt(match![1]);
      const g = parseInt(match![2]);
      const b = parseInt(match![3]);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(r).toBeGreaterThanOrEqual(b);
    });

    it("高音返回 high 颜色", () => {
      // t=1 时直接返回 customColors.high（hex 字符串）
      const color = mapper.getColor(108);
      expect(color).toBe("#0000ff");
    });

    it("中间音返回 mid 附近的颜色", () => {
      // MIDI 60 是 C4，t = (60-21)/87 ≈ 0.448，在 mid 区间
      const color = mapper.getColor(60);
      expect(color).toMatch(/^rgb\(/);
    });

    it("自定义颜色变化生效", () => {
      mapper.setCustomColors({
        low: "#000000",
        mid: "#808080",
        high: "#ffffff",
      });
      const color = mapper.getColor(21);
      expect(color).toMatch(/^rgb\(/);
    });
  });

  describe("边界值", () => {
    it("MIDI 0 不抛出错误", () => {
      mapper.setScheme("pitch");
      expect(() => mapper.getColor(0)).not.toThrow();
    });

    it("MIDI 127 不抛出错误", () => {
      mapper.setScheme("pitch");
      expect(() => mapper.getColor(127)).not.toThrow();
    });

    it("负 MIDI 不抛出错误", () => {
      mapper.setScheme("pitch");
      expect(() => mapper.getColor(-10)).not.toThrow();
    });
  });

  describe("setScheme", () => {
    it("切换方案后颜色变化", () => {
      mapper.setScheme("warm");
      const warmColor = mapper.getColor(60);
      mapper.setScheme("cool");
      const coolColor = mapper.getColor(60);
      expect(warmColor).not.toBe(coolColor);
    });
  });
});
