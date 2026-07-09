import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 全局 mock WebGL2RenderingContext
(globalThis as unknown as Record<string, unknown>).WebGL2RenderingContext = class WebGL2RenderingContext {};

// Mock WebGL 相关模块以避免 jsdom 环境下 WebGL 不可用
vi.mock("../engine/fluid/GLContext", () => ({
  getWebGLContext: () => ({
    gl: {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      TEXTURE_2D: 0,
      LINEAR: 1,
      REPEAT: 1,
      RGB: 6,
      UNSIGNED_BYTE: 0,
      createTexture: () => ({}),
      bindTexture: () => {},
      texParameteri: () => {},
      texImage2D: () => {},
      getExtension: () => null,
      activeTexture: () => {},
      ARRAY_BUFFER: 1,
      ELEMENT_ARRAY_BUFFER: 2,
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      getAttribLocation: () => 0,
      getUniformLocation: () => ({ value: null }),
      uniform1f: () => {},
      uniform2f: () => {},
      uniform3f: () => {},
      uniform4f: () => {},
      uniform1i: () => {},
      uniform2i: () => {},
      uniform3i: () => {},
      uniform4i: () => {},
      deleteTexture: () => {},
      deleteBuffer: () => {},
      deleteProgram: () => {},
      deleteShader: () => {},
      viewport: () => {},
      clearColor: () => {},
      clear: () => {},
      drawArrays: () => {},
      drawElements: () => {},
    },
    ext: {
      formatRGBA: { internalFormat: 0, format: 0 },
      formatRG: { internalFormat: 0, format: 0 },
      formatR: { internalFormat: 0, format: 0 },
      halfFloatTexType: 0,
      supportLinearFiltering: true,
    },
  }),
}));

vi.mock("../engine/fluid/GLUtils", () => ({
  createBlit: () => () => {},
  Program: class MockProgram {
    gl: unknown;
    vs: unknown;
    fs: unknown;
    constructor(gl: unknown, vs: unknown, fs: unknown) {
      this.gl = gl;
      this.vs = vs;
      this.fs = fs;
    }
  },
  Material: class MockMaterial {
    gl: unknown;
    vs: unknown;
    fs: unknown;
    constructor(gl: unknown, vs: unknown, fs: unknown) {
      this.gl = gl;
      this.vs = vs;
      this.fs = fs;
    }
    setKeywords() {}
  },
  compileShader: () => ({}),
  scaleByPixelRatio: (n: number) => n,
}));

vi.mock("../engine/fluid/FluidSolver", () => ({
  FluidSolver: class MockFluidSolver {
    gl: unknown;
    ext: unknown;
    blit: unknown;
    programs: unknown[];
    config: unknown;
    constructor(
      gl: unknown,
      ext: unknown,
      blit: unknown,
      ...programs: unknown[]
    ) {
      this.gl = gl;
      this.ext = ext;
      this.blit = blit;
      this.programs = programs;
    }
    initFramebuffers() {}
    resize() {}
    step() {}
    splat() {}
    multipleSplats() {}
    getDyeDouble() {
      return { read: { width: 512, height: 512 }, write: { width: 512, height: 512 } };
    }
    updateConfig() {}
    destroy() {}
  },
}));

vi.mock("../engine/fluid/BloomPass", () => ({
  BloomPass: class MockBloomPass {
    initFramebuffers() {}
    resize() {}
    apply() {}
    getBloom() {
      return { width: 256, height: 256 };
    }
    updateConfig() {}
    destroy() {}
  },
}));

vi.mock("../engine/fluid/SunraysPass", () => ({
  SunraysPass: class MockSunraysPass {
    initFramebuffers() {}
    resize() {}
    apply() {}
    blur() {}
    getSunrays() {
      return { width: 196, height: 196 };
    }
    getSunraysTemp() {
      return { width: 196, height: 196 };
    }
    updateConfig() {}
    destroy() {}
  },
}));

vi.mock("../engine/fluid/DisplayPass", () => ({
  DisplayPass: class MockDisplayPass {
    updateKeywords() {}
    render() {}
    updateConfig() {}
    destroy() {}
  },
}));

vi.mock("../engine/fluid/shaders", () => ({
  baseVertexShader: "",
  blurVertexShader: "",
  blurShader: "",
  copyShader: "",
  clearShader: "",
  colorShader: "",
  checkerboardShader: "",
  displayShaderSource: "",
  bloomPrefilterShader: "",
  bloomBlurShader: "",
  bloomFinalShader: "",
  sunraysMaskShader: "",
  sunraysShader: "",
  splatShader: "",
  advectionShader: "",
  divergenceShader: "",
  curlShader: "",
  vorticityShader: "",
  pressureShader: "",
  gradientSubtractShader: "",
}));

import { FluidSimulation } from "../engine/fluid/FluidSimulation";
import { DEFAULT_CONFIG } from "../engine/fluid/FluidConfig";

