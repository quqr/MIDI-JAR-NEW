// ─── PixiJS Bloom 后处理 pass：prefilter → 多级下采样模糊 → 上采样合成 → final ───
// 将原生 WebGL BloomPass 迁移为 PixiJS Filter + RenderTexture 管线

import { Filter, UniformGroup, RenderTexture } from 'pixi.js';
import type { TEXTURE_FORMATS } from 'pixi.js';
import { PixiFluidContext } from './PixiFluidContext';
import { defaultFilterVertex, bloomPrefilterShader, bloomBlurShader, bloomFinalShader } from './shaders';
import type { FluidSimulationConfig } from '../fluid/FluidConfig';

/**
 * 根据短边分辨率和画布宽高比，计算实际纹理尺寸
 */
function getResolution(
  canvasWidth: number,
  canvasHeight: number,
  resolution: number,
): { width: number; height: number } {
  let aspectRatio = canvasWidth / canvasHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);

  if (canvasWidth > canvasHeight) return { width: max, height: min };
  return { width: min, height: max };
}

/**
 * PixiJS Bloom 后处理 pass
 *
 * 管线：
 * 1. prefilter：提取亮度超过阈值的部分
 * 2. 下采样模糊：逐级缩小并模糊
 * 3. 上采样合成：从最小级别反向累加
 * 4. final：4邻域平均 × 强度
 */
export class PixiBloomPass {
  private ctx: PixiFluidContext;
  private config: FluidSimulationConfig;

  // Bloom 专用 Filter
  private prefilterFilter: Filter;
  private blurFilter: Filter;
  private finalFilter: Filter;

  // Bloom RenderTexture
  private bloomRT: RenderTexture | null = null;
  private bloomFBOs: RenderTexture[] = [];

  constructor(ctx: PixiFluidContext, config: FluidSimulationConfig) {
    this.ctx = ctx;
    this.config = config;

    this.prefilterFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: bloomPrefilterShader },
      resources: {
        bloomUniforms: new UniformGroup({
          curve: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' },
          threshold: { value: 0.6, type: 'f32' },
        }),
      },
    });

    this.blurFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: bloomBlurShader },
      resources: {
        bloomUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
        }),
      },
    });

    this.finalFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: bloomFinalShader },
      resources: {
        bloomUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          intensity: { value: 0.8, type: 'f32' },
        }),
      },
    });
  }

  /** 初始化 Bloom RenderTexture */
  initFramebuffers(): void {
    const app = this.ctx.application;
    const res = getResolution(app.screen.width, app.screen.height, this.config.BLOOM_RESOLUTION);

    this.destroyFramebuffers();

    this.bloomRT = this.ctx.createRT(res.width, res.height, 'rgba16float' as TEXTURE_FORMATS, 'linear');

    this.bloomFBOs = [];
    for (let i = 0; i < this.config.BLOOM_ITERATIONS; i++) {
      const width = res.width >> (i + 1);
      const height = res.height >> (i + 1);
      if (width < 2 || height < 2) break;
      this.bloomFBOs.push(this.ctx.createRT(width, height, 'rgba16float' as TEXTURE_FORMATS, 'linear'));
    }
  }

  /**
   * 执行 Bloom 后处理
   * @param source - 输入染料场 RenderTexture
   * @param destination - 输出 bloom 结果 RenderTexture
   */
  apply(source: RenderTexture, destination: RenderTexture): void {
    if (this.bloomFBOs.length < 2 || !this.bloomRT) return;

    const config = this.config;

    // 1. prefilter：提取高亮区域
    const knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
    const curve0 = config.BLOOM_THRESHOLD - knee;
    const curve1 = knee * 2;
    const curve2 = 0.25 / knee;

    const preU = this.prefilterFilter.resources.bloomUniforms.uniforms;
    preU.curve = [curve0, curve1, curve2];
    preU.threshold = config.BLOOM_THRESHOLD;
    this.ctx.applyPass(this.prefilterFilter, source, destination);

    // 2. 下采样模糊：destination → 各级 bloomFBOs
    const blurU = this.blurFilter.resources.bloomUniforms.uniforms;
    let last: RenderTexture = destination;
    for (let i = 0; i < this.bloomFBOs.length; i++) {
      const dest = this.bloomFBOs[i];
      blurU.texelSize = [1.0 / last.width, 1.0 / last.height];
      this.ctx.applyPass(this.blurFilter, last, dest);
      last = dest;
    }

    // 3. 上采样合成：从最小级别反向累加（使用 additive blend 模拟）
    for (let i = this.bloomFBOs.length - 2; i >= 0; i--) {
      const baseTex = this.bloomFBOs[i];
      blurU.texelSize = [1.0 / last.width, 1.0 / last.height];
      this.ctx.applyPass(this.blurFilter, last, baseTex);
      last = baseTex;
    }

    // 4. final 合成
    const finalU = this.finalFilter.resources.bloomUniforms.uniforms;
    finalU.texelSize = [1.0 / last.width, 1.0 / last.height];
    finalU.intensity = config.BLOOM_INTENSITY;
    this.ctx.applyPass(this.finalFilter, last, destination);
  }

  /** 获取 bloom 输出纹理 */
  getBloom(): RenderTexture | null {
    return this.bloomRT;
  }

  /** 更新配置 */
  updateConfig(config: FluidSimulationConfig): void {
    const needsRebuild =
      config.BLOOM_RESOLUTION !== this.config.BLOOM_RESOLUTION ||
      config.BLOOM_ITERATIONS !== this.config.BLOOM_ITERATIONS;
    this.config = config;
    if (needsRebuild) {
      this.initFramebuffers();
    }
  }

  /** resize */
  resize(): void {
    this.initFramebuffers();
  }

  /** 销毁 RenderTexture */
  private destroyFramebuffers(): void {
    if (this.bloomRT) { this.ctx.destroyRT(this.bloomRT); this.bloomRT = null; }
    for (const fbo of this.bloomFBOs) { this.ctx.destroyRT(fbo); }
    this.bloomFBOs = [];
  }

  /** 销毁所有资源 */
  destroy(): void {
    this.destroyFramebuffers();
  }
}
