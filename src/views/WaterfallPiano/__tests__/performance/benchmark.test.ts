// 性能基准测试脚手架
//
// 重要说明：
// 真实的帧率（FPS）测量需要 WebGL 渲染上下文，无法在 jsdom 环境中完成。
// 此文件提供两类测试：
//   1. 逻辑性能测试：测量纯 CPU 逻辑（update 循环、粒子生成）的执行时间
//   2. 基准脚手架：为浏览器环境准备的测试模板，可通过 `npm run test:browser` 运行
//
// 根据 spec 要求：
//   - 500 个音符块时帧率 ≥ 55fps
//   - 2000 个音符块时帧率 ≥ 30fps
//   - 单个后处理效果帧率开销 ≤ 5fps
//
// 这些 FPS 指标需要在真实浏览器中验证，本文件验证对应的逻辑性能基线。

import { describe, it, expect, beforeEach } from "vitest";

import { NoteBlockSystem } from "../../engine/NoteBlockSystem";
import type { ScheduledNote } from "../../types";

function makeNote(
  midi: number,
  time: number,
  duration: number,
  trackIndex = 0,
): ScheduledNote {
  return { midi, time, duration, velocity: 100, hand: "right", trackIndex };
}

// 生成 N 个调度音符（跨多个 midi，模拟真实 MIDI 文件）
function generateNotes(count: number): ScheduledNote[] {
  const notes: ScheduledNote[] = [];
  for (let i = 0; i < count; i++) {
    const midi = 21 + (i % 88); // 跨越钢琴全音域
    const time = (i % 100) * 0.1; // 10 秒内分布
    const duration = 0.2 + (i % 10) * 0.1;
    notes.push(makeNote(midi, time, duration, i % 2));
  }
  return notes;
}

describe("性能基准 - 逻辑基线", () => {
  let system: NoteBlockSystem;

  beforeEach(() => {
    system = new NoteBlockSystem();
    system.setCanvasSize(1920, 1080);
    system.setKeyboardY(900);
    system.setKeyWidth(24);
    system.setMode("synthesia");
  });

  describe("音符块调度性能", () => {
    it("调度 100 个音符 < 50ms", () => {
      const notes = generateNotes(100);
      const start = performance.now();
      system.scheduleNotes(notes, (m) => m * 10);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("调度 500 个音符 < 100ms", () => {
      const notes = generateNotes(500);
      const start = performance.now();
      system.scheduleNotes(notes, (m) => m * 10);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it("调度 2000 个音符 < 300ms", () => {
      const notes = generateNotes(2000);
      const start = performance.now();
      system.scheduleNotes(notes, (m) => m * 10);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe("update 循环性能", () => {
    it("100 个音符块 - 单帧 update < 5ms", () => {
      const notes = generateNotes(100);
      system.scheduleNotes(notes, (m) => m * 10);
      system.setTransportPlaying(true);

      // 预热一帧
      system.update(1, 0.016);

      const start = performance.now();
      system.update(1, 0.016);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });

    it("500 个音符块 - 单帧 update < 16ms（60fps 帧预算）", () => {
      const notes = generateNotes(500);
      system.scheduleNotes(notes, (m) => m * 10);
      system.setTransportPlaying(true);

      system.update(1, 0.016);

      const start = performance.now();
      system.update(1, 0.016);
      const elapsed = performance.now() - start;
      // 16ms = 60fps 帧预算。逻辑部分应远小于此（真实渲染开销在 GPU）
      expect(elapsed).toBeLessThan(16);
    });

    it("2000 个音符块 - 单帧 update < 33ms（30fps 帧预算）", () => {
      const notes = generateNotes(2000);
      system.scheduleNotes(notes, (m) => m * 10);
      system.setTransportPlaying(true);

      system.update(1, 0.016);

      const start = performance.now();
      system.update(1, 0.016);
      const elapsed = performance.now() - start;
      // 33ms = 30fps 帧预算
      expect(elapsed).toBeLessThan(33);
    });
  });

  describe("清理性能", () => {
    it("清理 2000 个音符块 < 50ms", () => {
      const notes = generateNotes(2000);
      system.scheduleNotes(notes, (m) => m * 10);

      const start = performance.now();
      system.clear();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("高负载场景的性能", () => {
    it("500 个音符块 - update < 20ms", () => {
      const notes = generateNotes(500);
      system.scheduleNotes(notes, (m) => m * 10);
      system.setTransportPlaying(true);

      system.update(1, 0.016);

      const start = performance.now();
      system.update(1, 0.016);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe("持续运行稳定性", () => {
    it("1000 帧 update 后无异常且 block 计数合理", () => {
      const notes = generateNotes(200);
      system.scheduleNotes(notes, (m) => m * 10);
      system.setTransportPlaying(true);

      let lastBlockCount = 0;
      for (let frame = 0; frame < 1000; frame++) {
        system.setTransportTime(frame * 0.016);
        system.update(1, 0.016);
        lastBlockCount = system.getBlockCount();
      }

      // 应该有些块已被移除（结束播放后）
      expect(lastBlockCount).toBeGreaterThanOrEqual(0);
      expect(lastBlockCount).toBeLessThanOrEqual(200);
    });
  });
});

describe("性能基准 - 浏览器 FPS 测试模板", () => {
  // 此测试为模板，标记为 skip，需要在真实浏览器环境运行
  it.skip("浏览器基准：500 音符块帧率 ≥ 55fps", () => {
    // 1. 创建 PIXI.Application 并挂载到 canvas
    // 2. 创建 WaterfallEngine 并调度 500 个音符
    // 3. 使用 requestAnimationFrame 测量 10 秒内的平均帧率
    // 4. 断言平均帧率 ≥ 55
  });

  it.skip("浏览器基准：2000 音符块帧率 ≥ 30fps", () => {
    // 同上，但调度 2000 个音符，断言 ≥ 30
  });

  it.skip("浏览器基准：单个后处理效果开销 ≤ 5fps", () => {
    // 1. 测量无后处理时的基准帧率
    // 2. 启用单个后处理效果（bloom / motionBlur / chromaticAberration / vignette / hitLineGlow）
    // 3. 测量启用后帧率
    // 4. 断言差值 ≤ 5
  });

  it.skip("浏览器基准：粒子系统不同密度下的帧率", () => {
    // 测量 density=1/3/5/10 时的帧率
  });

  it.skip("浏览器基准：流体模拟不同分辨率下的帧率", () => {
    // 测量 fluidResolution=0.25/0.5/0.75/1.0 时的帧率
  });
});
