/**
 * 取色器模块回归测试（ADR 0026）
 *
 * 覆盖两处易回归的数学/契约：
 * 1. alpha 输出策略——仅 a<1 输出 8 位，全不透明保持 6 位（避免污染存档）；
 * 2. 色环三角几何——s/v 与三角内坐标的往返映射必须精确（拖动定位依赖它）。
 */
import { describe, it, expect } from "vitest";
import {
  barycentric,
  clampToTriangle,
  hexToHsv,
  hsvToHex,
  pointToSv,
  svToPoint,
  triangleVertices,
} from "@/components/common/colorPicker";

describe("hsvToHex / hexToHsv", () => {
  it("alpha 关闭时恒为 6 位", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 1 }, false)).toBe("#ff0000");
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0.5 }, false)).toBe("#ff0000");
  });

  it("alpha 开启但全不透明时仍为 6 位", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 1 }, true)).toBe("#ff0000");
  });

  it("alpha 开启且半透明时输出 8 位", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0.5 }, true)).toBe("#ff000080");
  });

  it("hexToHsv 读回 alpha 并归一 s/v 到 0-1", () => {
    const hsv = hexToHsv("#ff000080");
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBeCloseTo(1, 5);
    expect(hsv.v).toBeCloseTo(1, 5);
    expect(hsv.a).toBeCloseTo(0.5, 1);
  });
});

describe("色环三角几何", () => {
  const verts = triangleVertices(0, 100);

  it("h=0 时纯色顶点指向正上方", () => {
    expect(verts[0].x).toBeCloseTo(0, 6);
    expect(verts[0].y).toBeCloseTo(-100, 6);
  });

  it("重心坐标之和恒为 1", () => {
    const { hc, wc, kc } = barycentric({ x: 0, y: 0 }, verts);
    expect(hc + wc + kc).toBeCloseTo(1, 9);
  });

  it("s/v 与三角内坐标往返精确", () => {
    for (const [s, v] of [
      [1, 1],
      [0, 1],
      [0.5, 0.5],
      [0.8, 0.3],
      [0.2, 0.9],
    ] as const) {
      const back = pointToSv(svToPoint(s, v, verts), verts);
      expect(back.s).toBeCloseTo(s, 6);
      expect(back.v).toBeCloseTo(v, 6);
    }
  });

  it("三角形外的点被钳制回内部（边上判定留 FP 容差）", () => {
    const clamped = clampToTriangle({ x: 0, y: 500 }, verts);
    const { hc, wc, kc } = barycentric(clamped, verts);
    expect(hc).toBeGreaterThanOrEqual(-1e-9);
    expect(wc).toBeGreaterThanOrEqual(-1e-9);
    expect(kc).toBeGreaterThanOrEqual(-1e-9);
  });
});
