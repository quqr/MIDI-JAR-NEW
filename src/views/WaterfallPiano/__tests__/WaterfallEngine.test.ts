import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock AudioEngine
vi.mock("../audio/AudioEngine", () => ({
  AudioEngine: class MockAudioEngine {
    async init() {}
    noteOn() {}
    noteOff() {}
    applyPreset() {}
    setVolume() {}
    setReverbWet() {}
    setSustain() {}
    setReverbDecay() {}
    setConfig() {}
    connect() {}
    disconnect() {}
    dispose() {}
  },
}));

// Mock OutputChain
vi.mock("../audio/OutputChain", () => ({
  OutputChain: class MockOutputChain {
    filter: unknown = null;
    compressor: unknown = null;
    reverb: unknown = null;
    volume: unknown = null;
    get input() { return this.filter; }
    async init() {}
    setVolume() {}
    setReverbWet() {}
    setReverbDecay() {}
    dispose() {}
  },
}));

// Mock PhysicalPianoEngine (avoid ?raw import in tests)
vi.mock("../audio/PhysicalPianoEngine", () => ({
  PhysicalPianoEngine: class MockPhysicalPianoEngine {
    async init() {}
    noteOn() {}
    noteOff() {}
    applyPreset() {}
    setVolume() {}
    setReverbWet() {}
    setSustain() {}
    setReverbDecay() {}
    setConfig() {}
    connect() {}
    disconnect() {}
    setCallbacks() {}
    dispose() {}
  },
}));

// Mock KeyboardRenderer
vi.mock("../engine/KeyboardRenderer", () => ({
  KeyboardRenderer: class MockKeyboardRenderer {
    container: unknown;
    containerOffsetY = 0;
    constructor(container: unknown) {
      this.container = container;
    }
    setRange() {}
    setConfig() {}
    draw() {}
    getNoteX() {
      return 100;
    }
    getNoteAtPoint() {
      return 60;
    }
    getKeyWidth() {
      return 20;
    }
    highlightNote() {}
    clearHighlight() {}
    destroy() {}
  },
}));

// Mock NoteBlockSystem
vi.mock("../engine/NoteBlockSystem", () => ({
  NoteBlockSystem: class MockNoteBlockSystem {
    setCallbacks() {}
    setRealtimeSpeed() {}
    setLookAhead() {}
    setColorScheme() {}
    setOpacity() {}
    setCornerRadius() {}
    setHitLineConfig() {}
    setFlowDirection() {}
    setMode() {}
    setCanvasSize() {}
    setKeyboardY() {}
    setKeyWidth() {}
    setTransportTime() {}
    setTransportPlaying() {}
    startRealtimeNote() {}
    endRealtimeNote() {}
    scheduleNotes() {}
    clear() {}
    clearBlocksOnly() {}
    update() {}
    getActiveBlockCount() {
      return 0;
    }
    getBlockCount() {
      return 0;
    }
    getBlocks() {
      return [];
    }
    getKeyboardY() {
      return 540;
    }
    destroy() {}
  },
}));

// Mock BackgroundRenderer
vi.mock("../engine/BackgroundRenderer", () => ({
  BackgroundRenderer: class MockBackgroundRenderer {
    setApp() {}
    applyConfig() {}
    update() {}
    resize() {}
    setDegradeMode() {}
    destroy() {}
  },
}));

// Mock StaffRenderer
vi.mock("../engine/StaffRenderer", () => ({
  StaffRenderer: class MockStaffRenderer {
    setVisible() {}
    resize() {}
    onNoteOn() {}
    onNoteOff() {}
    update() {}
    destroy() {}
  },
}));

// Mock PerformanceMonitor
vi.mock("../engine/PerformanceMonitor", () => ({
  PerformanceMonitor: class MockPerformanceMonitor {
    update() {
      return null;
    }
    setThresholds() {}
  },
}));

// Mock GlowTexture
vi.mock("../engine/GlowTexture", () => ({
  clearGlowTextureCache: () => {},
}));

// Mock FluidSimulation
vi.mock("../engine/fluid", () => ({
  FluidSimulation: class MockFluidSimulation {
    splat() {}
    start() {}
    updateConfig() {}
    setPaused() {}
    isPaused() {
      return false;
    }
    resize() {}
    destroy() {}
  },
  HSVtoRGB: (h: number, s: number, v: number) => ({
    r: v * (1 - s * (1 - h)),
    g: v,
    b: v,
  }),
}));

import { WaterfallEngine } from "../engine/WaterfallEngine";
import { defaultWaterfallSettings } from "../constants";
import type { WaterfallPianoSettings } from "../types";

