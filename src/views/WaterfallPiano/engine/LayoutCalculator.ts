/**
 * 瀑布钢琴布局纯计算函数 — 无 PixiJS / Canvas 依赖
 *
 * 提供各层尺寸与位置的计算，沿用 KeyboardLayoutCalculator 的纯函数风格。
 * 不持有任何渲染状态，可独立测试。
 */

import type { WaterfallPianoSettings } from "../types";

/** 默认键盘高度比例（占画布总高度） */
const DEFAULT_KEYBOARD_HEIGHT_RATIO = 0.3;
/** 键盘最小高度（CSS 像素） */
const MIN_KEYBOARD_HEIGHT = 80;
/** DPR 上限（避免高 DPI 设备过度采样） */
const MAX_DPR = 2;

export interface WaterfallLayout {
  /** 画布总宽度（CSS 像素） */
  width: number;
  /** 画布总高度（CSS 像素） */
  height: number;
  /** 键盘层高度（CSS 像素） */
  keyboardHeight: number;
  /** 瀑布流层高度 = height - keyboardHeight */
  waterfallHeight: number;
  /** 设备像素比（已限幅） */
  dpr: number;
}

/**
 * 计算瀑布钢琴各层布局
 *
 * 纯函数，无副作用。根据键盘高度比例分配各层容器尺寸，
 * 返回值供 WaterfallEngine.resize() 分发给各子系统。
 *
 * @param settings - 瀑布钢琴配置（为 null 时使用默认值）
 * @param width - 画布总宽度（CSS 像素）
 * @param height - 画布总高度（CSS 像素）
 * @returns 各层尺寸与位置数据
 */
export function calculateLayout(
  settings: WaterfallPianoSettings | null,
  width: number,
  height: number,
): WaterfallLayout {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const kbRatio =
    settings?.keyboard.heightRatio ?? DEFAULT_KEYBOARD_HEIGHT_RATIO;
  const keyboardHeight = Math.max(
    MIN_KEYBOARD_HEIGHT,
    Math.floor(height * kbRatio),
  );
  const waterfallHeight = height - keyboardHeight;
  return {
    width,
    height,
    keyboardHeight,
    waterfallHeight,
    dpr,
  };
}
