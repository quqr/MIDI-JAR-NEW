import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock PIXI - 重点模拟 Filter / GlProgram / UniformGroup / BlurFilter
vi.mock("pixi.js", () => {
  class MockContainer {
    filters: unknown[] | null = null;
    addChild(_child: unknown) {}
    removeChild(_child: unknown) {}
    destroy() {}
  }
  class MockUniformGroup {
    uniforms: Record<string, unknown>;
    constructor(initial: Record<string, unknown>) {
      this.uniforms = initial;
    }
  }
  class MockGlProgram {
    static from(_opts: unknown) {
      return { __mockGlProgram: true };
    }
  }
  class MockFilter {
    glProgram: unknown = null;
    resources: unknown = null;
    strengthX = 0;
    strengthY = 0;
    destroy() {}
    constructor(_opts?: unknown) {}
  }
  class MockBlurFilter {
    strengthX = 0;
    strengthY = 0;
    strength = 0;
    quality = 1;
    destroy() {}
    constructor(_opts?: unknown) {}
  }
  const defaultFilterVert = "attribute vec2 aPosition;";
  const MockApplication = class {};
  return {
    Container: MockContainer,
    UniformGroup: MockUniformGroup,
    GlProgram: MockGlProgram,
    Filter: MockFilter,
    BlurFilter: MockBlurFilter,
    Application: MockApplication,
    defaultFilterVert,
  };
});

import { PostProcessingRenderer } from "../engine/PostProcessingRenderer";
import type { PostProcessingConfig } from "../types";
import type * as PIXI from "pixi.js";

function createMockContainer() {
  return {
    filters: null,
    addChild: (_c: unknown) => {},
    removeChild: (_c: unknown) => {},
    destroy: () => {},
  } as unknown as PIXI.Container;
}

function createMockApp() {
  return {} as unknown as PIXI.Application;
}

function createDefaultConfig(): PostProcessingConfig {
  return {
    bloom: {
      enabled: false,
      intensity: 0.5,
      threshold: 0.7,
      radius: 8,
      multiPass: false,
    },
    motionBlur: {
      enabled: false,
      strength: 0,
      layerOnly: false,
    },
    chromaticAberration: {
      enabled: false,
      intensity: 0.3,
    },
    vignette: {
      enabled: false,
      intensity: 0.5,
      radius: 0.7,
    },
    hitLineGlow: {
      enabled: false,
      intensity: 0.8,
      radius: 15,
    },
  };
}

