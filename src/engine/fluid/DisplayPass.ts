// ─── 最终合成显示 pass：将 dye + bloom + sunrays + dithering 合成到屏幕 / target ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import { Material, Program } from "./GLUtils";
import type { FBO, TextureObject } from "./FramebufferManager";
import type { FluidSimulationConfig } from "./FluidConfig";

export class DisplayPass {
  private gl: WebGLRenderingContext;
  private blit: (target: FBO | null, clear?: boolean) => void;
  private config: FluidSimulationConfig;

  private displayMaterial: Material;
  private colorProgram: Program;

  constructor(
    gl: WebGLRenderingContext,
    blit: (target: FBO | null, clear?: boolean) => void,
    displayMaterial: Material,
    colorProgram: Program,
    config: FluidSimulationConfig,
  ) {
    this.gl = gl;
    this.blit = blit;
    this.displayMaterial = displayMaterial;
    this.colorProgram = colorProgram;
    this.config = config;
  }

  /** 根据 SHADING/BLOOM/SUNRAYS 开关重新编译 display shader */
  updateKeywords() {
    const displayKeywords: string[] = [];
    if (this.config.SHADING) displayKeywords.push("SHADING");
    if (this.config.BLOOM) displayKeywords.push("BLOOM");
    if (this.config.SUNRAYS) displayKeywords.push("SUNRAYS");
    this.displayMaterial.setKeywords(displayKeywords);
  }

  /**
   * 渲染最终合成画面
   * - target=null 渲染到屏幕，否则渲染到指定 FBO
   * - TRANSPARENT=true 时清屏为透明，让 CSS 背景层透出
   */
  render(
    target: FBO | null,
    dye: FBO,
    bloom: FBO | null,
    sunrays: FBO | null,
    ditheringTexture: TextureObject,
  ) {
    const gl = this.gl;
    const config = this.config;

    if (target == null && config.TRANSPARENT) {
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
    } else if (!config.TRANSPARENT) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      this.drawColor(target, normalizeColor(config.BACK_COLOR));
    } else {
      gl.disable(gl.BLEND);
    }

    this.drawDisplay(target, dye, bloom, sunrays, ditheringTexture);
  }

  private drawColor(target: FBO | null, color: { r: number; g: number; b: number }) {
    this.colorProgram.bind();
    this.gl.uniform4f(this.colorProgram.uniforms.color, color.r, color.g, color.b, 1);
    this.blit(target);
  }

  private drawDisplay(
    target: FBO | null,
    dye: FBO,
    bloom: FBO | null,
    sunrays: FBO | null,
    ditheringTexture: TextureObject,
  ) {
    const gl = this.gl;
    const config = this.config;
    const width = target == null ? gl.drawingBufferWidth : target.width;
    const height = target == null ? gl.drawingBufferHeight : target.height;

    this.displayMaterial.bind();
    if (config.SHADING) {
      gl.uniform2f(this.displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
    }
    gl.uniform1i(this.displayMaterial.uniforms.uTexture, dye.attach(0));
    if (config.BLOOM && bloom) {
      gl.uniform1i(this.displayMaterial.uniforms.uBloom, bloom.attach(1));
      gl.uniform1i(this.displayMaterial.uniforms.uDithering, ditheringTexture.attach(2));
      const scale = getTextureScale(ditheringTexture, width, height);
      gl.uniform2f(this.displayMaterial.uniforms.ditherScale, scale.x, scale.y);
    }
    if (config.SUNRAYS && sunrays) {
      gl.uniform1i(this.displayMaterial.uniforms.uSunrays, sunrays.attach(3));
    }
    this.blit(target);
  }

  updateConfig(config: FluidSimulationConfig) {
    const needsKeywordUpdate =
      config.SHADING !== this.config.SHADING ||
      config.BLOOM !== this.config.BLOOM ||
      config.SUNRAYS !== this.config.SUNRAYS;
    this.config = config;
    if (needsKeywordUpdate) {
      this.updateKeywords();
    }
  }

  destroy() {
    // Program/Material 的销毁由 WebGL context 丢失处理；这里仅断引用
  }
}

function normalizeColor(input: { r: number; g: number; b: number }) {
  return {
    r: input.r / 255,
    g: input.g / 255,
    b: input.b / 255,
  };
}

function getTextureScale(
  texture: TextureObject,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: width / texture.width,
    y: height / texture.height,
  };
}
