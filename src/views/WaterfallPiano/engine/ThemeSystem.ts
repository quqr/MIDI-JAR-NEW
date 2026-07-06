import {
  visualThemePresets,
  particlePresets,
  defaultStyleParameters,
} from "../constants";
import type {
  VisualThemeId,
  ParticlePresetId,
  StyleParameters,
  ThemePreset,
  WaterfallPianoSettings,
  PostProcessingConfig,
  NoteBlockParticleConfig,
} from "../types";

// ─── 主题系统：一键切换视觉配置、风格参数联动、JSON 导入导出 ───

export class ThemeSystem {
  /**
   * 应用视觉主题预设：将预设的部分覆盖合并到当前设置
   */
  applyTheme(
    themeId: VisualThemeId,
    current: WaterfallPianoSettings,
  ): WaterfallPianoSettings {
    const preset = visualThemePresets[themeId];
    if (!preset) return current;

    const next: WaterfallPianoSettings = {
      ...current,
      particles: {
        ...current.particles,
        ...preset.particles,
        hitLine: {
          ...current.particles.hitLine,
          ...preset.particles.hitLine,
        },
      },
      background: {
        ...current.background,
        ...preset.background,
      },
      postProcessing: this.mergePostProcessing(
        current.postProcessing,
        preset.postProcessing,
      ),
      noteTexture: {
        ...current.noteTexture,
        ...preset.noteTexture,
      },
      noteBlockParticles: {
        ...current.noteBlockParticles,
        ...preset.noteBlockParticles,
      },
      theme: {
        current: themeId,
        styleParameters: { ...preset.styleParameters },
      },
    };

    // 应用风格参数联动
    return this.applyStyleParameters(preset.styleParameters, next);
  }

  /**
   * 应用粒子效果预设
   */
  applyParticlePreset(
    presetId: ParticlePresetId,
    current: WaterfallPianoSettings,
  ): WaterfallPianoSettings {
    const preset = particlePresets[presetId];
    if (!preset) return current;

    const overrides = preset.overrides;
    return {
      ...current,
      particles: {
        ...current.particles,
        ...overrides,
        // 深度合并嵌套配置
        trailParticle: {
          ...current.particles.trailParticle,
          ...overrides.trailParticle,
        },
        hitParticle: {
          ...current.particles.hitParticle,
          ...overrides.hitParticle,
        },
      },
    };
  }

