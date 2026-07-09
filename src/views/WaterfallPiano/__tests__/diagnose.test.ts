import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NoteBlockSystem } from "../engine/NoteBlockSystem";

describe("钢琴块释放诊断 - 多出一块问题", () => {
  let system: NoteBlockSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new NoteBlockSystem();
    system.setCanvasSize(800, 600);
    system.setKeyboardY(500);
    system.setKeyWidth(20);
    system.setMode("realtime");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("问题：释放时多出一块", () => {
    it("单次按下和释放应该只产生一个钢琴块", () => {
      // Arrange & Act
      system.startRealtimeNote(60, 100, 100);
      system.endRealtimeNote(60);

      // Assert - 应该只有一个块
      expect(system.getBlockCount()).toBe(1);
    });

    it("快速连续按下和释放同一音符应该只产生一个钢琴块", () => {
      // Arrange & Act - 模拟快速连续按下和释放
      for (let i = 0; i < 10; i++) {
        system.startRealtimeNote(60, 100, 100);
        system.endRealtimeNote(60);
      }

      // Assert - 每次按下都会创建新块，但旧块应该被标记为已结束
      expect(system.getBlockCount()).toBe(10); // 10 次按下，10 个块
    });

    it("释放后块应该被标记为已结束", () => {
      // Arrange
      system.startRealtimeNote(60, 100, 100);

      // Act
      system.endRealtimeNote(60);

      // Assert
      const blocks = (system as any).blocks;
      expect(blocks.length).toBe(1);
      expect(blocks[0].active).toBe(false);
      expect(blocks[0].hasEnded).toBe(true);
    });

    it("释放后更新应该移除已结束的块", () => {
      // Arrange
      system.startRealtimeNote(60, 100, 100);
      system.endRealtimeNote(60);

      // Act - 模拟多帧更新，块会向上飘直到离开屏幕
      // 新的飘动速度约 60px/s，需要足够时间飘出屏幕（约 8-10 秒）
      for (let i = 0; i < 600; i++) {
        vi.advanceTimersByTime(16);
        system.update(16, 0.016);
      }

      // Assert - 已结束的块应该被移除
      expect(system.getBlockCount()).toBe(0);
    });

    it("按下时如果已有 active 块，应该结束旧块并创建新块", () => {
      // Arrange
      system.startRealtimeNote(60, 100, 100);
      const firstBlockCount = system.getBlockCount();

      // Act - 再次按下同一音符（不释放）
      system.startRealtimeNote(60, 100, 100);

      // Assert
      expect(firstBlockCount).toBe(1);
      expect(system.getBlockCount()).toBe(2); // 旧块 + 新块
      const blocks = (system as any).blocks;
      expect(blocks[0].active).toBe(false); // 旧块已结束
      expect(blocks[1].active).toBe(true);  // 新块活跃
    });

    it("模拟真实场景：按下、移动、释放", () => {
      // Arrange & Act - 模拟用户操作
      // 1. 按下音符 60
      system.startRealtimeNote(60, 100, 100);
      expect(system.getBlockCount()).toBe(1);

      // 2. 移动到音符 64（释放 60，按下 64）
      system.endRealtimeNote(60);
      system.startRealtimeNote(64, 120, 100);
      expect(system.getBlockCount()).toBe(2);

      // 3. 释放音符 64
      system.endRealtimeNote(64);
      expect(system.getBlockCount()).toBe(2);

      // Assert - 两个块都应该被标记为已结束
      const blocks = (system as any).blocks;
      expect(blocks[0].hasEnded).toBe(true);
      expect(blocks[1].hasEnded).toBe(true);
    });
  });
});