// 流体模拟入口类：管理 WebGL 资源、主渲染循环、splat 注入
// 移植自 WebGL-Fluid-Simulation 的 update / render / initFramebuffers 主流程

import { getWebGLContext } from "./GLContext";
import {
  createBlit,
  Program,
  Material,
  compileShader,
  scaleByPixelRatio,
} from "./GLUtils";
import type { FBO } from "./FramebufferManager";
import { FluidSolver } from "./FluidSolver";
import { BloomPass } from "./BloomPass";
import { SunraysPass } from "./SunraysPass";
import { DisplayPass } from "./DisplayPass";
import {
  baseVertexShader,
  blurVertexShader,
  blurShader,
  copyShader,
  clearShader,
  colorShader,
  displayShaderSource,
  bloomPrefilterShader,
  bloomBlurShader,
  bloomFinalShader,
  sunraysMaskShader,
  sunraysShader,
  splatShader,
  advectionShader,
  divergenceShader,
  curlShader,
  vorticityShader,
  pressureShader,
  gradientSubtractShader,
} from "./shaders";
import { DEFAULT_CONFIG } from "./FluidConfig";
import type { FluidSimulationConfig } from "./FluidConfig";

interface SplatColor {
  r: number;
  g: number;
  b: number;
}

interface DitheringTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  attach(id: number): number;
}

/** 编译 vertex+fragment shader 并封装为 Program */
function makeProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fsSource: string,
  keywords?: string[] | null,
): Program {
  return new Program(
    gl,
    vs,
    compileShader(gl, gl.FRAGMENT_SHADER, fsSource, keywords),
  );
}

export class FluidSimulation {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private blit: (target: FBO | null, clear?: boolean) => void;
  private config: FluidSimulationConfig;

  private solver: FluidSolver;
  private bloomPass: BloomPass;
  private sunraysPass: SunraysPass;
  private displayPass: DisplayPass;

  private ditheringTexture: DitheringTexture;
  private lastUpdateTime = 0;
  private paused = false;
  private destroyed = false;
  private initialized = false;

