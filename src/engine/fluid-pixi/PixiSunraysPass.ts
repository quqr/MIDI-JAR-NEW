// ─── PixiJS Sunrays 后处理 pass：mask（亮度→alpha）→ radial light rays → 双向模糊 ───
// 将原生 WebGL SunraysPass 迁移为 PixiJS Filter + RenderTexture 管线

import { Filter, UniformGroup, RenderTexture } from 'pixi.js';
import type { TEXTURE_FORMATS } from 'pixi.js';
import { PixiFluidContext } from './PixiFluidContext';
import { defaultFilterVertex, sunraysMaskShader, sunraysShader, blurShader } from './shaders';
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
 * PixiJS Sunrays 后处理 pass
 *
 * 管线：
 * 1. mask：将亮度转换为 alpha 通道
 * 2. sunrays：从中心径向扩散的光线效果
 * 3. blur：双向高斯模糊（水平+垂直），迭代 iterations 次
 */
export class PixiSunraysPass {
  private ctx: PixiFluidContext;
  private config: FluidSimulationConfig;

  // Sunrays 专用 Filter
  private maskFilter: Filter;
  private sunraysFilter: Filter;
  private blurFilter: Filter;

  // Sunrays RenderTexture
  private sunraysRT: RenderTexture | null = null;
  private sunraysTempRT: RenderTexture | null = null;

  constructor(ctx: PixiFluidContext, config: FluidSimulationConfig) {
    this.ctx = ctx;
    this.config = config;

    this.maskFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: sunraysMaskShader },
      resources: {},
    });

    this.sunraysFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: sunraysShader },
      resources: {
        sunraysUniforms: new UniformGroup({
          weight: { value: 1.0, type: 'f32' },
        }),
      },
    });

    this.blurFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: blurShader },
      resources: {
        blurUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
        }),
      },
    });
  }

  /** 初始化 Sunrays RenderTexture */
  initFramebuffers(): void {
    const app = this.ctx.application;
    const res = getResolution(app.screen.width, app.screen.height, this.config.SUNRAYS_RESOLUTION);

    this.destroyFramebuffers();

    this.sunraysRT = this.ctx.createRT(res.width, res.height, 'r16float' as TEXTURE_FORMATS, 'linear');
    this.sunraysTempRT = this.ctx.createRT(res.width, res.height, 'r16float' as TEXTURE_FORMATS, 'linear');
  }

  /**
   * 执行 mask + sunrays
   * @param source - 输入染料场 RenderTexture
   * @param mask - 临时缓冲（用于 mask 输出，通常是 dye.write）
   * @param destination - 输出 sunrays 结果
   */
  apply(source: RenderTexture, mask: RenderTexture, destination: RenderTexture): void {
    if (!this.sunraysRT || !this.sunraysTempRT) return;

    // 1. mask：source → mask（亮度转 alpha）
    this.ctx.applyPass(this.maskFilter, source, mask);

    // 2. sunrays：mask → destination（径向光线）
    const sunU = this.sunraysFilter.resources.sunraysUniforms.uniforms;
    sunU.weight = this.config.SUNRAYS_WEIGHT;
    this.ctx.applyPass(this.sunraysFilter, mask, destination);
  }

  /**
   * 双向模糊：水平 → 垂直，迭代 iterations 次
   * @param target - 目标纹理（模糊后写回）
   * @param temp - 临时缓冲
   * @param iterations - 模糊迭代次数
   */
  blur(target: RenderTexture, temp: RenderTexture, iterations: number): void {
    const blurU = this.blurFilter.resources.blurUniforms.uniforms;
    for (let i = 0; i < iterations; i++) {
      // 水平
      blurU.texelSize = [1.0 / target.width, 0.0];
      this.ctx.applyPass(this.blurFilter, target, temp);
      // 垂直
      blurU.texelSize = [0.0, 1.0 / target.height];
      this.ctx.applyPass(this.blurFilter, temp, target);
    }
  }

  /** 获取 sunrays 纹理 */
  getSunrays(): RenderTexture | null {
    return this.sunraysRT;
  }

  /** 获取 sunrays 临时缓冲 */
  getSunraysTemp(): RenderTexture | null {
    return this.sunraysTempRT;
  }

  /** 更新配置 */
  updateConfig(config: FluidSimulationConfig): void {
    const needsRebuild =
      config.SUNRAYS_RESOLUTION !== this.config.SUNRAYS_RESOLUTION;
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
    if (this.sunraysRT) { this.ctx.destroyRT(this.sunraysRT); this.sunraysRT = null; }
    if (this.sunraysTempRT) { this.ctx.destroyRT(this.sunraysTempRT); this.sunraysTempRT = null; }
  }

  /** 销毁所有资源 */
  destroy(): void {
    this.destroyFramebuffers();
  }
}
