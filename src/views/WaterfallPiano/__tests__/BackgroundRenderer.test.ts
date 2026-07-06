import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock PIXI
vi.mock("pixi.js", () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) {
      this.children.push(child);
    }
    removeChild(child: unknown) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
    }
    removeChildren() {
      this.children = [];
    }
  }
  class MockGraphics {
    clear() {}
    rect() {
      return this;
    }
    circle() {
      return this;
    }
    fill() {}
    stroke() {}
    addChild(_child: unknown) {}
    destroy() {}
  }
  class MockSprite {
    anchor = { set() {} };
    scale = { set() {} };
    width = 100;
    height = 100;
    x = 0;
    y = 0;
    tint = 0;
    alpha = 1;
    visible = true;
    texture = null;
    destroy() {}
  }
  class MockTilingSprite {
    texture = null;
    width = 0;
    height = 0;
    destroy() {}
  }
  const MockTexture = {
    from: () => ({ width: 100, height: 100 }),
    EMPTY: {},
  };
  const MockApplication = class {
    renderer = { resolution: 1 };
  };
  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    TilingSprite: MockTilingSprite,
    Texture: MockTexture,
    Application: MockApplication,
  };
});

// Mock StarfieldRenderer
vi.mock("../engine/StarfieldRenderer", () => ({
  StarfieldRenderer: class {
    setEnabled() {}
    setDensity() {}
    resize() {}
    update() {}
    setDegradeMode() {}
    destroy() {}
  },
}));

// Mock FluidRenderer
vi.mock("../engine/FluidRenderer", () => ({
  FluidRenderer: class {
    setEnabled() {}
    setResolution() {}
    resize() {}
    update() {}
    setDegradeMode() {}
    setColors() {}
    destroy() {}
  },
}));

import { BackgroundRenderer } from "../engine/BackgroundRenderer";
import type { BackgroundConfig } from "../types";
import type * as PIXI from "pixi.js";

function createMockContainer() {
  return {
    addChild: (_c: unknown) => {},
    removeChild: (_c: unknown) => {},
    removeChildren: () => {},
    children: [],
  } as unknown as PIXI.Container;
}

function createDefaultConfig(): BackgroundConfig {
  return {
    type: "gradient",
    gradientStart: "#1e1b4b",
    gradientEnd: "#0f172a",
    gradientStops: [
      { position: 0, color: "#1e1b4b" },
      { position: 1, color: "#0f172a" },
    ],
    gradientDirection: "linear-vertical",
    solidColor: "#000000",
    imageFile: "",
    imageBlur: 0,
    imageDarken: 0,
    imageFitMode: "cover",
    presetTheme: "night-sky",
    flowAnimation: false,
    flowSpeed: 0.5,
    starfieldEnabled: false,
    starfieldDensity: 1,
    fluidEnabled: false,
    fluidResolution: 0.5,
  };
}