  constructor(
    canvas: HTMLCanvasElement,
    config?: Partial<FluidSimulationConfig>,
  ) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };

    const { gl, ext } = getWebGLContext(canvas);
    this.gl = gl;

    if (!ext.supportLinearFiltering) {
      this.config.DYE_RESOLUTION = 512;
      this.config.SHADING = false;
      this.config.BLOOM = false;
      this.config.SUNRAYS = false;
    }

    this.blit = createBlit(gl);

    // 编译共用 vertex shader
    const baseVS = compileShader(gl, gl.VERTEX_SHADER, baseVertexShader);
    const blurVS = compileShader(gl, gl.VERTEX_SHADER, blurVertexShader);

    // ─── FluidSolver 所需 programs ───
    const copyProgram = makeProgram(gl, baseVS, copyShader);
    const clearProgram = makeProgram(gl, baseVS, clearShader);
    const splatProgram = makeProgram(gl, baseVS, splatShader);
    const advectionProgram = makeProgram(
      gl,
      baseVS,
      advectionShader,
      ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"],
    );
    const divergenceProgram = makeProgram(gl, baseVS, divergenceShader);
    const curlProgram = makeProgram(gl, baseVS, curlShader);
    const vorticityProgram = makeProgram(gl, baseVS, vorticityShader);
    const pressureProgram = makeProgram(gl, baseVS, pressureShader);
    const gradientSubtractProgram = makeProgram(
      gl,
      baseVS,
      gradientSubtractShader,
    );

    this.solver = new FluidSolver(
      gl,
      ext,
      this.blit,
      copyProgram,
      clearProgram,
      splatProgram,
      advectionProgram,
      divergenceProgram,
      curlProgram,
      vorticityProgram,
      pressureProgram,
      gradientSubtractProgram,
      this.config,
    );

    // ─── BloomPass 所需 programs ───
    const bloomPrefilterProgram = makeProgram(gl, baseVS, bloomPrefilterShader);
    const bloomBlurProgram = makeProgram(gl, baseVS, bloomBlurShader); // 修复：需要 vT/vB，必须用 baseVS
    const bloomFinalProgram = makeProgram(gl, baseVS, bloomFinalShader);

    this.bloomPass = new BloomPass(
      gl,
      ext,
      this.blit,
      bloomPrefilterProgram,
      bloomBlurProgram,
      bloomFinalProgram,
      this.config,
    );

    // ─── SunraysPass 所需 programs ───
    const sunraysMaskProgram = makeProgram(gl, baseVS, sunraysMaskShader);
    const sunraysProgram = makeProgram(gl, baseVS, sunraysShader);
    const blurProgram = makeProgram(gl, blurVS, blurShader);

    this.sunraysPass = new SunraysPass(
      gl,
      ext,
      this.blit,
      sunraysMaskProgram,
      sunraysProgram,
      blurProgram,
      this.config,
    );

    // ─── DisplayPass 所需 programs/material ───
    const displayMaterial = new Material(gl, baseVS, displayShaderSource);
    const colorProgram = makeProgram(gl, baseVS, colorShader);

    this.displayPass = new DisplayPass(
      gl,
      this.blit,
      displayMaterial,
      colorProgram,
      this.config,
    );
    this.displayPass.updateKeywords();

    this.ditheringTexture = this.createDitheringTexture();
  }

  /** 初始化 WebGL 资源（不再自动启动循环） */
  start() {
    if (this.initialized) return;

    this.resizeCanvas();
    this.solver.initFramebuffers();
    this.bloomPass.initFramebuffers();
    this.sunraysPass.initFramebuffers();
    this.initialized = true;
    this.lastUpdateTime = Date.now();
  }

  /** 外部驱动的更新方法，由 WaterfallEngine 主循环调用 */
  update(): void {
    if (this.destroyed || !this.initialized) return;
    const dt = this.calcDeltaTime();
    if (this.resizeCanvas()) {
      this.solver.resize();
      this.bloomPass.resize();
      this.sunraysPass.resize();
    }
    if (!this.paused) this.solver.step(dt);
    this.render();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private calcDeltaTime(): number {
    const now = Date.now();
    let dt = (now - this.lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    this.lastUpdateTime = now;
    return dt;
  }

  private resizeCanvas(): boolean {
    const width = scaleByPixelRatio(this.canvas.clientWidth);
    const height = scaleByPixelRatio(this.canvas.clientHeight);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      return true;
    }
    return false;
  }

  private render() {
    const dyeDouble = this.solver.getDyeDouble();
    if (!dyeDouble) return;
    const dyeRead = dyeDouble.read;

    if (this.config.BLOOM) {
      const bloom = this.bloomPass.getBloom();
      if (bloom) this.bloomPass.apply(dyeRead, bloom);
    }
    if (this.config.SUNRAYS) {
      const sunrays = this.sunraysPass.getSunrays();
      const sunraysTemp = this.sunraysPass.getSunraysTemp();
      if (sunrays && sunraysTemp) {
        // 用 dye.write 作为 mask 临时缓冲（drawDisplay 只读 dye.read，不影响）
        this.sunraysPass.apply(dyeRead, dyeDouble.write, sunrays);
        this.sunraysPass.blur(sunrays, sunraysTemp, 1);
      }
    }

    this.displayPass.render(
      null,
      dyeRead,
      this.config.BLOOM ? this.bloomPass.getBloom() : null,
      this.config.SUNRAYS ? this.sunraysPass.getSunrays() : null,
      this.ditheringTexture,
    );
  }

  /** 注入一个流体 splat（MIDI 触发时调用） */
  splat(x: number, y: number, dx: number, dy: number, color: SplatColor) {
    this.solver.splat(x, y, dx, dy, color);
  }

  /** 注入随机 splats */
  multipleSplats(amount: number) {
    this.solver.multipleSplats(amount);
  }

  /** 更新配置（设置面板调用） */
  updateConfig(config: Partial<FluidSimulationConfig>) {
    const prevSimRes = this.config.SIM_RESOLUTION;
    const prevDyeRes = this.config.DYE_RESOLUTION;
    const prevBloomRes = this.config.BLOOM_RESOLUTION;
    const prevSunraysRes = this.config.SUNRAYS_RESOLUTION;
    const prevBloomIter = this.config.BLOOM_ITERATIONS;
    const prevBloom = this.config.BLOOM;

    Object.assign(this.config, config);

    this.solver.updateConfig(this.config);
    this.bloomPass.updateConfig(this.config);
    this.sunraysPass.updateConfig(this.config);
    this.displayPass.updateConfig(this.config);

    if (
      this.config.SIM_RESOLUTION !== prevSimRes ||
      this.config.DYE_RESOLUTION !== prevDyeRes
    ) {
      this.solver.resize();
    }
    if (
      this.config.BLOOM_RESOLUTION !== prevBloomRes ||
      this.config.BLOOM_ITERATIONS !== prevBloomIter
    ) {
      this.bloomPass.resize();
    }
    // BLOOM 从 false 变为 true 时需要重建 bloom FBO
    if (this.config.BLOOM && !prevBloom) {
      this.bloomPass.resize();
    }
    if (this.config.SUNRAYS_RESOLUTION !== prevSunraysRes) {
      this.sunraysPass.resize();
    }
  }

  getConfig(): FluidSimulationConfig {
    return this.config;
  }

  /** 处理 canvas resize */
  resize() {
    if (this.resizeCanvas()) {
      this.solver.resize();
      this.bloomPass.resize();
      this.sunraysPass.resize();
    }
  }

  /** 暂停/恢复 */
  setPaused(paused: boolean) {
    this.paused = paused;
    this.config.PAUSED = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  private createDitheringTexture(): DitheringTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create dithering texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      1,
      1,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255]),
    );

    // 使用 1x1 白色纹理替代 LDR_LLL1_0.png，移除 CRT 扫描线/噪点效果
    const obj: DitheringTexture = {
      texture,
      width: 1,
      height: 1,
      attach(id: number) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };

    return obj;
  }

  /** 停止渲染，释放所有 WebGL 资源 */
  destroy() {
    this.destroyed = true;
    this.solver.destroy();
    this.bloomPass.destroy();
    this.sunraysPass.destroy();
    this.displayPass.destroy();

    const loseExt = this.gl.getExtension("WEBGL_lose_context");
    loseExt?.loseContext();
  }
}