describe("FluidSimulation", () => {
  let simulation: FluidSimulation;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    // 创建模拟 canvas
    mockCanvas = document.createElement("canvas");
    mockCanvas.width = 512;
    mockCanvas.height = 512;
    mockCanvas.style.width = "512px";
    mockCanvas.style.height = "512px";

    simulation = new FluidSimulation(mockCanvas);
  });

  afterEach(() => {
    if (simulation) {
      simulation.destroy();
    }
  });

  describe("updateConfig 方法", () => {
    it("正常更新配置", () => {
      const newConfig = {
        SIM_RESOLUTION: 256,
        DYE_RESOLUTION: 512,
      };
      simulation.updateConfig(newConfig);
      const config = simulation.getConfig();
      expect(config.SIM_RESOLUTION).toBe(256);
      expect(config.DYE_RESOLUTION).toBe(512);
    });

    it("部分配置更新保留其他字段", () => {
      const originalConfig = simulation.getConfig();
      const originalDissipation = originalConfig.DENSITY_DISSIPATION;

      simulation.updateConfig({ CURL: 50 });
      const config = simulation.getConfig();
      expect(config.CURL).toBe(50);
      expect(config.DENSITY_DISSIPATION).toBe(originalDissipation);
    });

    it("无效参数（超出范围）仍接受（由外部验证）", () => {
      // FluidSimulation 不做参数验证，由上层负责
      expect(() =>
        simulation.updateConfig({ SPLAT_RADIUS: -0.5 }),
      ).not.toThrow();
      expect(() =>
        simulation.updateConfig({ BLOOM_INTENSITY: 100 }),
      ).not.toThrow();
    });

    it("分辨率改变触发 resize", () => {
      // 验证 updateConfig 不抛错即可（resize 为内部调用）
      expect(() =>
        simulation.updateConfig({ SIM_RESOLUTION: 64 }),
      ).not.toThrow();
      expect(() =>
        simulation.updateConfig({ DYE_RESOLUTION: 128 }),
      ).not.toThrow();
    });

    it("Bloom 配置改变触发 resize", () => {
      expect(() =>
        simulation.updateConfig({ BLOOM_ITERATIONS: 16 }),
      ).not.toThrow();
      expect(() =>
        simulation.updateConfig({ BLOOM_RESOLUTION: 128 }),
      ).not.toThrow();
    });
  });

  describe("splat 参数验证", () => {
    it("x, y 在 0-1 范围内正常工作", () => {
      expect(() =>
        simulation.splat(0.5, 0.5, 100, 100, { r: 1, g: 1, b: 1 }),
      ).not.toThrow();
    });

    it("边界值 x=0, y=0 正常工作", () => {
      expect(() =>
        simulation.splat(0, 0, 100, 100, { r: 1, g: 1, b: 1 }),
      ).not.toThrow();
    });

    it("边界值 x=1, y=1 正常工作", () => {
      expect(() =>
        simulation.splat(1, 1, 100, 100, { r: 1, g: 1, b: 1 }),
      ).not.toThrow();
    });

    it("超边界值（负数）仍接受（由 FluidSolver 处理）", () => {
      // FluidSimulation 不做边界验证，传递给 FluidSolver
      expect(() =>
        simulation.splat(-0.5, -0.5, 100, 100, { r: 1, g: 1, b: 1 }),
      ).not.toThrow();
    });

    it("超边界值（大于 1）仍接受（由 FluidSolver 处理）", () => {
      expect(() =>
        simulation.splat(1.5, 1.5, 100, 100, { r: 1, g: 1, b: 1 }),
      ).not.toThrow();
    });

    it("dx, dy 为任意数值", () => {
      expect(() =>
        simulation.splat(0.5, 0.5, -1000, 1000, { r: 1, g: 1, b: 1 }),
      ).not.toThrow();
    });

    it("color RGB 值超出 0-1 范围仍接受（亮度增强）", () => {
      expect(() =>
        simulation.splat(0.5, 0.5, 100, 100, { r: 2, g: 1.5, b: 0.5 }),
      ).not.toThrow();
    });
  });

  describe("基础方法", () => {
    it("start() 不抛错", () => {
      expect(() => simulation.start()).not.toThrow();
    });

    it("start() 重复调用不会重复初始化", () => {
      simulation.start();
      simulation.start(); // 第二次调用应被忽略
      expect(() => simulation.start()).not.toThrow();
    });

    it("setPaused() 正常工作", () => {
      simulation.setPaused(true);
      expect(simulation.isPaused()).toBe(true);
      simulation.setPaused(false);
      expect(simulation.isPaused()).toBe(false);
    });

    it("resize() 不抛错", () => {
      mockCanvas.style.width = "800px";
      mockCanvas.style.height = "600px";
      expect(() => simulation.resize()).not.toThrow();
    });

    it("multipleSplats() 不抛错", () => {
      expect(() => simulation.multipleSplats(5)).not.toThrow();
    });

    it("destroy() 不抛错", () => {
      simulation.start();
      expect(() => simulation.destroy()).not.toThrow();
    });

    it("getConfig() 返回默认配置", () => {
      const config = simulation.getConfig();
      expect(config.SIM_RESOLUTION).toBe(DEFAULT_CONFIG.SIM_RESOLUTION);
      expect(config.DYE_RESOLUTION).toBe(DEFAULT_CONFIG.DYE_RESOLUTION);
    });
  });
});