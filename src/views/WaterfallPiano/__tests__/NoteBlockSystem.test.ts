import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock PIXI 以避免 jsdom 环境下 WebGL 不可用
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
    circle() {
      return this;
    }
    rect() {
      return this;
    }
    roundRect() {
      return this;
    }
    ellipse() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    closePath() {
      return this;
    }
    fill() {}
    stroke() {}
    addChild(_child: unknown) {}
    destroy() {}
  }
  class MockText {
    anchor = { set() {} };
    resolution = 1;
    x = 0;
    y = 0;
    alpha = 1;
    visible = true;
    style: unknown = null;
    destroy() {}
  }
  class MockSprite {
    anchor = { set() {} };
    scale = { set() {} };
    x = 0;
    y = 0;
    tint = 0;
    alpha = 1;
    visible = true;
    texture = null;
    destroy() {}
  }
  const MockTexture = {
    from: () => ({}),
    EMPTY: {},
  };
  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    Texture: MockTexture,
  };
});

// Mock ParticleSystem 以隔离 NoteBlockSystem 测试
vi.mock("../engine/ParticleSystem", () => {
  return {
    ParticleSystem: class {
      setTrailConfig() {}
      setHitConfig() {}
      setPhysicsConfig() {}
      setShape() {}
      setUseGlowTexture() {}
      setLifecycleEnabled() {}
      setHardLimit() {}
      setDegradeMode() {}
      spawnTrail() {}
      spawnHitExplosion() {}
      spawnSurfaceEmission() {}
      update() {}
      clear() {}
      destroy() {}
    },
  };
});

// Mock GlowTexture
vi.mock("../engine/GlowTexture", () => ({
  getGlowTexture: () => ({}),
  getStarTexture: () => ({}),
  clearGlowTextureCache: () => {},
  lifecycleCurve: (t: number) =>
    Math.sin(Math.PI * Math.max(0, Math.min(1, t))),
  lifecyclePeaked: (t: number, peak = 0.3) => {
    const x = Math.max(0, Math.min(1, t));
    if (x < peak) return x / peak;
    return 1 - (x - peak) / (1 - peak);
  },
}));

import { NoteBlockSystem } from "../engine/NoteBlockSystem";
import type * as PIXI from "pixi.js";
import type { ScheduledNote } from "../types";

// 辅助：构建 ScheduledNote
function makeNote(
  midi: number,
  time: number,
  duration: number,
  hand: "left" | "right" = "right",
  trackIndex = 0,
): ScheduledNote {
  return { midi, time, duration, velocity: 100, hand, trackIndex };
}

// 辅助：创建 mock 容器
function createMockContainer() {
  return {
    addChild: (_c: unknown) => {},
    removeChild: (_c: unknown) => {},
    removeChildren: () => {},
    children: [],
  } as unknown as PIXI.Container;
}