describe("PostProcessingRenderer", () => {
  let renderer: PostProcessingRenderer;
  let sceneContainer: PIXI.Container;
  let noteBlockContainer: PIXI.Container;
  let hitLineContainer: PIXI.Container;

  beforeEach(() => {
    sceneContainer = createMockContainer();
    noteBlockContainer = createMockContainer();
    hitLineContainer = createMockContainer();
    renderer = new PostProcessingRenderer(
      createMockApp(),
      sceneContainer,
      noteBlockContainer,
      hitLineContainer,
    );
  });

  describe("构造", () => {
    it("构造不抛出错误", () => {
      expect(
        () =>
          new PostProcessingRenderer(
            createMockApp(),
            createMockContainer(),
            createMockContainer(),
            createMockContainer(),
          ),
      ).not.toThrow();
    });
  });

  describe("applyConfig - 默认配置（所有效果关闭）", () => {
    it("所有效果关闭时不抛出错误", () => {
      expect(() =>
        renderer.applyConfig(createDefaultConfig(), 800, 600),
      ).not.toThrow();
    });

    it("所有效果关闭时 filters 为 null", () => {
      renderer.applyConfig(createDefaultConfig(), 800, 600);
      expect(sceneContainer.filters).toBeNull();
      expect(noteBlockContainer.filters).toBeNull();
      expect(hitLineContainer.filters).toBeNull();
    });
  });

  describe("applyConfig - Bloom", () => {
    it("启用单 pass bloom 不抛出错误", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.bloom.multiPass = false;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("启用多 pass bloom 不抛出错误", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.bloom.multiPass = true;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("启用 bloom 后场景容器应有 filters", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      renderer.applyConfig(config, 800, 600);
      expect(sceneContainer.filters).not.toBeNull();
      expect((sceneContainer.filters as unknown[]).length).toBeGreaterThan(0);
    });

    it("从单 pass 切换到多 pass 不抛出错误（重建滤镜）", () => {
      const config1 = createDefaultConfig();
      config1.bloom.enabled = true;
      config1.bloom.multiPass = false;
      renderer.applyConfig(config1, 800, 600);

      const config2 = createDefaultConfig();
      config2.bloom.enabled = true;
      config2.bloom.multiPass = true;
      expect(() => renderer.applyConfig(config2, 800, 600)).not.toThrow();
    });

    it("从多 pass 切换到单 pass 不抛出错误", () => {
      const config1 = createDefaultConfig();
      config1.bloom.enabled = true;
      config1.bloom.multiPass = true;
      renderer.applyConfig(config1, 800, 600);

      const config2 = createDefaultConfig();
      config2.bloom.enabled = true;
      config2.bloom.multiPass = false;
      expect(() => renderer.applyConfig(config2, 800, 600)).not.toThrow();
    });
  });

  describe("applyConfig - 运动模糊", () => {
    it("启用运动模糊 - 仅音符块层", () => {
      const config = createDefaultConfig();
      config.motionBlur.enabled = true;
      config.motionBlur.layerOnly = true;
      config.motionBlur.strength = 0.5;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
      expect(noteBlockContainer.filters).not.toBeNull();
    });

    it("启用运动模糊 - 整个场景", () => {
      const config = createDefaultConfig();
      config.motionBlur.enabled = true;
      config.motionBlur.layerOnly = false;
      config.motionBlur.strength = 0.5;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
      expect(sceneContainer.filters).not.toBeNull();
    });

    it("运动模糊 strength=0 时仍应用（但不影响）", () => {
      const config = createDefaultConfig();
      config.motionBlur.enabled = true;
      config.motionBlur.strength = 0;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });
  });

  describe("applyConfig - 色差", () => {
    it("启用色差不抛出错误", () => {
      const config = createDefaultConfig();
      config.chromaticAberration.enabled = true;
      config.chromaticAberration.intensity = 0.5;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
      expect(sceneContainer.filters).not.toBeNull();
    });
  });

  describe("applyConfig - 暗角", () => {
    it("启用暗角不抛出错误", () => {
      const config = createDefaultConfig();
      config.vignette.enabled = true;
      config.vignette.intensity = 0.5;
      config.vignette.radius = 0.7;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
      expect(sceneContainer.filters).not.toBeNull();
    });
  });

  describe("applyConfig - 命中线泛光", () => {
    it("启用命中线 shader 泛光不抛出错误", () => {
      const config = createDefaultConfig();
      config.hitLineGlow.enabled = true;
      config.hitLineGlow.intensity = 0.8;
      config.hitLineGlow.radius = 15;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
      expect(hitLineContainer.filters).not.toBeNull();
    });

    it("命中线泛光只影响命中线层（不影响场景层）", () => {
      const config = createDefaultConfig();
      config.hitLineGlow.enabled = true;
      renderer.applyConfig(config, 800, 600);
      expect(hitLineContainer.filters).not.toBeNull();
      expect(sceneContainer.filters).toBeNull();
    });
  });

  describe("applyConfig - 全部启用", () => {
    it("所有效果同时启用不抛出错误", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.motionBlur.enabled = true;
      config.motionBlur.layerOnly = true;
      config.chromaticAberration.enabled = true;
      config.vignette.enabled = true;
      config.hitLineGlow.enabled = true;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
      expect(sceneContainer.filters).not.toBeNull();
      expect(noteBlockContainer.filters).not.toBeNull();
      expect(hitLineContainer.filters).not.toBeNull();
    });
  });

  describe("resize", () => {
    it("resize 不抛出错误（已应用配置）", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.chromaticAberration.enabled = true;
      config.hitLineGlow.enabled = true;
      renderer.applyConfig(config, 800, 600);
      expect(() => renderer.resize(1024, 768)).not.toThrow();
    });

    it("resize 不抛出错误（未应用配置）", () => {
      expect(() => renderer.resize(1024, 768)).not.toThrow();
    });
  });

  describe("降级模式", () => {
    it("setDegradeMode 不抛出错误", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.hitLineGlow.enabled = true;
      renderer.applyConfig(config, 800, 600);
      expect(() => renderer.setDegradeMode(true)).not.toThrow();
    });

    it("降级模式下 bloom 和 hitLineGlow 被跳过", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.hitLineGlow.enabled = true;
      renderer.applyConfig(config, 800, 600);
      renderer.setDegradeMode(true);
      expect(sceneContainer.filters).toBeNull();
      expect(hitLineContainer.filters).toBeNull();
    });

    it("从降级恢复后 bloom 和 hitLineGlow 重新启用", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.hitLineGlow.enabled = true;
      renderer.applyConfig(config, 800, 600);
      renderer.setDegradeMode(true);
      renderer.setDegradeMode(false);
      expect(sceneContainer.filters).not.toBeNull();
      expect(hitLineContainer.filters).not.toBeNull();
    });

    it("重复调用 setDegradeMode（相同状态）不重复应用配置", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      renderer.applyConfig(config, 800, 600);
      renderer.setDegradeMode(false); // 已经是 false，应直接返回
      expect(sceneContainer.filters).not.toBeNull();
    });
  });

  describe("destroy", () => {
    it("destroy 不抛出错误（无滤镜）", () => {
      expect(() => renderer.destroy()).not.toThrow();
    });

    it("destroy 不抛出错误（有滤镜）", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      config.chromaticAberration.enabled = true;
      config.vignette.enabled = true;
      config.hitLineGlow.enabled = true;
      config.motionBlur.enabled = true;
      renderer.applyConfig(config, 800, 600);
      expect(() => renderer.destroy()).not.toThrow();
    });

    it("destroy 后所有容器 filters 为 null", () => {
      const config = createDefaultConfig();
      config.bloom.enabled = true;
      renderer.applyConfig(config, 800, 600);
      renderer.destroy();
      expect(sceneContainer.filters).toBeNull();
      expect(noteBlockContainer.filters).toBeNull();
      expect(hitLineContainer.filters).toBeNull();
    });
  });

  describe("配置变化复用滤镜", () => {
    it("相同 multiPass 设置下复用 bloom 滤镜", () => {
      const config1 = createDefaultConfig();
      config1.bloom.enabled = true;
      config1.bloom.multiPass = false;
      config1.bloom.intensity = 0.3;
      renderer.applyConfig(config1, 800, 600);

      const config2 = createDefaultConfig();
      config2.bloom.enabled = true;
      config2.bloom.multiPass = false;
      config2.bloom.intensity = 0.8;
      expect(() => renderer.applyConfig(config2, 800, 600)).not.toThrow();
    });
  });
});