  /**
   * 应用风格参数：将滑块值映射到底层视觉参数
   *
   * 映射关系：
   * - ambianceIntensity → 粒子密度、发光强度、背景流动速度
   * - particleDensity → 粒子 density
   * - burstForce → 命中爆炸 count/speed
   * - floatSense → 粒子拖尾 lifetime/spreadAngle
   * - glowIntensity → bloom intensity、activeGlow
   * - colorTemperature → 颜色色温偏移（0=冷，1=暖）
   */
  applyStyleParameters(
    params: StyleParameters,
    current: WaterfallPianoSettings,
  ): WaterfallPianoSettings {
    const next: WaterfallPianoSettings = {
      ...current,
      particles: { ...current.particles },
      background: { ...current.background },
      postProcessing: { ...current.postProcessing },
    };

    // ─── ambianceIntensity: 氛围强度 ───
    // 影响粒子密度、发光强度、背景流动速度
    next.particles.density = Math.round(
      this.lerp(2, 10, params.ambianceIntensity),
    );
    next.background.flowSpeed = this.lerp(0.3, 2.5, params.ambianceIntensity);

    // ─── particleDensity: 粒子浓度 ───
    // 影响拖尾和命中爆炸的粒子数量
    next.particles.trailParticle = {
      ...next.particles.trailParticle,
      lifetime: Math.round(this.lerp(15, 50, params.particleDensity)),
    };
    next.particles.hitParticle = {
      ...next.particles.hitParticle,
      count: Math.round(this.lerp(4, 20, params.particleDensity)),
    };

    // ─── burstForce: 爆发力度 ───
    // 影响命中爆炸速度
    next.particles.hitParticle = {
      ...next.particles.hitParticle,
      speed: this.lerp(1.5, 7, params.burstForce),
    };

    // ─── floatSense: 漂浮感 ───
    // 影响拖尾粒子的 spreadAngle 和 turbulence
    next.particles.trailParticle = {
      ...next.particles.trailParticle,
      spreadAngle: this.lerp(10, 70, params.floatSense),
      turbulence: params.floatSense,
    };

    // ─── glowIntensity: 光芒强度 ───
    // 影响 bloom 强度、活跃音符发光、命中线发光
    next.postProcessing.bloom = {
      ...next.postProcessing.bloom,
      intensity: this.lerp(0.2, 1.0, params.glowIntensity),
    };
    next.particles.noteBlock = {
      ...next.particles.noteBlock,
      activeGlow: params.glowIntensity > 0.2,
      activeGlowRadius: Math.round(this.lerp(4, 16, params.glowIntensity)),
    };
    next.postProcessing.hitLineGlow = {
      ...next.postProcessing.hitLineGlow,
      intensity: this.lerp(0.3, 1.2, params.glowIntensity),
    };

    // ─── colorTemperature: 颜色温度 ───
    // 0=冷色（蓝/青），1=暖色（红/橙）
    // 通过调整 customColors 来实现色温偏移
    next.particles.customColors = {
      low: this.temperatureColor(params.colorTemperature, "low"),
      mid: this.temperatureColor(params.colorTemperature, "mid"),
      high: this.temperatureColor(params.colorTemperature, "high"),
    };

    // 更新 theme.styleParameters
    next.theme = {
      ...current.theme,
      styleParameters: { ...params },
    };

    return next;
  }

  /**
   * 导出当前设置为 ThemePreset JSON
   */
  exportTheme(name: string, current: WaterfallPianoSettings): ThemePreset {
    return {
      id: current.theme.current,
      name,
      particles: { ...current.particles },
      background: { ...current.background },
      postProcessing: this.clonePostProcessing(current.postProcessing),
      noteTexture: { ...current.noteTexture },
      noteBlockParticles: this.cloneNoteBlockParticles(
        current.noteBlockParticles,
      ),
      styleParameters: { ...current.theme.styleParameters },
    };
  }

  /**
   * 导入 ThemePreset JSON 并应用到当前设置
   */
  importTheme(
    preset: ThemePreset,
    current: WaterfallPianoSettings,
  ): WaterfallPianoSettings {
    // 验证 preset 结构
    if (!this.validateThemePreset(preset)) {
      throw new Error("Invalid theme preset structure");
    }

    const next: WaterfallPianoSettings = {
      ...current,
      particles: {
        ...current.particles,
        ...preset.particles,
        hitLine: {
          ...current.particles.hitLine,
          ...preset.particles.hitLine,
        },
        noteBlock: {
          ...current.particles.noteBlock,
          ...preset.particles.noteBlock,
        },
        trailParticle: {
          ...current.particles.trailParticle,
          ...preset.particles.trailParticle,
        },
        hitParticle: {
          ...current.particles.hitParticle,
          ...preset.particles.hitParticle,
        },
        physics: {
          ...current.particles.physics,
          ...preset.particles.physics,
        },
        customColors: {
          ...current.particles.customColors,
          ...preset.particles.customColors,
        },
      },
      background: {
        ...current.background,
        ...preset.background,
      },
      postProcessing: this.mergePostProcessing(
        current.postProcessing,
        preset.postProcessing,
      ),
      noteTexture: {
        ...current.noteTexture,
        ...preset.noteTexture,
      },
      noteBlockParticles: this.cloneNoteBlockParticles(
        preset.noteBlockParticles,
      ),
      theme: {
        current: preset.id,
        styleParameters: { ...preset.styleParameters },
      },
    };

    return next;
  }

  /**
   * 将 ThemePreset 序列化为 JSON 字符串
   */
  serializeTheme(preset: ThemePreset): string {
    return JSON.stringify(preset, null, 2);
  }