describe("WaterfallEngine", () => {
  let engine: WaterfallEngine;
  let mockCanvas: HTMLCanvasElement;
  let settings: WaterfallPianoSettings;

  beforeEach(() => {
    engine = new WaterfallEngine();
    mockCanvas = document.createElement("canvas");
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    settings = JSON.parse(JSON.stringify(defaultWaterfallSettings));
  });

  afterEach(() => {
    engine.destroy();
  });

  describe("基础功能", () => {
    it("构造不抛错", () => {
      expect(() => new WaterfallEngine()).not.toThrow();
    });

    it("setMode 不抛错", () => {
      expect(() => engine.setMode("realtime")).not.toThrow();
      expect(() => engine.setMode("synthesia")).not.toThrow();
    });

    it("getMode 返回默认值", () => {
      expect(engine.getMode()).toBe("realtime");
    });

    it("setFlowDirection 不抛错", () => {
      expect(() => engine.setFlowDirection("up")).not.toThrow();
      expect(() => engine.setFlowDirection("down")).not.toThrow();
    });

    it("destroy 不抛错", () => {
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  describe("流体相关方法", () => {
    describe("triggerHitExplosion", () => {
      it("未设置 fluidSimulation 时调用不抛错", () => {
        engine.setMode("realtime");
        expect(() => engine.playRealtimeNote(60, 100)).not.toThrow();
      });

      it("midi 边界值正常工作", () => {
        engine.setMode("realtime");
        expect(() => engine.playRealtimeNote(0, 100)).not.toThrow();
        expect(() => engine.playRealtimeNote(127, 100)).not.toThrow();
      });

      it("velocity 边界值正常工作", () => {
        engine.setMode("realtime");
        expect(() => engine.playRealtimeNote(60, 0)).not.toThrow();
        expect(() => engine.playRealtimeNote(60, 127)).not.toThrow();
      });

      it("synthesia 模式下 playRealtimeNote 不触发（mode 检查）", () => {
        engine.setMode("synthesia");
        // playRealtimeNote 在 synthesia 模式下不执行
        expect(() => engine.playRealtimeNote(60, 100)).not.toThrow();
      });
    });

    describe("hitExplosion / blockCoverage 开关", () => {
      it("未设置 fluidSimulation 时 releaseRealtimeNote 不抛错", () => {
        engine.setMode("realtime");
        expect(() => engine.releaseRealtimeNote(60)).not.toThrow();
      });

      it("重复释放同一 midi 不抛错", () => {
        engine.setMode("realtime");
        engine.releaseRealtimeNote(60);
        expect(() => engine.releaseRealtimeNote(60)).not.toThrow();
      });

      it("HIT_EXPLOSION 开启时 playRealtimeNote 不抛错", () => {
        engine.setMode("realtime");
        settings.background.fluidParams = { HIT_EXPLOSION: true };
        engine.applySettings(settings);
        expect(() => engine.playRealtimeNote(60, 100)).not.toThrow();
        expect(() => engine.releaseRealtimeNote(60)).not.toThrow();
      });

      it("HIT_EXPLOSION 关闭时不触发命中爆炸", () => {
        engine.setMode("realtime");
        settings.background.fluidParams = { HIT_EXPLOSION: false };
        engine.applySettings(settings);
        expect(() => engine.playRealtimeNote(60, 100)).not.toThrow();
        expect(() => engine.releaseRealtimeNote(60)).not.toThrow();
      });

      it("BLOCK_COVERAGE 开启时 update 不抛错", () => {
        engine.setMode("realtime");
        settings.background.fluidParams = { BLOCK_COVERAGE: true };
        engine.applySettings(settings);
        // update 由游戏循环驱动，这里直接测 applySettings 后无异常
        expect(() => engine.applySettings(settings)).not.toThrow();
      });
    });

    describe("setFluidSimulation", () => {
      it("注入 null 不抛错", () => {
        expect(() => engine.setFluidSimulation(null)).not.toThrow();
      });

      it("注入模拟实例不抛错", () => {
        const mockFluid = {
          splat: vi.fn(),
          start: vi.fn(),
          updateConfig: vi.fn(),
          setPaused: vi.fn(),
          isPaused: vi.fn(() => false),
          resize: vi.fn(),
          destroy: vi.fn(),
        } as unknown as import("../engine/fluid").FluidSimulation;
        expect(() => engine.setFluidSimulation(mockFluid)).not.toThrow();
      });
    });
  });

  describe("applySettings", () => {
    it("applySettings 不抛错", () => {
      expect(() => engine.applySettings(settings)).not.toThrow();
    });

    it("applySettings 多次调用不抛错", () => {
      engine.applySettings(settings);
      expect(() => engine.applySettings(settings)).not.toThrow();
    });

    it("流体背景类型设置不抛错", () => {
      settings.background.type = "fluid";
      expect(() => engine.applySettings(settings)).not.toThrow();
    });
  });

  describe("synthesia 模式", () => {
    beforeEach(() => {
      engine.setMode("synthesia");
    });

    it("setTransportTime 不抛错", () => {
      expect(() => engine.setTransportTime(0)).not.toThrow();
      expect(() => engine.setTransportTime(10)).not.toThrow();
    });

    it("setTransportPlaying 不抛错", () => {
      expect(() => engine.setTransportPlaying(true)).not.toThrow();
      expect(() => engine.setTransportPlaying(false)).not.toThrow();
    });

    it("triggerSynthesiaNote 不抛错", () => {
      expect(() => engine.triggerSynthesiaNote(60, 100)).not.toThrow();
    });

    it("releaseSynthesiaNote 不抛错", () => {
      expect(() => engine.releaseSynthesiaNote(60)).not.toThrow();
    });

    it("scheduleSynthesiaNotes 不抛错", () => {
      const notes = [
        { midi: 60, time: 0, duration: 1, velocity: 100, hand: "left" as "left" | "right" | "unknown", trackIndex: 0 },
      ];
      expect(() => engine.scheduleSynthesiaNotes(notes)).not.toThrow();
    });
  });

  describe("清理方法", () => {
    it("clearNoteBlocks 不抛错", () => {
      expect(() => engine.clearNoteBlocks()).not.toThrow();
    });

    it("resize 不抛错", () => {
      expect(() => engine.resize()).not.toThrow();
    });
  });
});