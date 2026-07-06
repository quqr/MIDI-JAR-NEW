import * as PIXI from "pixi.js";
import type { PostProcessingConfig } from "../types";

// ─── Fragment Shaders ───

// 单 pass bloom（7x7 核采样，快速路径）
const BLOOM_SINGLE_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uIntensity;
uniform float uThreshold;
uniform vec2 uResolution;

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    vec4 bloom = vec4(0.0);
    float total = 0.0;

    for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
            vec2 offset = vec2(x, y) / uResolution * uIntensity * 6.0;
            vec4 s = texture(uTexture, vTextureCoord + offset);
            float brightness = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
            if (brightness > uThreshold) {
                bloom += s * (brightness - uThreshold);
            }
            total += 1.0;
        }
    }
    bloom /= total;

    finalColor = color + bloom * uIntensity * 2.0;
}
`;

// 多 pass 近似 bloom（11x11 高斯加权核，更柔和、更宽泛的泛光）
// 使用高斯权重替代均匀权重，并扩大采样半径，模拟下采样/上采样的柔和效果
const BLOOM_MULTI_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uIntensity;
uniform float uThreshold;
uniform float uRadius;
uniform vec2 uResolution;

// 高斯权重（11 样本，sigma ≈ 2.5）
float gaussianWeight(float d) {
    return exp(-d * d / (2.0 * 2.5 * 2.5));
}

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    vec4 bloom = vec4(0.0);
    float totalWeight = 0.0;

    // 11x11 高斯采样
    for (float x = -5.0; x <= 5.0; x += 1.0) {
        for (float y = -5.0; y <= 5.0; y += 1.0) {
            float dist = length(vec2(x, y));
            float weight = gaussianWeight(dist);
            vec2 offset = vec2(x, y) * uRadius / uResolution;
            vec4 s = texture(uTexture, vTextureCoord + offset);
            float brightness = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
            // 亮度提取 + 软阈值（平滑过渡避免硬边）
            float contribution = smoothstep(uThreshold, uThreshold + 0.2, brightness);
            bloom += s * contribution * weight;
            totalWeight += weight;
        }
    }
    bloom /= max(totalWeight, 0.001);

    finalColor = color + bloom * uIntensity * 1.5;
}
`;

const CHROMATIC_ABERRATION_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uIntensity;
uniform vec2 uResolution;

void main() {
    vec2 center = vec2(0.5);
    vec2 dir = vTextureCoord - center;
    float dist = length(dir);
    float offset = uIntensity * dist * 0.015;

    float r = texture(uTexture, vTextureCoord + dir * offset).r;
    float g = texture(uTexture, vTextureCoord).g;
    float b = texture(uTexture, vTextureCoord - dir * offset).b;
    float a = texture(uTexture, vTextureCoord).a;

    finalColor = vec4(r, g, b, a);
}
`;

const VIGNETTE_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uIntensity;
uniform float uRadius;

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    float dist = distance(vTextureCoord, vec2(0.5));
    float vignette = smoothstep(uRadius, uRadius - 0.45, dist);
    color.rgb *= mix(1.0 - uIntensity, 1.0, vignette);
    finalColor = color;
}
`;

// 命中线 shader 泛光：保持原像素清晰，在周围添加柔和亮度溢出
const HIT_LINE_GLOW_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uIntensity;
uniform float uRadius;
uniform vec2 uResolution;

// 高斯权重
float gaussianWeight(float d) {
    return exp(-d * d / (2.0 * 3.0 * 3.0));
}

