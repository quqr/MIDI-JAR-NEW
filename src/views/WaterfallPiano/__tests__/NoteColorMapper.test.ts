import { describe, it, expect } from "vitest";
import { noteToColor, type CustomColors } from "../engine/NoteColorMapper";
import type { ColorScheme } from "../types";

const HEX_RE = /^#[0-9a-f]{6}$/i;

const DEFAULT_CUSTOM: CustomColors = {
  low: "#6366f1",
  mid: "#14b8a6",
  high: "#f59e0b",
};

describe("NoteColorMapper", () => {
  describe("pitch 方案", () => {
    it("midi=21（PITCH_LOW）返回 low 色", () => {
      expect(noteToColor(21, "pitch")).toBe(DEFAULT_CUSTOM.low);
    });

    it("midi=60（PITCH_MID）返回 mid 色", () => {
      expect(noteToColor(60, "pitch")).toBe(DEFAULT_CUSTOM.mid);
    });

    it("midi=108（PITCH_HIGH）返回 high 色", () => {
      expect(noteToColor(108, "pitch")).toBe(DEFAULT_CUSTOM.high);
    });

    it("中间值返回插值色（介于 low 与 mid 之间）", () => {
      const color = noteToColor(40, "pitch");
      expect(color).toMatch(HEX_RE);
      expect(color).not.toBe(DEFAULT_CUSTOM.low);
      expect(color).not.toBe(DEFAULT_CUSTOM.mid);
    });
  });

  describe("hands 方案", () => {
    it("hand=left 返回蓝色", () => {
      expect(noteToColor(60, "hands", "left")).toBe("#3b82f6");
    });

    it("hand=right 返回橙色", () => {
      expect(noteToColor(60, "hands", "right")).toBe("#f59e0b");
    });

    it("hand=undefined 返回 unknown 灰", () => {
      expect(noteToColor(60, "hands", undefined)).toBe("#9ca3af");
    });

    it("hand=unknown 返回 unknown 灰", () => {
      expect(noteToColor(60, "hands", "unknown")).toBe("#9ca3af");
    });
  });

  describe("rainbow 方案", () => {
    it("midi=0 与 midi=1 返回不同颜色", () => {
      const c0 = noteToColor(0, "rainbow");
      const c1 = noteToColor(1, "rainbow");
      expect(c0).toMatch(HEX_RE);
      expect(c1).toMatch(HEX_RE);
      expect(c0).not.toBe(c1);
    });
  });

  describe("warm / cool / neon 方案", () => {
    const schemes: ColorScheme[] = ["warm", "cool", "neon"];
    for (const scheme of schemes) {
      it(`${scheme} 方案返回合法 hex`, () => {
        expect(noteToColor(60, scheme)).toMatch(HEX_RE);
      });
    }
  });

  describe("custom 方案", () => {
    const custom: CustomColors = {
      low: "#ff0000",
      mid: "#00ff00",
      high: "#0000ff",
    };

    it("midi=21 返回 custom low", () => {
      expect(noteToColor(21, "custom", undefined, custom)).toBe("#ff0000");
    });

    it("midi=60 返回 custom mid", () => {
      expect(noteToColor(60, "custom", undefined, custom)).toBe("#00ff00");
    });

    it("midi=108 返回 custom high", () => {
      expect(noteToColor(108, "custom", undefined, custom)).toBe("#0000ff");
    });

    it("未传 customColors 时使用默认色", () => {
      expect(noteToColor(21, "custom")).toBe(DEFAULT_CUSTOM.low);
    });
  });

  describe("边界值", () => {
    it("midi=0 不报错且返回合法 hex", () => {
      expect(noteToColor(0, "pitch")).toMatch(HEX_RE);
    });

    it("midi=127 不报错且返回合法 hex", () => {
      expect(noteToColor(127, "pitch")).toMatch(HEX_RE);
    });

    it("所有方案在 midi=0 时不报错", () => {
      const allSchemes: ColorScheme[] = [
        "pitch",
        "hands",
        "rainbow",
        "warm",
        "cool",
        "neon",
        "custom",
      ];
      for (const s of allSchemes) {
        expect(() => noteToColor(0, s)).not.toThrow();
      }
    });

    it("所有方案在 midi=127 时不报错", () => {
      const allSchemes: ColorScheme[] = [
        "pitch",
        "hands",
        "rainbow",
        "warm",
        "cool",
        "neon",
        "custom",
      ];
      for (const s of allSchemes) {
        expect(() => noteToColor(127, s)).not.toThrow();
      }
    });
  });

  describe("格式校验", () => {
    it("pitch 方案全范围返回值匹配 #rrggbb", () => {
      for (let m = 0; m <= 127; m += 7) {
        expect(noteToColor(m, "pitch")).toMatch(HEX_RE);
      }
    });
  });
});
