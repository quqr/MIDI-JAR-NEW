import { describe, it, expect, beforeEach } from "vitest";

import { NoteBlockSystem } from "../engine/NoteBlockSystem";
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

describe("NoteBlockSystem", () => {
  let system: NoteBlockSystem;

  beforeEach(() => {
    system = new NoteBlockSystem();
    system.setCanvasSize(800, 600);
    system.setKeyboardY(500);
    system.setKeyWidth(20);
  });

  describe("构造与配置", () => {
    it("构造不抛出错误", () => {
      expect(() => new NoteBlockSystem()).not.toThrow();
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

    // ─── 新增测试：endRealtimeNote ───
    describe("endRealtimeNote 边界条件", () => {
      it("midi 超出范围时不抛错", () => {
        expect(() => system.endRealtimeNote(-1)).not.toThrow();
        expect(() => system.endRealtimeNote(200)).not.toThrow();
      });

      it("blocks 数组为空时不抛错", () => {
        expect(system.getBlockCount()).toBe(0);
        expect(() => system.endRealtimeNote(60)).not.toThrow();
        expect(system.getBlockCount()).toBe(0);
      });

      it("重复释放同一 midi 不抛错", () => {
        system.startRealtimeNote(60, 100, 100);
        system.endRealtimeNote(60);
        expect(() => system.endRealtimeNote(60)).not.toThrow();
        expect(system.getActiveBlockCount()).toBe(0);
      });

      it("正常释放设置 endTime 和 hasEnded", () => {
        system.startRealtimeNote(60, 100, 100);
        // const beforeEnd = performance.now(); // unused variable
        system.endRealtimeNote(60);
        // 通过 update 循环后验证块状态（间接验证）
        system.update(1, 0.016);
        // endTime 应接近当前时间，hasEnded 应为 true
        expect(system.getActiveBlockCount()).toBe(0);
      });
    });

    // ─── 新增测试：startRealtimeNote ───
    describe("startRealtimeNote 边界验证", () => {
      it("velocity 为 0 时仍能创建块", () => {
        system.startRealtimeNote(60, 100, 0);
        expect(system.getBlockCount()).toBe(1);
      });

      it("velocity 为 127 时能创建块", () => {
        system.startRealtimeNote(60, 100, 127);
        expect(system.getBlockCount()).toBe(1);
      });

      it("重复激活同一 midi 创建多个块（允许复音）", () => {
        system.startRealtimeNote(60, 100, 100);
        system.startRealtimeNote(60, 100, 100);
        expect(system.getBlockCount()).toBe(2);
      });

      it("x 坐标可以是任意值（由外部计算）", () => {
        system.startRealtimeNote(60, -100, 100);
        expect(system.getBlockCount()).toBe(1);
        system.startRealtimeNote(60, 10000, 100);
        expect(system.getBlockCount()).toBe(2);
      });
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

    it("启用视觉特性后 update 不抛出错误", () => {
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

  describe("hitLineConfig", () => {
    it("setHitLineConfig 不抛出错误", () => {
      expect(() =>
        system.setHitLineConfig({
          color: "#ff0000",
          thickness: 3,
          visible: true,
        }),
      ).not.toThrow();
    });

    it("隐藏命中线时 update 不抛出错误", () => {
      system.setHitLineConfig({
        color: "#ffffff",
        thickness: 2,
        visible: false,
      });
      expect(() => system.update(1, 0.016)).not.toThrow();
    });
  });

  describe("getBlocks / getKeyboardY", () => {
    it("getBlocks 返回只读块数组", () => {
      expect(system.getBlocks()).toEqual([]);
      system.startRealtimeNote(60, 100, 100);
      expect(system.getBlocks().length).toBe(1);
    });

    it("getKeyboardY 返回键盘 y 坐标", () => {
      system.setKeyboardY(540);
      expect(system.getKeyboardY()).toBe(540);
    });
  });
});
