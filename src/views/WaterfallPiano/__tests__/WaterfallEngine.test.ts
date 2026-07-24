import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defaultWaterfallSettings } from "../constants";
import type { WaterfallPianoSettings } from "../types";
import type { ISoundEngine } from "../audio/ISoundEngine";
import type { Application, Container, Renderer } from "pixi.js";

const fluidMock = vi.hoisted(() => ({
  instances: [] as Array<{
    start: ReturnType<typeof vi.fn>;
    splat: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    updateConfig: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@/engine/fluid", () => ({
  FluidSimulation: class MockFluidSimulation {
    start = vi.fn();
    splat = vi.fn();
    resize = vi.fn();
    destroy = vi.fn();
    update = vi.fn();
    updateConfig = vi.fn();
    setPaused = vi.fn();
    constructor() {
      fluidMock.instances.push(this);
    }
  },
  resolveConfig: () => ({ SIM_RESOLUTION: 128 }),
}));

import { WaterfallEngine } from "../engine/WaterfallEngine";
import type { WaterfallLayers } from "../engine/WaterfallEngine";
import { waterfallPianoEvents } from "../events";

function mockCanvas(): HTMLCanvasElement {
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (
          prop === "createLinearGradient" ||
          prop === "createRadialGradient"
        ) {
          return () => gradient;
        }
        if (prop === "createPattern") {
          return () => ({});
        }
        return () => {};
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    getContext: () => ctx,
    style: {},
    width: 0,
    height: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function mockContainer(): Container {
  return {
    addChild: vi.fn(),
    removeChild: vi.fn(),
    y: 0,
    label: "",
    destroy: vi.fn(),
  } as unknown as Container;
}

function mockPixiApp(): Application {
  return {
    renderer: { render: vi.fn() } as unknown as Renderer,
    canvas: mockCanvas(),
    stage: mockContainer(),
  } as unknown as Application;
}

function mockLayers(): WaterfallLayers {
  return {
    background: mockContainer(),
    fluid: mockContainer(),
    waterfall: mockContainer(),
    keyboard: mockContainer(),
  };
}

function mockSoundEngine(): ISoundEngine {
  return {
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    setSustain: vi.fn(),
    allNotesOff: vi.fn(),
    setVolume: vi.fn(),
    setVelocitySensitivity: vi.fn(),
    init: vi.fn(),
    dispose: vi.fn(),
    updateConfig: vi.fn(),
  } as unknown as ISoundEngine;
}

function cloneSettings(): WaterfallPianoSettings {
  return structuredClone(defaultWaterfallSettings);
}

describe("WaterfallEngine", () => {
  let engine: WaterfallEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    fluidMock.instances.length = 0;
    engine = new WaterfallEngine();
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
  });

  describe("生命周期", () => {
    it("init 不抛错，推进时间后 getPerformanceFps > 0", () => {
      expect(() =>
        engine.init(mockPixiApp(), mockLayers(), cloneSettings()),
      ).not.toThrow();
      expect(engine.getPerformanceFps()).toBe(0);
      vi.advanceTimersByTime(16);
      vi.advanceTimersByTime(16);
      vi.advanceTimersByTime(16);
      expect(engine.getPerformanceFps()).toBeGreaterThan(0);
    });
  });

  describe("音符触发", () => {
    it("triggerNoteOn → soundEngine.noteOn + onNoteOn 事件被触发", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      const se = mockSoundEngine();
      engine.setSoundEngine(se);
      const onNoteOnSpy = vi.fn();
      const token = waterfallPianoEvents.onNoteOn.add(onNoteOnSpy);
      engine.triggerNoteOn(60, 100);
      waterfallPianoEvents.onNoteOn.remove(token);
      expect(se.noteOn).toHaveBeenCalledWith(60, 100);
      expect(onNoteOnSpy).toHaveBeenCalledWith({ midi: 60, velocity: 100 });
    });

    it("triggerNoteOff → soundEngine.noteOff + onNoteOff 事件被触发", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      const se = mockSoundEngine();
      engine.setSoundEngine(se);
      const onNoteOffSpy = vi.fn();
      const token = waterfallPianoEvents.onNoteOff.add(onNoteOffSpy);
      engine.triggerNoteOn(60, 100);
      engine.triggerNoteOff(60);
      waterfallPianoEvents.onNoteOff.remove(token);
      expect(se.noteOff).toHaveBeenCalledWith(60);
      expect(onNoteOffSpy).toHaveBeenCalledWith({ midi: 60 });
    });
  });

  describe("延音", () => {
    it("setSustain 委托到 soundEngine", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      const se = mockSoundEngine();
      engine.setSoundEngine(se);
      engine.setSustain(true);
      expect(se.setSustain).toHaveBeenCalledWith(true);
      engine.setSustain(false);
      expect(se.setSustain).toHaveBeenCalledWith(false);
    });
  });

  describe("流体开关", () => {
    it("applySettings fluid ON → FluidSimulation 创建并 start", () => {
      const initSettings = cloneSettings();
      initSettings.background.fluidEnabled = false;
      engine.init(mockPixiApp(), mockLayers(), initSettings);
      expect(fluidMock.instances).toHaveLength(0);
      const settings = cloneSettings();
      settings.background.fluidEnabled = true;
      engine.applySettings(settings);
      expect(fluidMock.instances).toHaveLength(1);
      expect(fluidMock.instances[0].start).toHaveBeenCalled();
    });

    it("applySettings fluid OFF → destroy 调用", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      const onSettings = cloneSettings();
      onSettings.background.fluidEnabled = true;
      engine.applySettings(onSettings);
      expect(fluidMock.instances).toHaveLength(1);
      const offSettings = cloneSettings();
      offSettings.background.fluidEnabled = false;
      engine.applySettings(offSettings);
      expect(fluidMock.instances[0].destroy).toHaveBeenCalled();
    });
  });

  describe("模式切换", () => {
    it("setMode 委托到 noteBlockSystem", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      expect(engine.noteBlockSystemRef.getMode()).toBe("realtime");
      engine.setMode("synthesia");
      expect(engine.noteBlockSystemRef.getMode()).toBe("synthesia");
    });
  });

  describe("尺寸", () => {
    it("resize 不抛错", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      expect(() => engine.resize(800, 600)).not.toThrow();
    });
  });

  describe("性能监控", () => {
    it("getPerformanceFps 初始为 0，推进后 > 0", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      expect(engine.getPerformanceFps()).toBe(0);
      vi.advanceTimersByTime(16);
      vi.advanceTimersByTime(16);
      expect(engine.getPerformanceFps()).toBeGreaterThan(0);
    });
  });

  describe("清理", () => {
    it("dispose 不抛错，dispose 后推进时间不再记录帧", () => {
      engine.init(mockPixiApp(), mockLayers(), cloneSettings());
      vi.advanceTimersByTime(16);
      const fpsAfterFrame = engine.getPerformanceFps();
      expect(fpsAfterFrame).toBeGreaterThan(0);
      engine.dispose();
      vi.advanceTimersByTime(16);
      vi.advanceTimersByTime(16);
      vi.advanceTimersByTime(16);
      expect(engine.getPerformanceFps()).toBe(fpsAfterFrame);
    });
  });
});
