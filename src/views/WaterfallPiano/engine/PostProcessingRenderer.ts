import * as PIXI from "pixi.js";
import type { PostProcessingConfig } from "../types";

// ─── Fragment Shaders ───

const BLOOM_FRAG = `
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

export class PostProcessingRenderer {
  private app: PIXI.Application;
  private sceneContainer: PIXI.Container;

  // Filters
  private bloomFilter: PIXI.Filter | null = null;
  private motionBlurFilter: PIXI.BlurFilter | null = null;
  private chromaticFilter: PIXI.Filter | null = null;
  private vignetteFilter: PIXI.Filter | null = null;

  private currentConfig: PostProcessingConfig | null = null;

  constructor(app: PIXI.Application, sceneContainer: PIXI.Container) {
    this.app = app;
    this.sceneContainer = sceneContainer;
  }

  applyConfig(config: PostProcessingConfig, width: number, height: number) {
    this.currentConfig = config;
    const filters: PIXI.Filter[] = [];

    // Bloom
    if (config.bloom.enabled) {
      if (!this.bloomFilter) {
        this.bloomFilter = this.createBloomFilter();
      }
      const res = (this.bloomFilter as any).resources;
      if (res?.bloomUniforms) {
        res.bloomUniforms.uniforms.uIntensity = config.bloom.intensity;
        res.bloomUniforms.uniforms.uThreshold = config.bloom.threshold;
        res.bloomUniforms.uniforms.uResolution = [width, height];
      }
      filters.push(this.bloomFilter);
    }

    // Motion blur
    if (config.motionBlur.enabled) {
      if (!this.motionBlurFilter) {
        this.motionBlurFilter = new PIXI.BlurFilter({
          strength: 0,
          quality: 3,
        });
      }
      const strength = config.motionBlur.strength * 15;
      this.motionBlurFilter.strengthX = strength * 0.3;
      this.motionBlurFilter.strengthY = strength;
      filters.push(this.motionBlurFilter as unknown as PIXI.Filter);
    } else if (this.motionBlurFilter) {
      this.motionBlurFilter.strengthX = 0;
      this.motionBlurFilter.strengthY = 0;
    }

    // Chromatic aberration
    if (config.chromaticAberration.enabled) {
      if (!this.chromaticFilter) {
        this.chromaticFilter = this.createChromaticFilter();
      }
      const res = (this.chromaticFilter as any).resources;
      if (res?.caUniforms) {
        res.caUniforms.uniforms.uIntensity = config.chromaticAberration.intensity;
        res.caUniforms.uniforms.uResolution = [width, height];
      }
      filters.push(this.chromaticFilter);
    }

    // Vignette
    if (config.vignette.enabled) {
      if (!this.vignetteFilter) {
        this.vignetteFilter = this.createVignetteFilter();
      }
      const res = (this.vignetteFilter as any).resources;
      if (res?.vigUniforms) {
        res.vigUniforms.uniforms.uIntensity = config.vignette.intensity;
        res.vigUniforms.uniforms.uRadius = config.vignette.radius;
      }
      filters.push(this.vignetteFilter);
    }

    // Apply filters to scene container
    this.sceneContainer.filters = filters.length > 0 ? filters : [];
  }

  resize(width: number, height: number) {
    if (!this.currentConfig) return;

    // Update resolution uniforms
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
  }

  private createBloomFilter(): PIXI.Filter {
    return new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: BLOOM_FRAG,
        name: "bloom-filter",
      }),
      resources: {
        bloomUniforms: new PIXI.UniformGroup({
          uIntensity: { value: 0.5, type: "f32" },
          uThreshold: { value: 0.7, type: "f32" },
          uResolution: { value: [800, 600], type: "vec2<f32>" },
        }),
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

  destroy() {
    this.sceneContainer.filters = [];
    this.bloomFilter?.destroy();
    this.motionBlurFilter?.destroy();
    this.chromaticFilter?.destroy();
    this.vignetteFilter?.destroy();
    this.bloomFilter = null;
    this.motionBlurFilter = null;
    this.chromaticFilter = null;
    this.vignetteFilter = null;
  }
}
