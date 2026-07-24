import { describe, it, expect } from "vitest";
import { KeyboardRenderer } from "../engine/KeyboardRenderer";
import { defaultWaterfallSettings } from "../constants";
import type { KeyboardConfig } from "../types";

/**
 * 创建最小 mock Container（PixiJS Container 接口子集）
 * 仅用于初始化 KeyboardRenderer，纯计算测试不需要真实渲染
 */
function mockContainer() {
  return {
    addChild: () => {},
    removeChild: () => {},
    label: "",
  } as unknown as import("pixi.js").Container;
}

/**
 * 创建最小 mock Renderer
 * 仅用于初始化 KeyboardRenderer，纯计算测试不需要真实渲染
 */
function mockRenderer() {
  return {
    render: () => {},
  } as unknown as import("pixi.js").Renderer;
}

function cloneKeyboardConfig(): KeyboardConfig {
  return structuredClone(defaultWaterfallSettings.keyboard);
}

describe("KeyboardRenderer", () => {
  it("init + resize(800,120,1) → getVisibleRange 返回 88 键范围", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    expect(kr.getVisibleRange()).toEqual({ from: 21, to: 108 });
  });

  it("midiToX / xToMidi 互逆（白键 midi=60）", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    const x = kr.midiToX(60);
    expect(kr.xToMidi(x)).toBe(60);
  });

  it("midiToX / xToMidi 互逆（黑键 midi=61）", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    const x = kr.midiToX(61);
    expect(kr.xToMidi(x)).toBe(61);
  });

  it("midiToX / xToMidi 互逆（黑键 midi=56）", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    const x = kr.midiToX(56);
    expect(kr.xToMidi(x)).toBe(56);
  });

  it("窄屏 resize(500,120,1) → getVisibleRange 返回 49 键范围", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(500, 120, 1);
    expect(kr.getVisibleRange()).toEqual({ from: 36, to: 84 });
  });

  it("getRangeText 宽屏返回 'A0 - C8'", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    expect(kr.getRangeText()).toBe("A0 - C8");
  });

  it("getRangeText 窄屏返回 'C2 - C6'", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(500, 120, 1);
    expect(kr.getRangeText()).toBe("C2 - C6");
  });

  it("highlightNote / clearHighlight / clearAllHighlights 不报错", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    expect(() => kr.highlightNote(60)).not.toThrow();
    expect(() => kr.clearHighlight(60)).not.toThrow();
    expect(() => kr.clearAllHighlights()).not.toThrow();
  });

  it("setRange 覆盖范围后 getVisibleRange 反映新值", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    kr.setRange(48, 72);
    expect(kr.getVisibleRange()).toEqual({ from: 48, to: 72 });
  });

  it("custom range C4-C5 → getVisibleRange 返回 {from:60, to:72}", () => {
    const kr = new KeyboardRenderer();
    const config = cloneKeyboardConfig();
    config.range = "custom";
    config.customFrom = "C4";
    config.customTo = "C5";
    kr.init(mockContainer(), mockRenderer(), config);
    kr.resize(800, 120, 1);
    expect(kr.getVisibleRange()).toEqual({ from: 60, to: 72 });
  });

  it("render() 不抛异常", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    expect(() => kr.render()).not.toThrow();
  });

  it("getWhiteKeyWidth 返回正值", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    expect(kr.getWhiteKeyWidth()).toBeGreaterThan(0);
  });

  it("getKeyboardHeight 返回 resize 设定的高度", () => {
    const kr = new KeyboardRenderer();
    kr.init(mockContainer(), mockRenderer(), cloneKeyboardConfig());
    kr.resize(800, 120, 1);
    expect(kr.getKeyboardHeight()).toBe(120);
  });
});
