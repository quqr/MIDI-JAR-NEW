import { describe, it, expect } from "vitest";
import { PerformanceMonitor } from "../engine/PerformanceMonitor";

describe("PerformanceMonitor", () => {
  it("60 帧 16.67ms → FPS ≈ 60", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 60; i++) pm.recordFrame(16.67);
    const fps = pm.getFps();
    expect(fps).toBeGreaterThan(58);
    expect(fps).toBeLessThan(62);
  });

  it("30 帧 50ms（20fps）→ shouldDegrade 为 true", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 30; i++) pm.recordFrame(50);
    expect(pm.shouldDegrade()).toBe(true);
  });

  it("30 帧低 fps 后 5 帧 60fps → shouldDegrade 回到 false", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 30; i++) pm.recordFrame(50);
    expect(pm.shouldDegrade()).toBe(true);
    for (let i = 0; i < 5; i++) pm.recordFrame(16.67);
    expect(pm.shouldDegrade()).toBe(false);
  });

  it("29 帧低 fps 不足 30 → shouldDegrade 仍为 false", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 29; i++) pm.recordFrame(50);
    expect(pm.shouldDegrade()).toBe(false);
  });

  it("窗口大小 60：超过 60 帧后 getFps 只反映最近 60 帧", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 60; i++) pm.recordFrame(16.67);
    expect(pm.getFps()).toBeGreaterThan(58);
    for (let i = 0; i < 60; i++) pm.recordFrame(50);
    const fps = pm.getFps();
    expect(fps).toBeGreaterThan(18);
    expect(fps).toBeLessThan(22);
  });

  it("reset 后 shouldDegrade 为 false 且 getFps 为 0", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 30; i++) pm.recordFrame(50);
    expect(pm.shouldDegrade()).toBe(true);
    pm.reset();
    expect(pm.shouldDegrade()).toBe(false);
    expect(pm.getFps()).toBe(0);
  });

  it("deltaTime <= 0 时使用默认 16.67ms 不报错", () => {
    const pm = new PerformanceMonitor();
    pm.recordFrame(0);
    pm.recordFrame(-5);
    expect(pm.getFps()).toBeGreaterThan(0);
  });

  it("getFrameTime 返回平均帧时间", () => {
    const pm = new PerformanceMonitor();
    for (let i = 0; i < 60; i++) pm.recordFrame(16.67);
    const ft = pm.getFrameTime();
    expect(ft).toBeGreaterThan(16);
    expect(ft).toBeLessThan(17.5);
  });

  it("空状态下 getFps 和 getFrameTime 返回 0", () => {
    const pm = new PerformanceMonitor();
    expect(pm.getFps()).toBe(0);
    expect(pm.getFrameTime()).toBe(0);
  });
});