void main() {
    vec4 original = texture(uTexture, vTextureCoord);

    // 仅对有内容（alpha > 0）的区域产生溢出
    float centerAlpha = original.a;
    if (centerAlpha < 0.01 && uIntensity < 0.01) {
        finalColor = original;
        return;
    }

    vec4 glow = vec4(0.0);
    float totalWeight = 0.0;

    // 9x9 采样：在周围像素中寻找亮度，累积为泛光
    for (float x = -4.0; x <= 4.0; x += 1.0) {
        for (float y = -4.0; y <= 4.0; y += 1.0) {
            if (x == 0.0 && y == 0.0) continue;
            float dist = length(vec2(x, y));
            float weight = gaussianWeight(dist);
            vec2 offset = vec2(x, y) * uRadius / uResolution;
            vec4 s = texture(uTexture, vTextureCoord + offset);
            float brightness = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
            // 只累加有内容的像素
            glow += s * weight * brightness * s.a;
            totalWeight += weight;
        }
    }
    glow /= max(totalWeight, 0.001);

    // 原图 + 泛光（加法混合）
    finalColor = original + glow * uIntensity;
}
`;

export class PostProcessingRenderer {
  private sceneContainer: PIXI.Container;
  private noteBlockContainer: PIXI.Container;
  private hitLineContainer: PIXI.Container;

  // 滤镜实例
  private bloomFilter: PIXI.Filter | null = null;
  private bloomMultiPass = false;
  private motionBlurFilter: PIXI.BlurFilter | null = null;
  private chromaticFilter: PIXI.Filter | null = null;
  private vignetteFilter: PIXI.Filter | null = null;
  private hitLineGlowFilter: PIXI.Filter | null = null;

  private currentConfig: PostProcessingConfig | null = null;
  private degraded = false;
  private currentWidth = 800;
  private currentHeight = 600;

  constructor(
    _app: PIXI.Application,
    sceneContainer: PIXI.Container,
    noteBlockContainer: PIXI.Container,
    hitLineContainer: PIXI.Container,
  ) {
    this.sceneContainer = sceneContainer;
    this.noteBlockContainer = noteBlockContainer;
    this.hitLineContainer = hitLineContainer;
  }

  applyConfig(config: PostProcessingConfig, width: number, height: number) {
    this.currentConfig = config;
    this.currentWidth = width;
    this.currentHeight = height;

    const sceneFilters: PIXI.Filter[] = [];
    const noteBlockFilters: PIXI.Filter[] = [];
    const hitLineFilters: PIXI.Filter[] = [];

    const bloomEnabled = config.bloom.enabled && !this.degraded;
    const hitLineGlowEnabled = config.hitLineGlow.enabled && !this.degraded;

    // ─── Bloom（场景级） ───
    if (bloomEnabled) {
      // 若 multiPass 设置变化，需重建滤镜
      if (this.bloomFilter && this.bloomMultiPass !== config.bloom.multiPass) {
        this.bloomFilter.destroy();
        this.bloomFilter = null;
      }
      if (!this.bloomFilter) {
        this.bloomFilter = this.createBloomFilter(config.bloom.multiPass);
        this.bloomMultiPass = config.bloom.multiPass;
      }
      const res = (this.bloomFilter as any).resources;
      if (res?.bloomUniforms) {
        res.bloomUniforms.uniforms.uIntensity = config.bloom.intensity;
        res.bloomUniforms.uniforms.uThreshold = config.bloom.threshold;
        res.bloomUniforms.uniforms.uResolution = [width, height];
        if (config.bloom.multiPass) {
          res.bloomUniforms.uniforms.uRadius = config.bloom.radius;
        }
      }
      sceneFilters.push(this.bloomFilter);
    }

    // ─── 运动模糊 ───
    if (config.motionBlur.enabled) {
      if (!this.motionBlurFilter) {
        this.motionBlurFilter = new PIXI.BlurFilter({
          strength: 0,
          quality: 3,
        });
      }
      const degradeFactor = this.degraded ? 0.3 : 1.0;
      const strength = config.motionBlur.strength * 15 * degradeFactor;
      this.motionBlurFilter.strengthX = strength * 0.3;
      this.motionBlurFilter.strengthY = strength;

      if (config.motionBlur.layerOnly) {
        // 仅作用于音符块层，背景和命中线保持清晰
        noteBlockFilters.push(this.motionBlurFilter!);
      } else {
        // 作用于整个场景（旧行为）
        sceneFilters.push(this.motionBlurFilter!);
      }
    } else if (this.motionBlurFilter) {
      this.motionBlurFilter.strengthX = 0;
      this.motionBlurFilter.strengthY = 0;
    }

    // ─── 色差（场景级） ───
    if (config.chromaticAberration.enabled) {
      if (!this.chromaticFilter) {
        this.chromaticFilter = this.createChromaticFilter();
      }
      const res = (this.chromaticFilter as any).resources;
      if (res?.caUniforms) {
        res.caUniforms.uniforms.uIntensity =
          config.chromaticAberration.intensity;
        res.caUniforms.uniforms.uResolution = [width, height];
      }
      sceneFilters.push(this.chromaticFilter);
    }

    // ─── 暗角（场景级） ───
    if (config.vignette.enabled) {
      if (!this.vignetteFilter) {
        this.vignetteFilter = this.createVignetteFilter();
      }
      const res = (this.vignetteFilter as any).resources;
      if (res?.vigUniforms) {
        res.vigUniforms.uniforms.uIntensity = config.vignette.intensity;
        res.vigUniforms.uniforms.uRadius = config.vignette.radius;
      }
      sceneFilters.push(this.vignetteFilter);
    }

    // ─── 命中线 Shader 泛光（命中线层专用） ───
    if (hitLineGlowEnabled) {
      if (!this.hitLineGlowFilter) {
        this.hitLineGlowFilter = this.createHitLineGlowFilter();
      }
      const res = (this.hitLineGlowFilter as any).resources;
      if (res?.glowUniforms) {
        res.glowUniforms.uniforms.uIntensity = config.hitLineGlow.intensity;
        res.glowUniforms.uniforms.uRadius = config.hitLineGlow.radius;
        res.glowUniforms.uniforms.uResolution = [width, height];
      }
      hitLineFilters.push(this.hitLineGlowFilter);
    }

    // 应用滤镜到各层
    this.sceneContainer.filters = sceneFilters.length > 0 ? sceneFilters : null;
    this.noteBlockContainer.filters =
      noteBlockFilters.length > 0 ? noteBlockFilters : null;
    this.hitLineContainer.filters =
      hitLineFilters.length > 0 ? hitLineFilters : null;
  }

  resize(width: number, height: number) {
    this.currentWidth = width;
    this.currentHeight = height;
    if (!this.currentConfig) return;

    // 更新所有分辨率相关 uniform
    if (this.bloomFilter) {
      const res = (this.bloomFilter as any).resources;
      if (res?.bloomUniforms) {
        res.bloomUniforms.uniforms.uResolution = [width, height];
      }
    }
    if (this.chromaticFilter) {
      const res = (this.chromaticFilter as any).resources;
      if (res?.caUniforms) {
        res.caUniforms.uniforms.uResolution = [width, height];
      }
    }
    if (this.hitLineGlowFilter) {
      const res = (this.hitLineGlowFilter as any).resources;
      if (res?.glowUniforms) {
        res.glowUniforms.uniforms.uResolution = [width, height];
      }
    }
  }

  // ─── 自动降级 ───
  setDegradeMode(enabled: boolean) {
    if (this.degraded === enabled) return;
    this.degraded = enabled;
    // 重新应用配置（降级时会跳过 bloom 和 hitLineGlow）
    if (this.currentConfig) {
      this.applyConfig(
        this.currentConfig,
        this.currentWidth,
        this.currentHeight,
      );
    }
  }

  private createBloomFilter(multiPass: boolean): PIXI.Filter {
    const fragment = multiPass ? BLOOM_MULTI_FRAG : BLOOM_SINGLE_FRAG;
    const uniforms: Record<string, { value: unknown; type: string }> = {
      uIntensity: { value: 0.5, type: "f32" },
      uThreshold: { value: 0.7, type: "f32" },
      uResolution: { value: [800, 600], type: "vec2<f32>" },
    };
    if (multiPass) {
      uniforms.uRadius = { value: 8, type: "f32" };
    }
    return new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment,
        name: multiPass ? "bloom-filter-multi" : "bloom-filter-single",
      }),
      resources: {
        bloomUniforms: new PIXI.UniformGroup(uniforms as any),
      },
    });
  }

  private createChromaticFilter(): PIXI.Filter {
    return new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: CHROMATIC_ABERRATION_FRAG,
        name: "chromatic-aberration-filter",
      }),
      resources: {
        caUniforms: new PIXI.UniformGroup({
          uIntensity: { value: 0.3, type: "f32" },
          uResolution: { value: [800, 600], type: "vec2<f32>" },
        }),
      },
    });
  }

  private createVignetteFilter(): PIXI.Filter {
    return new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: VIGNETTE_FRAG,
        name: "vignette-filter",
      }),
      resources: {
        vigUniforms: new PIXI.UniformGroup({
          uIntensity: { value: 0.5, type: "f32" },
          uRadius: { value: 0.7, type: "f32" },
        }),
      },
    });
  }

  private createHitLineGlowFilter(): PIXI.Filter {
    return new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: HIT_LINE_GLOW_FRAG,
        name: "hit-line-glow-filter",
      }),
      resources: {
        glowUniforms: new PIXI.UniformGroup({
          uIntensity: { value: 0.8, type: "f32" },
          uRadius: { value: 15, type: "f32" },
          uResolution: { value: [800, 600], type: "vec2<f32>" },
        }),
      },
    });
  }

  destroy() {
    this.sceneContainer.filters = null;
    this.noteBlockContainer.filters = null;
    this.hitLineContainer.filters = null;
    this.bloomFilter?.destroy();
    this.motionBlurFilter?.destroy();
    this.chromaticFilter?.destroy();
    this.vignetteFilter?.destroy();
    this.hitLineGlowFilter?.destroy();
    this.bloomFilter = null;
    this.motionBlurFilter = null;
    this.chromaticFilter = null;
    this.vignetteFilter = null;
    this.hitLineGlowFilter = null;
  }
}
