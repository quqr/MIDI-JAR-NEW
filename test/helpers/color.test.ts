/**
 * 颜色工具回归测试（ADR 0026：alpha 全局启用与 8 位 hex 契约）
 *
 * 契约：
 * - 8 位 `#rrggbbaa` 必须在解析/转换路径中容忍（alpha 或忽略、或保留）；
 * - `toHex6()` 把任意颜色归一化为 6 位（供 three.js 等不支持 8 位的消费方）；
 * - `cssColorToHex` 的契约恒为「返回 6 位」，8 位输入须丢 alpha 取色值。
 */
import { describe, it, expect } from "vitest";
import {
  cssColorToHex,
  hexToRgb,
  hexToRgbNorm,
  hexToRgba,
  interpolateHex,
  isValidHexColor,
  lightenColor,
  parseColor,
  toHex6,
} from "@/helpers/color";

describe("hexToRgb", () => {
  it("解析 6 位 hex", () => {
    expect(hexToRgb("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("解析 8 位 hex 并忽略 alpha", () => {
    expect(hexToRgb("#ff8800aa")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("非法输入返回 null", () => {
    expect(hexToRgb("not-a-color")).toBeNull();
    expect(hexToRgb("#ff88")).toBeNull();
  });
});

describe("toHex6", () => {
  it("8 位 hex 丢 alpha", () => {
    expect(toHex6("#ff8800aa")).toBe("#ff8800");
  });

  it("CSS 颜色归一到 6 位", () => {
    expect(toHex6("rgba(255, 136, 0, 0.5)")).toBe("#ff8800");
    expect(toHex6("oklch(0.628 0.258 29.2)")).toBe("#ff0000");
  });

  it("6 位 hex 原样返回", () => {
    expect(toHex6("#ff8800")).toBe("#ff8800");
  });
});

describe("cssColorToHex", () => {
  it("8 位 hex 返回 6 位", () => {
    expect(cssColorToHex("#ff8800aa")).toBe("#ff8800");
  });

  it("6 位 hex 原样返回", () => {
    expect(cssColorToHex("#ff8800")).toBe("#ff8800");
  });
});

describe("parseColor", () => {
  it("8 位 hex 保留 alpha", () => {
    const parsed = parseColor("#ff880080");
    expect(parsed?.r).toBe(1);
    expect(parsed?.a).toBeCloseTo(0.5, 1);
  });

  it("transparent 归一为全透明黑", () => {
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("null / 乱码返回 null", () => {
    expect(parseColor(null)).toBeNull();
    expect(parseColor("nonsense")).toBeNull();
  });
});

describe("isValidHexColor", () => {
  it("接受 6/8 位，拒绝 3 位与非 hex", () => {
    expect(isValidHexColor("#ff8800")).toBe(true);
    expect(isValidHexColor("#ff8800aa")).toBe(true);
    expect(isValidHexColor("xyz")).toBe(false);
  });
});

describe("8 位 hex 在引擎路径中被容忍（仅取色值）", () => {
  it("hexToRgba 用调用方传入的 alpha 而非值内 alpha", () => {
    expect(hexToRgba("#ff8800aa", 0.3)).toBe("rgba(255, 136, 0, 0.3)");
  });

  it("hexToRgbNorm 忽略尾部 alpha", () => {
    const rgb = hexToRgbNorm("#ff8800aa");
    expect(rgb.r).toBe(1);
    expect(rgb.g).toBeCloseTo(136 / 255, 5);
    expect(rgb.b).toBe(0);
  });

  it("interpolateHex 只插值 RGB", () => {
    expect(interpolateHex("#000000aa", "#ffffffff", 0.5)).toBe("#808080");
  });

  it("lightenColor 只作用于色值", () => {
    expect(lightenColor("#ff8800aa", 0.5)).toBe("#ffc37f");
  });
});