  /**
   * 从 JSON 字符串反序列化 ThemePreset
   */
  deserializeTheme(json: string): ThemePreset {
    const parsed = JSON.parse(json);
    if (!this.validateThemePreset(parsed)) {
      throw new Error("Invalid theme preset JSON");
    }
    return parsed as ThemePreset;
  }

  /**
   * 获取所有可用主题预设列表
   */
  getAvailableThemes(): Array<{
    id: VisualThemeId;
    labelKey: string;
    description: string;
  }> {
    return Object.values(visualThemePresets).map((p) => ({
      id: p.id,
      labelKey: p.labelKey,
      description: p.description,
    }));
  }

  /**
   * 获取所有可用粒子预设列表
   */
  getAvailableParticlePresets(): Array<{
    id: ParticlePresetId;
    labelKey: string;
  }> {
    return Object.values(particlePresets).map((p) => ({
      id: p.id,
      labelKey: p.labelKey,
    }));
  }

  /**
   * 重置风格参数为默认值
   */
  resetStyleParameters(): StyleParameters {
    return { ...defaultStyleParameters };
  }

  // ─── 私有辅助方法 ───

  private lerp(a: number, b: number, t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return a + (b - a) * clamped;
  }

  private mergePostProcessing(
    base: PostProcessingConfig,
    override: Partial<PostProcessingConfig>,
  ): PostProcessingConfig {
    return {
      bloom: { ...base.bloom, ...override.bloom },
      motionBlur: { ...base.motionBlur, ...override.motionBlur },
      chromaticAberration: {
        ...base.chromaticAberration,
        ...override.chromaticAberration,
      },
      vignette: { ...base.vignette, ...override.vignette },
      hitLineGlow: { ...base.hitLineGlow, ...override.hitLineGlow },
    };
  }

  private clonePostProcessing(
    config: PostProcessingConfig,
  ): PostProcessingConfig {
    return {
      bloom: { ...config.bloom },
      motionBlur: { ...config.motionBlur },
      chromaticAberration: { ...config.chromaticAberration },
      vignette: { ...config.vignette },
      hitLineGlow: { ...config.hitLineGlow },
    };
  }

  private cloneNoteBlockParticles(
    config: NoteBlockParticleConfig,
  ): NoteBlockParticleConfig {
    return {
      surfaceEmission: { ...config.surfaceEmission },
      hitExplosion: { ...config.hitExplosion },
      orbiting: { ...config.orbiting },
    };
  }

  /**
   * 根据色温生成颜色
   * colorTemperature: 0=冷色, 1=暖色
   */
  private temperatureColor(
    temperature: number,
    range: "low" | "mid" | "high",
  ): string {
    // 冷色端（temperature=0）: 蓝/青
    // 暖色端（temperature=1）: 红/橙
    const cool = {
      low: { r: 30, g: 60, b: 180 }, // 深蓝
      mid: { r: 20, g: 184, b: 166 }, // 青绿
      high: { r: 99, g: 179, b: 237 }, // 浅蓝
    };
    const warm = {
      low: { r: 180, g: 50, b: 30 }, // 深红
      mid: { r: 245, g: 158, b: 11 }, // 橙
      high: { r: 254, g: 215, b: 170 }, // 浅橙
    };

    const c = cool[range];
    const w = warm[range];
    const r = Math.round(this.lerp(c.r, w.r, temperature));
    const g = Math.round(this.lerp(c.g, w.g, temperature));
    const b = Math.round(this.lerp(c.b, w.b, temperature));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  /**
   * 验证 ThemePreset 结构完整性
   */
  private validateThemePreset(preset: unknown): preset is ThemePreset {
    if (!preset || typeof preset !== "object") return false;
    const p = preset as Record<string, unknown>;
    return (
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.particles === "object" &&
      typeof p.background === "object" &&
      typeof p.postProcessing === "object" &&
      typeof p.noteTexture === "object" &&
      typeof p.noteBlockParticles === "object" &&
      typeof p.styleParameters === "object"
    );
  }
}
