import { describe, it, expect } from "vitest";
import {
  defaultWaterfallSettings,
  defaultStyleParameters,
  visualThemePresets,
  particlePresets,
  presetThemes,
  audioPresets,
} from "../constants";
import type {
  WaterfallPianoSettings,
  VisualThemeId,
  ParticlePresetId,
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
        "midiFile",
        "postProcessing",
        "noteTexture",
        "noteBlockParticles",
        "performance",
        "theme",
      ];
      for (const key of requiredKeys) {
        expect(defaultWaterfallSettings).toHaveProperty(key);
      }
    });

    it("particles 配置完整且类型正确", () => {
      const p = defaultWaterfallSettings.particles;
      expect(typeof p.style).toBe("string");
      expect(typeof p.speed).toBe("number");
      expect(p.speed).toBeGreaterThan(0);
      expect(p.opacity).toBeGreaterThan(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
      expect(p.cornerRadius).toBeGreaterThanOrEqual(0);
      expect(p.hitLine).toBeDefined();
      expect(p.noteBlock).toBeDefined();
      expect(p.trailParticle).toBeDefined();
      expect(p.hitParticle).toBeDefined();
      expect(p.physics).toBeDefined();
    });

    it("postProcessing 配置包含所有子项", () => {
      const pp = defaultWaterfallSettings.postProcessing;
      expect(pp.bloom).toBeDefined();
      expect(pp.motionBlur).toBeDefined();
      expect(pp.chromaticAberration).toBeDefined();
      expect(pp.vignette).toBeDefined();
      expect(pp.hitLineGlow).toBeDefined();
      expect(typeof pp.bloom.intensity).toBe("number");
      expect(typeof pp.bloom.multiPass).toBe("boolean");
      expect(typeof pp.motionBlur.layerOnly).toBe("boolean");
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

    it("performance 配置合理", () => {
      const perf = defaultWaterfallSettings.performance;
      expect(perf.particleHardLimit).toBeGreaterThan(0);
      expect(perf.particleHardLimit).toBeLessThanOrEqual(2000);
      expect(perf.minFps).toBeGreaterThan(0);
      expect(perf.minFps).toBeLessThanOrEqual(perf.targetFps);
    });

    it("theme 配置包含 current 和 styleParameters", () => {
      const theme = defaultWaterfallSettings.theme;
      expect(theme.current).toBeDefined();
      expect(theme.styleParameters).toBeDefined();
      const params = theme.styleParameters;
      const paramKeys: (keyof typeof params)[] = [
        "ambianceIntensity",
        "particleDensity",
        "burstForce",
        "floatSense",
        "glowIntensity",
        "colorTemperature",
      ];
      for (const key of paramKeys) {
        expect(typeof params[key]).toBe("number");
        expect(params[key]).toBeGreaterThanOrEqual(0);
        expect(params[key]).toBeLessThanOrEqual(1);
      }
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
  });

  describe("defaultStyleParameters", () => {
    it("所有参数默认为 0.5（中间值）", () => {
      expect(defaultStyleParameters.ambianceIntensity).toBe(0.5);
      expect(defaultStyleParameters.particleDensity).toBe(0.5);
      expect(defaultStyleParameters.burstForce).toBe(0.5);
      expect(defaultStyleParameters.floatSense).toBe(0.5);
      expect(defaultStyleParameters.glowIntensity).toBe(0.5);
      expect(defaultStyleParameters.colorTemperature).toBe(0.5);
    });
  });

  describe("visualThemePresets", () => {
    const expectedIds: VisualThemeId[] = [
      "classic-glow",
      "neon-particles",
      "minimal-tutor",
      "starlight-magic",
      "retro-crt",
    ];

    it("包含 5 个预设主题", () => {
      for (const id of expectedIds) {
        expect(visualThemePresets).toHaveProperty(id);
      }
    });

    it("每个主题包含必需字段", () => {
      for (const id of expectedIds) {
        const theme = visualThemePresets[id];
        expect(theme.id).toBe(id);
        expect(typeof theme.labelKey).toBe("string");
        expect(typeof theme.description).toBe("string");
        expect(typeof theme.particles).toBe("object");
        expect(typeof theme.background).toBe("object");
        expect(typeof theme.postProcessing).toBe("object");
        expect(typeof theme.styleParameters).toBe("object");
      }
    });

    it("每个主题的 styleParameters 字段完整", () => {
      for (const id of expectedIds) {
        const params = visualThemePresets[id].styleParameters;
        expect(params).toHaveProperty("ambianceIntensity");
        expect(params).toHaveProperty("particleDensity");
        expect(params).toHaveProperty("burstForce");
        expect(params).toHaveProperty("floatSense");
        expect(params).toHaveProperty("glowIntensity");
        expect(params).toHaveProperty("colorTemperature");
      }
    });
  });

  describe("particlePresets", () => {
    const expectedIds: ParticlePresetId[] = [
      "classic",
      "neon",
      "minimal",
      "starlight",
      "retro-crt",
    ];

    it("包含 5 个粒子预设", () => {
      for (const id of expectedIds) {
        expect(particlePresets).toHaveProperty(id);
      }
    });

    it("每个预设包含完整粒子参数", () => {
      for (const id of expectedIds) {
        const preset = particlePresets[id];
        expect(preset.id).toBe(id);
        expect(typeof preset.labelKey).toBe("string");
        const o = preset.overrides;
        expect(o).toBeDefined();
        if (o.trailParticle) {
          expect(o.trailParticle).toHaveProperty("size");
          expect(o.trailParticle).toHaveProperty("lifetime");
          expect(o.trailParticle).toHaveProperty("turbulence");
        }
        if (o.hitParticle) {
          expect(o.hitParticle).toHaveProperty("count");
          expect(o.hitParticle).toHaveProperty("speed");
          expect(o.hitParticle).toHaveProperty("lifetime");
        }
      }
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
    ];

    it("包含 6 个音色预设", () => {
      for (const id of expectedIds) {
        expect(audioPresets).toHaveProperty(id);
      }
    });
  });
});
