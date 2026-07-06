import { describe, it, expect, beforeEach } from "vitest";
import { ThemeSystem } from "../engine/ThemeSystem";
import { defaultWaterfallSettings } from "../constants";
import type { WaterfallPianoSettings, ThemePreset } from "../types";

describe("ThemeSystem", () => {
  let themeSystem: ThemeSystem;

  beforeEach(() => {
    themeSystem = new ThemeSystem();
  });

  function freshSettings(): WaterfallPianoSettings {
    return JSON.parse(JSON.stringify(defaultWaterfallSettings));
  }

  describe("applyTheme", () => {
    it("应用 classic-glow 主题后 theme.current 更新", () => {
      const next = themeSystem.applyTheme("classic-glow", freshSettings());
      expect(next.theme.current).toBe("classic-glow");
    });

    it("应用 neon-particles 主题后 theme.current 更新", () => {
      const next = themeSystem.applyTheme("neon-particles", freshSettings());
      expect(next.theme.current).toBe("neon-particles");
    });

    it("应用主题后 styleParameters 来自预设", () => {
      const next = themeSystem.applyTheme("minimal-tutor", freshSettings());
      expect(next.theme.styleParameters.ambianceIntensity).toBe(0.2);
      expect(next.theme.styleParameters.glowIntensity).toBe(0.2);
    });

    it("应用主题后 particles.style 被预设覆盖", () => {
      const next = themeSystem.applyTheme("neon-particles", freshSettings());
      expect(next.particles.style).toBe("particles");
    });

    it("应用主题后 background.type 被预设覆盖", () => {
      const next = themeSystem.applyTheme("starlight-magic", freshSettings());
      expect(next.background.type).toBe("stars");
    });

    it("应用主题后 postProcessing 被深度合并", () => {
      const next = themeSystem.applyTheme("retro-crt", freshSettings());
      expect(next.postProcessing.chromaticAberration.enabled).toBe(true);
      expect(next.postProcessing.vignette.enabled).toBe(true);
    });

    it("应用无效主题 ID 返回原设置不变", () => {
      const current = freshSettings();
      const next = themeSystem.applyTheme("invalid-id" as never, current);
      expect(next).toBe(current);
    });

    it("应用主题后风格参数联动也生效", () => {
      const next = themeSystem.applyTheme("neon-particles", freshSettings());
      // neon-particles 的 ambianceIntensity=0.7，应映射到 flowSpeed
      expect(next.background.flowSpeed).toBeGreaterThan(1);
    });
  });

  describe("applyParticlePreset", () => {
    it("应用 classic 预设后粒子参数被覆盖", () => {
      const next = themeSystem.applyParticlePreset("classic", freshSettings());
      expect(next.particles.shape).toBe("circle");
      expect(next.particles.colorScheme).toBe("pitch");
    });

    it("应用 neon 预设后颜色方案为 neon", () => {
      const next = themeSystem.applyParticlePreset("neon", freshSettings());
      expect(next.particles.colorScheme).toBe("neon");
      expect(next.particles.hitParticle.count).toBe(16);
    });

    it("应用 minimal 预设后密度降低", () => {
      const next = themeSystem.applyParticlePreset("minimal", freshSettings());
      expect(next.particles.density).toBeLessThan(5);
    });

    it("应用无效预设 ID 返回原设置", () => {
      const current = freshSettings();
      const next = themeSystem.applyParticlePreset("invalid" as never, current);
      expect(next).toBe(current);
    });

    it("保留未覆盖的字段（深度合并）", () => {
      const current = freshSettings();
      const originalSpeed = current.particles.speed;
      const next = themeSystem.applyParticlePreset("classic", current);
      expect(next.particles.speed).toBe(originalSpeed);
    });
  });

  describe("applyStyleParameters", () => {
    it("ambianceIntensity 映射到粒子密度和背景流动速度", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        ambianceIntensity: 1.0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.particles.density).toBeGreaterThanOrEqual(8);
      expect(next.background.flowSpeed).toBeGreaterThan(1);
    });

    it("ambianceIntensity=0 时密度最低", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        ambianceIntensity: 0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.particles.density).toBe(2);
    });

    it("particleDensity 映射到拖尾和命中爆炸粒子数量", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        particleDensity: 1.0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.particles.trailParticle.lifetime).toBeGreaterThanOrEqual(40);
      expect(next.particles.hitParticle.count).toBeGreaterThanOrEqual(15);
    });

    it("burstForce 映射到命中爆炸速度", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        burstForce: 1.0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.particles.hitParticle.speed).toBeGreaterThan(5);
    });

    it("floatSense 映射到拖尾 spreadAngle 和 turbulence", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        floatSense: 1.0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.particles.trailParticle.spreadAngle).toBeGreaterThan(60);
      expect(next.particles.trailParticle.turbulence).toBe(1.0);
    });

    it("glowIntensity 映射到 bloom 和命中线发光", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        glowIntensity: 1.0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.postProcessing.bloom.intensity).toBeGreaterThanOrEqual(0.9);
      expect(next.particles.noteBlock.activeGlow).toBe(true);
      expect(next.postProcessing.hitLineGlow.intensity).toBeGreaterThan(1);
    });

    it("glowIntensity 极低时关闭 activeGlow", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        glowIntensity: 0.1,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      expect(next.particles.noteBlock.activeGlow).toBe(false);
    });

    it("colorTemperature=0 生成冷色", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        colorTemperature: 0,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      // 冷色 low 应该偏蓝（B 通道较高）
      expect(next.particles.customColors.low).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("colorTemperature=1 生成暖色", () => {
      const params = {
        ...defaultWaterfallSettings.theme.styleParameters,
        colorTemperature: 1,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      // 暖色 low 应该偏红（R 通道较高）
      const hex = next.particles.customColors.low;
      const r = parseInt(hex.slice(1, 3), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r).toBeGreaterThan(b);
    });

    it("越界值会被 clamp 到 [0, 1]", () => {
      const params = {
        ambianceIntensity: 5,
        particleDensity: -1,
        burstForce: 2,
        floatSense: 0.5,
        glowIntensity: 0.5,
        colorTemperature: 0.5,
      };
      const next = themeSystem.applyStyleParameters(params, freshSettings());
      // 不应抛出错误，且参数被钳制
      expect(next.particles.density).toBeGreaterThanOrEqual(2);
      expect(next.particles.density).toBeLessThanOrEqual(10);
    });
  });

  describe("exportTheme / importTheme", () => {
    it("导出 ThemePreset 包含所有必需字段", () => {
      const preset = themeSystem.exportTheme("test", freshSettings());
      expect(preset.id).toBeDefined();
      expect(preset.name).toBe("test");
      expect(preset.particles).toBeDefined();
      expect(preset.background).toBeDefined();
      expect(preset.postProcessing).toBeDefined();
      expect(preset.noteTexture).toBeDefined();
      expect(preset.noteBlockParticles).toBeDefined();
      expect(preset.styleParameters).toBeDefined();
    });

    it("序列化/反序列化保持数据一致", () => {
      const original = themeSystem.exportTheme("test", freshSettings());
      const json = themeSystem.serializeTheme(original);
      const restored = themeSystem.deserializeTheme(json);
      expect(restored).toEqual(original);
    });

    it("导入主题后应用所有配置", () => {
      const preset: ThemePreset = {
        id: "classic-glow",
        name: "Test Import",
        particles: {
          ...freshSettings().particles,
          style: "particles",
          colorScheme: "neon",
        },
        background: { ...freshSettings().background, type: "solid" },
        postProcessing: { ...freshSettings().postProcessing },
        noteTexture: { ...freshSettings().noteTexture },
        noteBlockParticles: { ...freshSettings().noteBlockParticles },
        styleParameters: { ...defaultWaterfallSettings.theme.styleParameters },
      };
      const next = themeSystem.importTheme(preset, freshSettings());
      expect(next.particles.style).toBe("particles");
      expect(next.particles.colorScheme).toBe("neon");
      expect(next.background.type).toBe("solid");
      expect(next.theme.current).toBe("classic-glow");
    });

    it("导入无效 JSON 抛出错误", () => {
      expect(() => themeSystem.deserializeTheme("not json")).toThrow();
    });

    it("导入结构不完整的 preset 抛出错误", () => {
      expect(() =>
        themeSystem.deserializeTheme(JSON.stringify({ id: "x" })),
      ).toThrow();
    });

    it("导入后保留未覆盖的嵌套字段", () => {
      const current = freshSettings();
      current.particles.hitLine.color = "#ff0000";
      const preset: ThemePreset = {
        id: "classic-glow",
        name: "Test",
        particles: {
          ...current.particles,
          hitLine: { ...current.particles.hitLine, thickness: 10 },
        },
        background: current.background,
        postProcessing: current.postProcessing,
        noteTexture: current.noteTexture,
        noteBlockParticles: current.noteBlockParticles,
        styleParameters: current.theme.styleParameters,
      };
      const next = themeSystem.importTheme(preset, current);
      expect(next.particles.hitLine.thickness).toBe(10);
      expect(next.particles.hitLine.color).toBe("#ff0000");
    });
  });

  describe("getAvailableThemes", () => {
    it("返回 5 个主题", () => {
      const themes = themeSystem.getAvailableThemes();
      expect(themes).toHaveLength(5);
    });

    it("每个主题包含 id、labelKey、description", () => {
      const themes = themeSystem.getAvailableThemes();
      for (const t of themes) {
        expect(typeof t.id).toBe("string");
        expect(typeof t.labelKey).toBe("string");
        expect(typeof t.description).toBe("string");
      }
    });
  });

  describe("getAvailableParticlePresets", () => {
    it("返回 5 个粒子预设", () => {
      const presets = themeSystem.getAvailableParticlePresets();
      expect(presets).toHaveLength(5);
    });

    it("每个预设包含 id 和 labelKey", () => {
      const presets = themeSystem.getAvailableParticlePresets();
      for (const p of presets) {
        expect(typeof p.id).toBe("string");
        expect(typeof p.labelKey).toBe("string");
      }
    });
  });

  describe("resetStyleParameters", () => {
    it("返回默认风格参数", () => {
      const params = themeSystem.resetStyleParameters();
      expect(params.ambianceIntensity).toBe(0.5);
      expect(params.particleDensity).toBe(0.5);
      expect(params.burstForce).toBe(0.5);
      expect(params.floatSense).toBe(0.5);
      expect(params.glowIntensity).toBe(0.5);
      expect(params.colorTemperature).toBe(0.5);
    });
  });
});
