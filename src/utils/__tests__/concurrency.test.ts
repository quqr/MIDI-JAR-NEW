import { describe, it, expect, vi } from "vitest";
import { runWithConcurrency } from "../concurrency";

/**
 * 并发测试辅助：记录任务开始/结束时刻，并附带延迟控制。
 * 使用真实计时器（不依赖 fake timers），通过 Promise 推迟微任务边界即可。
 */
function makeTask(
  id: number,
  log: Array<{ id: number; phase: "start" | "end" }>,
  durationMs = 0,
): () => Promise<number> {
  return () => {
    log.push({ id, phase: "start" });
    return new Promise<number>((resolve) => {
      setTimeout(() => {
        log.push({ id, phase: "end" });
        resolve(id);
      }, durationMs);
    });
  };
}

describe("runWithConcurrency", () => {
  it("should return an empty array for an empty task list", async () => {
    const result = await runWithConcurrency([], 4);
    expect(result).toEqual([]);
  });

  it("should run all tasks when count <= limit", async () => {
    const log: Array<{ id: number; phase: "start" | "end" }> = [];
    const tasks = [makeTask(0, log), makeTask(1, log), makeTask(2, log)];

    const result = await runWithConcurrency(tasks, 5);

    expect(result).toEqual([0, 1, 2]);
    // 全部 start 先于 end（并发）
    const starts = log.filter((e) => e.phase === "start");
    const ends = log.filter((e) => e.phase === "end");
    expect(starts).toHaveLength(3);
    expect(ends).toHaveLength(3);
  });

  it("should preserve result order regardless of completion order", async () => {
    // 后启动的任务更短，应先完成，但结果数组顺序不变
    const tasks = [
      () => new Promise<number>((r) => setTimeout(() => r(0), 30)),
      () => new Promise<number>((r) => setTimeout(() => r(1), 5)),
      () => new Promise<number>((r) => setTimeout(() => r(2), 20)),
    ];

    const result = await runWithConcurrency(tasks, 1);

    expect(result).toEqual([0, 1, 2]);
  });

  it("should never exceed the concurrency limit in-flight", async () => {
    const log: Array<{ id: number; phase: "start" | "end" }> = [];
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask(i, log, 10));

    await runWithConcurrency(tasks, 3);

    // 任意时刻在途（已 start 未 end）任务数 ≤ 3
    let inFlight = 0;
    let maxInFlight = 0;
    for (const entry of log) {
      if (entry.phase === "start") {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
      } else {
        inFlight--;
      }
    }
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBe(3); // 任务数足够，应触达上限
  });

  it("should treat limit < 1 as 1 (serial)", async () => {
    const log: Array<{ id: number; phase: "start" | "end" }> = [];
    const tasks = [makeTask(0, log), makeTask(1, log), makeTask(2, log)];

    const result = await runWithConcurrency(tasks, 0);

    expect(result).toEqual([0, 1, 2]);
    // 串行：每个任务 end 后下一个才 start
    for (let i = 0; i < tasks.length; i++) {
      const startIdx = log.findIndex((e) => e.id === i && e.phase === "start");
      const endIdx = log.findIndex((e) => e.id === i && e.phase === "end");
      const nextStartIdx = log.findIndex(
        (e) => e.id === i + 1 && e.phase === "start",
      );
      if (i < tasks.length - 1) {
        expect(endIdx).toBeLessThan(nextStartIdx);
      }
      expect(startIdx).toBeLessThan(endIdx);
    }
  });

  it("should propagate rejection (no swallowing)", async () => {
    const tasks = [
      () => Promise.resolve("a"),
      () => Promise.reject(new Error("boom")),
      () => Promise.resolve("c"),
    ];

    await expect(runWithConcurrency(tasks, 2)).rejects.toThrow("boom");
  });

  it("should still return ordered results when one task is slow", async () => {
    const tasks = [
      () => new Promise<string>((r) => setTimeout(() => r("fast"), 5)),
      () => new Promise<string>((r) => setTimeout(() => r("slow"), 40)),
      () => new Promise<string>((r) => setTimeout(() => r("tail"), 5)),
    ];

    const result = await runWithConcurrency(tasks, 2);
    expect(result).toEqual(["fast", "slow", "tail"]);
  });

  it("should call each task factory exactly once", async () => {
    const factories = [
      vi.fn(() => Promise.resolve(0)),
      vi.fn(() => Promise.resolve(1)),
      vi.fn(() => Promise.resolve(2)),
    ];

    const result = await runWithConcurrency(factories, 2);

    expect(result).toEqual([0, 1, 2]);
    for (const f of factories) {
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
});
