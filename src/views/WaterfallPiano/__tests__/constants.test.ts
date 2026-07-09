import { describe, it, expect } from "vitest";
import {
  defaultWaterfallSettings,
  presetThemes,
  audioPresets,
} from "../constants";
import type {
  WaterfallPianoSettings,
  PresetTheme,
  AudioPreset,
} from "../types";

describe("constants", () => {
  describe("defaultWaterfallSettings", () => {
    it("包含所有顶级配置字段", () => {
      const requiredKeys: (keyof WaterfallPianoSettings)[] = [
        "particles",
        "background",
        "keyboard",
        "audio",
        "physicalPiano",
        "midiFile",
      ];
      for (const key of requiredKeys) {
        expect(defaultWaterfallSettings).toHaveProperty(key);
      }
    });

    it("particles 配置完整且类型正确", () => {
      const p = defaultWaterfallSettings.particles;
      expect(typeof p.colorScheme).toBe("string");
      expect(p.customColors).toBeDefined();
      expect(typeof p.speed).toBe("number");
      expect(p.speed).toBeGreaterThan(0);
      expect(typeof p.lookAhead).toBe("number");
      expect(p.lookAhead).toBeGreaterThan(0);
      expect(p.opacity).toBeGreaterThan(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
      expect(p.cornerRadius).toBeGreaterThanOrEqual(0);
      expect(p.hitLine).toBeDefined();
    });

    it("background 配置包含新增字段", () => {
      const b = defaultWaterfallSettings.background;
      expect(typeof b.starfieldEnabled).toBe("boolean");
      expect(typeof b.starfieldDensity).toBe("number");
      expect(typeof b.fluidEnabled).toBe("boolean");
      expect(typeof b.fluidResolution).toBe("number");
      expect(typeof b.flowAnimation).toBe("boolean");
      expect(typeof b.flowSpeed).toBe("number");
      expect(b.starfieldDensity).toBeGreaterThanOrEqual(0);
      expect(b.starfieldDensity).toBeLessThanOrEqual(1);
      expect(b.fluidResolution).toBeGreaterThan(0);
      expect(b.fluidResolution).toBeLessThanOrEqual(1);
    });

    it("keyboard 配置包含五线谱、流动方向、音名字段", () => {
      const k = defaultWaterfallSettings.keyboard;
      expect(typeof k.staffVisible).toBe("boolean");
      expect(
        k.synthesiaFlowDirection === "up" ||
          k.synthesiaFlowDirection === "down",
      ).toBe(true);
      expect(typeof k.showNoteNames).toBe("boolean");
    });

    // ─── 新增测试：fluidParams 边界 ───
    it("background.fluidParams 默认值为空对象（无覆盖）", () => {
      const fluidParams = defaultWaterfallSettings.background.fluidParams;
      expect(fluidParams).toBeDefined();
      expect(typeof fluidParams).toBe("object");
    });
  });

  describe("presetThemes", () => {
    const expectedIds: PresetTheme[] = [
      "night-sky",
      "ocean",
      "sunset",
      "aurora",
      "forest",
    ];

    it("包含 5 个预设背景主题", () => {
      for (const id of expectedIds) {
        expect(presetThemes).toHaveProperty(id);
      }
    });

    it("每个主题包含至少 2 个渐变停靠点", () => {
      for (const id of expectedIds) {
        const theme = presetThemes[id];
        expect(theme.stops.length).toBeGreaterThanOrEqual(2);
        for (const stop of theme.stops) {
          expect(typeof stop.position).toBe("number");
          expect(stop.position).toBeGreaterThanOrEqual(0);
          expect(stop.position).toBeLessThanOrEqual(1);
          expect(typeof stop.color).toBe("string");
          expect(stop.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    });
  });

  describe("audioPresets", () => {
    const expectedIds: AudioPreset[] = [
      "grand-piano",
      "electric-piano",
      "bright-piano",
      "mellow-piano",
      "organ",
      "synth-pad",
      "physical-piano",
    ];

    it("包含 7 个音色预设", () => {
      for (const id of expectedIds) {
        expect(audioPresets).toHaveProperty(id);
      }
    });
  });
});