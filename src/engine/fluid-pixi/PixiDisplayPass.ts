// ─── PixiJS 最终合成显示 pass：将 dye + bloom + sunrays 合成到输出纹理 ───
// 将原生 WebGL DisplayPass 迁移为 PixiJS Filter + RenderTexture 管线

import { Filter, UniformGroup, RenderTexture, Texture } from 'pixi.js';
import { PixiFluidContext } from './PixiFluidContext';
import { defaultFilterVertex, displayShader } from './shaders';
import type { FluidSimulationConfig } from '../fluid/FluidConfig';

/**
 * PixiJS 最终合成显示 pass
 *
 * 职责：
 * 1. 将染料场 + bloom + sunrays 合成为最终画面
 * 2. 应用色调映射（ACD tonemap）
 * 3. 支持法线着色（shading）、抖动（dithering）
 *
 * 使用 uniform bool 替代 #ifdef 条件编译，便于 PixiJS v8 Filter 动态切换
 */
export class PixiDisplayPass {
  private ctx: PixiFluidContext;
  private config: FluidSimulationConfig;

  // Display 专用 Filter
  private displayFilter: Filter;

  // 输出 RenderTexture
  private outputRT: RenderTexture | null = null;

  // 1x1 白色 dithering 占位纹理
  private ditheringTexture: Texture;

  constructor(ctx: PixiFluidContext, config: FluidSimulationConfig) {
    this.ctx = ctx;
    this.config = config;

    // 创建 1x1 白色 dithering 占位纹理（替代原项目的 LDR_LLL1_0.png）
    this.ditheringTexture = Texture.WHITE;

    this.displayFilter = Filter.from({
      gl: { vertex: defaultFilterVertex, fragment: displayShader },
      resources: {
        displayUniforms: new UniformGroup({
          texelSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          ditherScale: { value: 1.0, type: 'f32' },
          uShading: { value: 0, type: 'i32' },
          uBloomEnabled: { value: 0, type: 'i32' },
          uSunraysEnabled: { value: 0, type: 'i32' },
        }),
        uBloom: null as unknown as RenderTexture,
        uBloomStyle: null as unknown as object,
        uSunrays: null as unknown as RenderTexture,
        uSunraysStyle: null as unknown as object,
        uDithering: this.ditheringTexture.source,
        uDitheringStyle: this.ditheringTexture.source.style,
      },
    });
  }

  /** 初始化输出 RenderTexture */
  initFramebuffers(): void {
    if (this.outputRT) { this.ctx.destroyRT(this.outputRT); }
    const app = this.ctx.application;
    this.outputRT = this.ctx.createRT(
      app.screen.width,
      app.screen.height,
      'rgba8unorm',
      'linear',
    );
  }

  /**
   * 执行最终合成渲染
   * @param dye - 染料场 RenderTexture
   * @param bloom - bloom 结果（可 null）
   * @param sunrays - sunrays 结果（可 null）
   * @returns 合成后的输出 RenderTexture
   */
  apply(
    dye: RenderTexture,
    bloom: RenderTexture | null,
    sunrays: RenderTexture | null,
  ): RenderTexture | null {
    if (!this.outputRT) return null;

    const config = this.config;
    const dispU = this.displayFilter.resources.displayUniforms.uniforms;

    // 更新配置（使用 i32: 0=false, 1=true）
    dispU.uShading = config.SHADING ? 1 : 0;
    dispU.uBloomEnabled = (config.BLOOM && !!bloom) ? 1 : 0;
    dispU.uSunraysEnabled = (config.SUNRAYS && !!sunrays) ? 1 : 0;

    if (config.SHADING) {
      dispU.texelSize = [1.0 / dye.width, 1.0 / dye.height];
    }

    // 设置额外纹理
    if (bloom) {
      this.displayFilter.resources.uBloom = bloom.source;
      this.displayFilter.resources.uBloomStyle = bloom.source.style;
      dispU.ditherScale = dye.width / this.ditheringTexture.width;
    } else {
      this.displayFilter.resources.uBloom = null;
      this.displayFilter.resources.uBloomStyle = null;
    }

    if (sunrays) {
      this.displayFilter.resources.uSunrays = sunrays.source;
      this.displayFilter.resources.uSunraysStyle = sunrays.source.style;
    } else {
      this.displayFilter.resources.uSunrays = null;
      this.displayFilter.resources.uSunraysStyle = null;
    }

    // 执行合成 pass
    this.ctx.applyPass(this.displayFilter, dye, this.outputRT);
    return this.outputRT;
  }

  /** 获取输出纹理 */
  getOutput(): RenderTexture | null {
    return this.outputRT;
  }

  /** 更新配置 */
  updateConfig(config: FluidSimulationConfig): void {
    this.config = config;
  }

  /** resize */
  resize(): void {
    this.initFramebuffers();
  }

  /** 销毁所有资源 */
  destroy(): void {
    if (this.outputRT) { this.ctx.destroyRT(this.outputRT); this.outputRT = null; }
    this.displayFilter.resources.uBloom = null;
    this.displayFilter.resources.uBloomStyle = null;
    this.displayFilter.resources.uSunrays = null;
    this.displayFilter.resources.uSunraysStyle = null;
  }
}