describe("BackgroundRenderer", () => {
  let renderer: BackgroundRenderer;
  let container: PIXI.Container;

  beforeEach(() => {
    container = createMockContainer();
    renderer = new BackgroundRenderer(container);
  });

  describe("构造", () => {
    it("构造不抛出错误", () => {
      expect(() => new BackgroundRenderer(createMockContainer())).not.toThrow();
    });
  });

  describe("applyConfig - 各背景类型", () => {
    it("solid 类型不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "solid";
      config.solidColor = "#ff0000";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("gradient 类型 - 垂直方向不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "gradient";
      config.gradientDirection = "linear-vertical";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("gradient 类型 - 水平方向不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "gradient";
      config.gradientDirection = "linear-horizontal";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("gradient 类型 - 径向方向不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "gradient";
      config.gradientDirection = "radial";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("gradient 类型 - 多色 (3+) 渐变不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "gradient";
      config.gradientStops = [
        { position: 0, color: "#ff0000" },
        { position: 0.5, color: "#00ff00" },
        { position: 1, color: "#0000ff" },
      ];
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("gradient 类型 - 空 stops 时使用 gradientStart/End", () => {
      const config = createDefaultConfig();
      config.type = "gradient";
      config.gradientStops = [];
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("preset 类型 - night-sky 主题不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "preset";
      config.presetTheme = "night-sky";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("preset 类型 - ocean 主题不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "preset";
      config.presetTheme = "ocean";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("preset 类型 - sunset 主题不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "preset";
      config.presetTheme = "sunset";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("preset 类型 - aurora 主题不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "preset";
      config.presetTheme = "aurora";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("preset 类型 - forest 主题不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "preset";
      config.presetTheme = "forest";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("stars 类型不抛出错误", () => {
      const config = createDefaultConfig();
      config.type = "stars";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("fluid 类型不抛出错误（无 setApp 时）", () => {
      const config = createDefaultConfig();
      config.type = "fluid";
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("启用 starfield 不抛出错误", () => {
      const config = createDefaultConfig();
      config.starfieldEnabled = true;
      config.starfieldDensity = 2;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });

    it("启用 flowAnimation 不抛出错误", () => {
      const config = createDefaultConfig();
      config.flowAnimation = true;
      config.flowSpeed = 1.0;
      expect(() => renderer.applyConfig(config, 800, 600)).not.toThrow();
    });
  });

  describe("update", () => {
    it("update 不抛出错误", () => {
      renderer.applyConfig(createDefaultConfig(), 800, 600);
      expect(() => renderer.update(0.016, 0, 60)).not.toThrow();
    });

    it("启用 flowAnimation 后 update 不抛出错误", () => {
      const config = createDefaultConfig();
      config.flowAnimation = true;
      renderer.applyConfig(config, 800, 600);
      expect(() => renderer.update(0.016, 5, 60)).not.toThrow();
    });

    it("多次 update 累积 flowTime 不抛出错误", () => {
      const config = createDefaultConfig();
      config.flowAnimation = true;
      renderer.applyConfig(config, 800, 600);
      for (let i = 0; i < 100; i++) {
        renderer.update(0.016, 5, 60);
      }
    });
  });

  describe("resize", () => {
    it("resize 后配置仍然有效（不抛出错误）", () => {
      renderer.applyConfig(createDefaultConfig(), 800, 600);
      expect(() => renderer.resize(1024, 768)).not.toThrow();
    });

    it("未应用配置时 resize 不抛出错误", () => {
      expect(() => renderer.resize(1024, 768)).not.toThrow();
    });
  });

  describe("降级模式", () => {
    it("setDegradeMode 不抛出错误", () => {
      expect(() => renderer.setDegradeMode(true)).not.toThrow();
      expect(() => renderer.setDegradeMode(false)).not.toThrow();
    });

    it("降级模式下启用 flowAnimation update 不应用流动效果", () => {
      const config = createDefaultConfig();
      config.flowAnimation = true;
      renderer.applyConfig(config, 800, 600);
      renderer.setDegradeMode(true);
      expect(() => renderer.update(0.016, 5, 30)).not.toThrow();
    });
  });

  describe("setApp（流体渲染）", () => {
    it("setApp 不抛出错误", () => {
      const mockApp = {
        renderer: { resolution: 1 },
      } as unknown as PIXI.Application;
      expect(() => renderer.setApp(mockApp)).not.toThrow();
    });

    it("setApp 后重新应用配置不抛出错误", () => {
      const mockApp = {
        renderer: { resolution: 1 },
      } as unknown as PIXI.Application;
      renderer.applyConfig(createDefaultConfig(), 800, 600);
      expect(() => renderer.setApp(mockApp)).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("destroy 不抛出错误", () => {
      renderer.applyConfig(createDefaultConfig(), 800, 600);
      expect(() => renderer.destroy()).not.toThrow();
    });

    it("未应用配置时 destroy 不抛出错误", () => {
      expect(() => renderer.destroy()).not.toThrow();
    });
  });
});
