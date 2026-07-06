import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceMonitor } from "../engine/PerformanceMonitor";

// 测试自动降级逻辑：
// 1. 帧率持续低于 minFps 时触发降级
// 2. 帧率恢复到 targetFps 后自动恢复
// 3. 中间区间不触发任何动作

// 辅助：运行指定帧数，返回期间出现过的所有 action
function runFrames(
  monitor: PerformanceMonitor,
  fps: number,
  frames: number,
  deltaSeconds = 1 / 60,
): Set<string> {
  const actions = new Set<string>();
  for (let i = 0; i < frames; i++) {
    const action = monitor.update(fps, deltaSeconds);
    actions.add(action);
  }
  return actions;
}

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // minFps=45, targetFps=55（与 spec 一致）
    monitor = new PerformanceMonitor(45, 55);
  });

  describe("构造与配置", () => {
    it("构造不抛出错误", () => {
      expect(() => new PerformanceMonitor(45, 55)).not.toThrow();
    });

    it("初始状态未降级", () => {
      expect(monitor.isDegraded()).toBe(false);
    });

    it("setThresholds 不抛出错误", () => {
      expect(() => monitor.setThresholds(30, 50)).not.toThrow();
    });
  });

  describe("降级触发", () => {
    it("单次低帧率不触发降级", () => {
      const action = monitor.update(30, 1 / 60);
      expect(action).toBe("idle");
      expect(monitor.isDegraded()).toBe(false);
    });

    it("持续低帧率超过 3 秒触发降级", () => {
      // 200 帧 ≈ 3.33 秒，超过 3 秒阈值
      const actions = runFrames(monitor, 30, 200);
      expect(actions.has("degrade")).toBe(true);
      expect(monitor.isDegraded()).toBe(true);
    });

    it("持续低帧率 2 秒不触发降级", () => {
      const actions = runFrames(monitor, 30, 120); // 2 秒
      expect(actions.has("degrade")).toBe(false);
      expect(monitor.isDegraded()).toBe(false);
    });

    it("fps = minFps 时不触发降级（严格小于）", () => {
      const actions = runFrames(monitor, 45, 300); // 等于 minFps
      expect(actions.has("degrade")).toBe(false);
      expect(monitor.isDegraded()).toBe(false);
    });

    it("fps = minFps - 1 时触发降级", () => {
      const actions = runFrames(monitor, 44, 200);
      expect(actions.has("degrade")).toBe(true);
      expect(monitor.isDegraded()).toBe(true);
    });

    it("已降级后不再重复返回 degrade", () => {
      runFrames(monitor, 30, 200); // 触发降级
      expect(monitor.isDegraded()).toBe(true);

      // 继续低帧率，应返回 idle（不再重复 degrade）
      const actions = runFrames(monitor, 30, 100);
      expect(actions.has("degrade")).toBe(false);
      expect(actions.has("idle")).toBe(true);
    });
  });

  describe("恢复触发", () => {
    beforeEach(() => {
      // 先触发降级
      runFrames(monitor, 30, 200);
      expect(monitor.isDegraded()).toBe(true);
    });

    it("单次高帧率不触发恢复", () => {
      const action = monitor.update(60, 1 / 60);
      expect(action).toBe("idle");
      expect(monitor.isDegraded()).toBe(true);
    });

    it("持续高帧率超过 5 秒触发恢复", () => {
      // 320 帧 ≈ 5.33 秒，超过 5 秒阈值
      const actions = runFrames(monitor, 60, 320);
      expect(actions.has("recover")).toBe(true);
      expect(monitor.isDegraded()).toBe(false);
    });

    it("持续高帧率 4 秒不触发恢复", () => {
      const actions = runFrames(monitor, 60, 240); // 4 秒
      expect(actions.has("recover")).toBe(false);
      expect(monitor.isDegraded()).toBe(true);
    });

    it("fps = targetFps 时触发恢复", () => {
      const actions = runFrames(monitor, 55, 320); // 等于 targetFps
      expect(actions.has("recover")).toBe(true);
      expect(monitor.isDegraded()).toBe(false);
    });

    it("fps = targetFps - 1 时不触发恢复（中间区间）", () => {
      const actions = runFrames(monitor, 54, 500); // 中间区间
      expect(actions.has("recover")).toBe(false);
      expect(monitor.isDegraded()).toBe(true);
    });
  });

  describe("中间区间（minFps ≤ fps < targetFps）", () => {
    it("中间区间不触发任何动作", () => {
      const actions = runFrames(monitor, 50, 500); // 45 ≤ 50 < 55
      expect(actions.has("degrade")).toBe(false);
      expect(actions.has("recover")).toBe(false);
      expect(monitor.isDegraded()).toBe(false);
    });

    it("中间区间缓慢重置累计计数", () => {
      // 累计 2 秒低帧率
      runFrames(monitor, 30, 120);
      // 切换到中间区间 4 秒（缓慢重置）
      runFrames(monitor, 50, 240);
      // 再回到低帧率 2 秒，不应触发降级（计数已被重置）
      const actions = runFrames(monitor, 30, 120);
      expect(actions.has("degrade")).toBe(false);
      expect(monitor.isDegraded()).toBe(false);
    });
  });

  describe("降级与恢复交替", () => {
    it("降级后恢复，再次降级", () => {
      // 第一次降级
      let actions = runFrames(monitor, 30, 200);
      expect(actions.has("degrade")).toBe(true);
      expect(monitor.isDegraded()).toBe(true);

      // 恢复
      actions = runFrames(monitor, 60, 320);
      expect(actions.has("recover")).toBe(true);
      expect(monitor.isDegraded()).toBe(false);

      // 再次降级
      actions = runFrames(monitor, 30, 200);
      expect(actions.has("degrade")).toBe(true);
      expect(monitor.isDegraded()).toBe(true);
    });
  });

  describe("reset", () => {
    it("reset 清除所有状态", () => {
      runFrames(monitor, 30, 100);
      monitor.reset();
      expect(monitor.isDegraded()).toBe(false);

      // reset 后需要重新累计 3 秒以上才能降级
      const actions = runFrames(monitor, 30, 150); // 2.5 秒
      expect(actions.has("degrade")).toBe(false);
    });
  });

  describe("自定义阈值", () => {
    it("setThresholds 后使用新阈值", () => {
      monitor.setThresholds(30, 50);
      // minFps=30, 30 fps 不触发降级
      let actions = runFrames(monitor, 30, 200);
      expect(actions.has("degrade")).toBe(false);
      expect(monitor.isDegraded()).toBe(false);

      // 29 fps 触发降级
      actions = runFrames(monitor, 29, 200);
      expect(actions.has("degrade")).toBe(true);
    });
  });

  describe("checklist 验证：帧率低于 45fps 时自动降级生效", () => {
    it("fps < 45 持续超过 3 秒触发降级", () => {
      const actions = runFrames(monitor, 44, 200);
      expect(actions.has("degrade")).toBe(true);
      expect(monitor.isDegraded()).toBe(true);
    });

    it("帧率恢复后效果自动恢复", () => {
      // 先降级
      runFrames(monitor, 44, 200);
      expect(monitor.isDegraded()).toBe(true);

      // 恢复
      const actions = runFrames(monitor, 55, 320);
      expect(actions.has("recover")).toBe(true);
      expect(monitor.isDegraded()).toBe(false);
    });
  });
});