describe("NoteBlockSystem", () => {
  let system: NoteBlockSystem;
  let blockContainer: PIXI.Container;
  let hitLineContainer: PIXI.Container;

  beforeEach(() => {
    blockContainer = createMockContainer();
    hitLineContainer = createMockContainer();
    system = new NoteBlockSystem(blockContainer, hitLineContainer);
    system.setCanvasSize(800, 600);
    system.setKeyboardY(500);
    system.setKeyWidth(20);
  });

  describe("构造与配置", () => {
    it("构造不抛出错误", () => {
      expect(
        () => new NoteBlockSystem(createMockContainer(), createMockContainer()),
      ).not.toThrow();
    });

    it("setMode 不抛出错误", () => {
      expect(() => system.setMode("realtime")).not.toThrow();
      expect(() => system.setMode("synthesia")).not.toThrow();
    });

    it("setCanvasSize 不抛出错误", () => {
      expect(() => system.setCanvasSize(1024, 768)).not.toThrow();
    });

    it("setKeyWidth 不抛出错误", () => {
      expect(() => system.setKeyWidth(30)).not.toThrow();
    });

    it("setLookAhead 调整 fallSpeed（通过不抛错验证）", () => {
      expect(() => system.setLookAhead(5)).not.toThrow();
    });

    it("setStyle 不抛出错误", () => {
      expect(() => system.setStyle("blocks")).not.toThrow();
      expect(() => system.setStyle("hybrid")).not.toThrow();
      expect(() => system.setStyle("particles")).not.toThrow();
    });

    it("setColorScheme 不抛出错误", () => {
      for (const scheme of [
        "pitch",
        "hands",
        "warm",
        "cool",
        "rainbow",
        "neon",
      ] as const) {
        expect(() => system.setColorScheme(scheme)).not.toThrow();
      }
    });

    it("setFlowDirection 不抛出错误", () => {
      expect(() => system.setFlowDirection("up")).not.toThrow();
      expect(() => system.setFlowDirection("down")).not.toThrow();
    });

    it("setShowNoteNames 不抛出错误", () => {
      expect(() => system.setShowNoteNames(true)).not.toThrow();
      expect(() => system.setShowNoteNames(false)).not.toThrow();
    });

    it("setDegradeMode 不抛出错误", () => {
      expect(() => system.setDegradeMode(true)).not.toThrow();
      expect(() => system.setDegradeMode(false)).not.toThrow();
    });
  });

  describe("实时模式 - 音符块创建", () => {
    it("startRealtimeNote 增加 block 计数", () => {
      expect(system.getBlockCount()).toBe(0);
      system.startRealtimeNote(60, 100, 100);
      expect(system.getBlockCount()).toBe(1);
    });

    it("多次 startRealtimeNote 创建多个块", () => {
      system.startRealtimeNote(60, 100, 100);
      system.startRealtimeNote(62, 120, 100);
      system.startRealtimeNote(64, 140, 100);
      expect(system.getBlockCount()).toBe(3);
    });

    it("白键音符块使用 keyWidth 宽度", () => {
      system.setKeyWidth(40);
      system.startRealtimeNote(60, 100, 100); // C4 = 白键
      expect(system.getBlockCount()).toBe(1);
    });

    it("黑键音符块使用 blackKeyWidth 宽度", () => {
      system.setKeyWidth(40);
      system.startRealtimeNote(61, 100, 100); // C#4 = 黑键
      expect(system.getBlockCount()).toBe(1);
    });

    it("endRealtimeNote 标记块为非活跃", () => {
      system.startRealtimeNote(60, 100, 100);
      expect(system.getActiveBlockCount()).toBe(1);
      system.endRealtimeNote(60);
      expect(system.getActiveBlockCount()).toBe(0);
    });

    it("endRealtimeNote 只影响指定 midi 的活跃块", () => {
      system.startRealtimeNote(60, 100, 100);
      system.startRealtimeNote(64, 200, 100);
      system.endRealtimeNote(60);
      expect(system.getActiveBlockCount()).toBe(1);
    });
  });

  describe("Synthesia 模式 - 调度音符", () => {
    beforeEach(() => {
      system.setMode("synthesia");
    });

    it("scheduleNotes 添加调度块", () => {
      const notes = [makeNote(60, 0, 1)];
      const getX = (midi: number) => midi * 10;
      system.scheduleNotes(notes, getX);
      expect(system.getBlockCount()).toBe(1);
    });

    it("scheduleNotes 多个音符全部添加", () => {
      const notes = [
        makeNote(60, 0, 1),
        makeNote(62, 0.5, 1),
        makeNote(64, 1, 1, "left", 1),
      ];
      system.scheduleNotes(notes, (m) => m * 10);
      expect(system.getBlockCount()).toBe(3);
    });

    it("scheduleNotes 跳过 x < 0 的音符", () => {
      const notes = [makeNote(60, 0, 1)];
      system.scheduleNotes(notes, () => -1);
      expect(system.getBlockCount()).toBe(0);
    });
  });

  describe("Synthesia 模式 - 触发回调", () => {
    beforeEach(() => {
      system.setMode("synthesia");
    });

    it("transportTime 达到 hitTime 时触发 onNoteTrigger", () => {
      const triggered: number[] = [];
      system.setCallbacks({
        onNoteTrigger: (midi) => triggered.push(midi),
      });
      system.scheduleNotes([makeNote(60, 1, 1)], () => 100);
      system.setTransportPlaying(true);
      system.setTransportTime(1.0);
      system.update(1, 0.016);
      expect(triggered).toContain(60);
    });

    it("transportTime 达到 endTime 时触发 onNoteEnd", () => {
      const ended: number[] = [];
      system.setCallbacks({
        onNoteEnd: (midi) => ended.push(midi),
      });
      system.scheduleNotes([makeNote(60, 1, 1)], () => 100);
      system.setTransportPlaying(true);
      system.setTransportTime(2.5); // endTime = 1 + 1 = 2
      system.update(1, 0.016);
      expect(ended).toContain(60);
    });

    it("未开始 transport 不触发回调", () => {
      const triggered: number[] = [];
      system.setCallbacks({
        onNoteTrigger: (midi) => triggered.push(midi),
      });
      system.scheduleNotes([makeNote(60, 0, 1)], () => 100);
      system.setTransportPlaying(false);
      system.setTransportTime(5);
      system.update(1, 0.016);
      expect(triggered.length).toBe(0);
    });
  });

  describe("清理", () => {
    it("clear 重置 block 计数", () => {
      system.startRealtimeNote(60, 100, 100);
      system.startRealtimeNote(62, 120, 100);
      expect(system.getBlockCount()).toBe(2);
      system.clear();
      expect(system.getBlockCount()).toBe(0);
    });

    it("clearBlocksOnly 重置 block 计数", () => {
      system.startRealtimeNote(60, 100, 100);
      expect(system.getBlockCount()).toBe(1);
      system.clearBlocksOnly();
      expect(system.getBlockCount()).toBe(0);
    });

    it("destroy 不抛出错误", () => {
      system.startRealtimeNote(60, 100, 100);
      expect(() => system.destroy()).not.toThrow();
    });
  });

  describe("update 循环", () => {
    it("实时模式 update 不抛出错误", () => {
      system.setMode("realtime");
      system.startRealtimeNote(60, 100, 100);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });

    it("Synthesia 模式 update 不抛出错误", () => {
      system.setMode("synthesia");
      system.scheduleNotes([makeNote(60, 0, 1)], () => 100);
      system.setTransportPlaying(true);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });

    it("空场景 update 不抛出错误", () => {
      expect(() => system.update(1, 0.016)).not.toThrow();
    });

    it("启用所有视觉特性后 update 不抛出错误", () => {
      system.setStyle("blocks");
      system.setShowNoteNames(true);
      system.setTrailEnabled(true);
      system.startRealtimeNote(60, 100, 100);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });
  });

  describe("流动方向", () => {
    it("向下流动 - update 不抛出错误", () => {
      system.setMode("synthesia");
      system.setFlowDirection("down");
      system.scheduleNotes([makeNote(60, 0, 1)], () => 100);
      system.setTransportPlaying(true);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });

    it("向上流动 - update 不抛出错误", () => {
      system.setMode("synthesia");
      system.setFlowDirection("up");
      system.scheduleNotes([makeNote(60, 0, 1)], () => 100);
      system.setTransportPlaying(true);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });
  });

  describe("降级模式", () => {
    it("启用降级模式后 update 不抛出错误", () => {
      system.setMode("realtime");
      system.setDegradeMode(true);
      system.startRealtimeNote(60, 100, 100);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });

    it("降级模式下 Synthesia update 不抛出错误", () => {
      system.setMode("synthesia");
      system.setDegradeMode(true);
      system.scheduleNotes([makeNote(60, 0, 1)], () => 100);
      system.setTransportPlaying(true);
      expect(() => system.update(1, 0.016)).not.toThrow();
    });
  });

  describe("hitLineConfig", () => {
    it("setHitLineConfig 不抛出错误", () => {
      expect(() =>
        system.setHitLineConfig({
          color: "#ff0000",
          glow: true,
          thickness: 3,
          glowRadius: 20,
          glowIntensity: 0.5,
          style: "dashed",
          visible: true,
          shaderGlow: false,
        }),
      ).not.toThrow();
    });

    it("隐藏命中线时 update 不抛出错误", () => {
      system.setHitLineConfig({
        color: "#ffffff",
        glow: true,
        thickness: 2,
        glowRadius: 15,
        glowIntensity: 0.8,
        style: "solid",
        visible: false,
        shaderGlow: false,
      });
      expect(() => system.update(1, 0.016)).not.toThrow();
    });
  });
});
