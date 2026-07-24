// ─── PixiJS 最终合成显示 pass：将 dye + bloom + sunrays 合成到输出纹理 ───
// 将原生 WebGL DisplayPass 迁移为 PixiJS Filter + RenderTexture 管线

import { Filter, UniformGroup, RenderTexture, Texture } from "pixi.js";
import type { TEXTURE_FORMATS } from "pixi.js";
import { PixiFluidContext } from "./PixiFluidContext";
import { defaultFilterVertex, displayShader } from "./shaders";
import type { FluidSimulationConfig } from "../fluid/FluidConfig";

/**
 * PixiJS 最终合成显示 pass
 *
 * 职责：
 * 1. 将染料场 + bloom + sunrays 合成为最终画面
 * 2. HDR 输出（rgba16float），无色调映射，亮值自然裁剪到白
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
          texelSize: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
          ditherScale: { value: new Float32Array([1, 1]), type: "vec2<f32>" },
          uShading: { value: 0, type: "i32" },
          uBloomEnabled: { value: 0, type: "i32" },
          uSunraysEnabled: { value: 0, type: "i32" },
        }),
        uBloom: this.ditheringTexture.source,
        uBloomStyle: this.ditheringTexture.source.style,
        uSunrays: this.ditheringTexture.source,
        uSunraysStyle: this.ditheringTexture.source.style,
        uDithering: this.ditheringTexture.source,
        uDitheringStyle: this.ditheringTexture.source.style,
      },
    });
  }

  /** 初始化输出 RenderTexture（HDR 格式，见 ADR-0002） */
  initFramebuffers(): void {
    if (this.outputRT) {
      this.ctx.destroyRT(this.outputRT);
    }
    const app = this.ctx.application;
    this.outputRT = this.ctx.createRT(
      app.screen.width,
      app.screen.height,
      "rgba16float" as TEXTURE_FORMATS,
      "linear",
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
    dispU.uBloomEnabled = config.BLOOM && !!bloom ? 1 : 0;
    dispU.uSunraysEnabled = config.SUNRAYS && !!sunrays ? 1 : 0;

    if (config.SHADING) {
      dispU.texelSize = [1.0 / dye.width, 1.0 / dye.height];
    }

    // 设置额外纹理（始终绑定有效纹理，避免 sampler2D 为 null 导致着色器错误）
    if (bloom) {
      this.displayFilter.resources.uBloom = bloom.source;
      this.displayFilter.resources.uBloomStyle = bloom.source.style;
      // ditherScale 为 vec2：x = dye宽/dithering宽，y = dye高/dithering高
      dispU.ditherScale = [
        dye.width / this.ditheringTexture.width,
        dye.height / this.ditheringTexture.height,
      ];
    } else {
      // 绑定占位纹理（着色器中 uBloomEnabled=0 会跳过采样）
      this.displayFilter.resources.uBloom = this.ditheringTexture.source;
      this.displayFilter.resources.uBloomStyle =
        this.ditheringTexture.source.style;
    }

    if (sunrays) {
      this.displayFilter.resources.uSunrays = sunrays.source;
      this.displayFilter.resources.uSunraysStyle = sunrays.source.style;
    } else {
      this.displayFilter.resources.uSunrays = this.ditheringTexture.source;
      this.displayFilter.resources.uSunraysStyle =
        this.ditheringTexture.source.style;
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
    if (this.outputRT) {
      this.ctx.destroyRT(this.outputRT);
      this.outputRT = null;
    }
    this.displayFilter.resources.uBloom = this.ditheringTexture.source;
    this.displayFilter.resources.uBloomStyle =
      this.ditheringTexture.source.style;
    this.displayFilter.resources.uSunrays = this.ditheringTexture.source;
    this.displayFilter.resources.uSunraysStyle =
      this.ditheringTexture.source.style;
    this.displayFilter.destroy();
  }
}
