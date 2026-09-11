/**
 * 流体画布尺寸解析回归测试
 *
 * Bug（视频导出失败）：
 *   Failed to execute 'drawImage' on 'OffscreenCanvasRenderingContext2D':
 *   The image argument is a canvas element with a width or height of 0.
 *
 * 根因：FluidSimulation 用 canvas.clientWidth/clientHeight（CSS 布局尺寸）
 * 推导绘制缓冲尺寸。视频导出（ADR 0023）使用的是**未挂载到 DOM** 的离屏
 * canvas，clientWidth/clientHeight 恒为 0，于是画布被清零，导出合成时
 * drawImage(fluidCanvas) 因 0 尺寸抛错。
 *
 * 正确行为：无 CSS 布局时以 canvas.width/height 属性为准（调用方已按导出
 * 像素尺寸设定），且必须幂等——不能每帧再乘一次 dpr 导致画布膨胀。
 */
import { describe, it, expect } from "vitest";
import { resolveFluidCanvasBufferSize } from "@/engine/fluid/FluidSimulation";

/** 模拟离屏 canvas：未挂载 → clientWidth/clientHeight 为 0 */
function detachedCanvas(width: number, height: number) {
  return { clientWidth: 0, clientHeight: 0, width, height };
}

/** 模拟可见 canvas：有 CSS 布局尺寸与设备像素比 */
function laidOutCanvas(clientWidth: number, clientHeight: number) {
  return { clientWidth, clientHeight, width: 0, height: 0 };
}

describe("resolveFluidCanvasBufferSize", () => {
  it("离屏 canvas 沿用自身属性尺寸，不被清零", () => {
    const size = resolveFluidCanvasBufferSize(detachedCanvas(426, 240));
    expect(size).toEqual({ width: 426, height: 240 });
  });

  it("离屏 canvas 解析结果幂等（不会逐帧膨胀）", () => {
    let width = 426;
    let height = 240;
    for (let i = 0; i < 10; i++) {
      const size = resolveFluidCanvasBufferSize(detachedCanvas(width, height));
      width = size.width;
      height = size.height;
    }
    expect({ width, height }).toEqual({ width: 426, height: 240 });
  });

  it("可见 canvas 按 CSS 布局尺寸 × dpr 解析", () => {
    const dpr = window.devicePixelRatio || 1;
    const size = resolveFluidCanvasBufferSize(laidOutCanvas(800, 600));
    expect(size).toEqual({
      width: Math.floor(800 * dpr),
      height: Math.floor(600 * dpr),
    });
  });
});
