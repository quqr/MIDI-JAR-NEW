/**
 * 键盘布局纯计算类 — 无 PixiJS / Canvas 依赖
 * 提供键位尺寸、MIDI↔像素坐标映射、标签生成等纯逻辑
 */

import type { KeyboardConfig } from "../types";
import {
  midiToNoteName,
  midiToPitchClass,
  noteNameToMidi,
  NARROW_BREAKPOINT,
  KEYBOARD_RANGES,
  NARROW_RANGE,
} from "../constants";

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
const BLACK_KEY_WIDTH_RATIO = 0.6;
const BLACK_KEY_HEIGHT_RATIO = 0.62;

/** 判断给定的 MIDI 音符编号是否对应黑键 */
export function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(((midi % 12) + 12) % 12);
}

/** 判断给定的 MIDI 音符编号是否对应白键 */
export function isWhiteKey(midi: number): boolean {
  return !isBlackKey(midi);
}

export interface KeyboardLayout {
  whiteKeys: number[];
  whiteKeyWidth: number;
  blackKeyWidth: number;
  height: number;
  blackKeyHeight: number;
  from: number;
  to: number;
}

/**
 * 纯计算类：键盘布局、MIDI↔像素映射、标签生成
 * 不持有任何渲染状态，可独立测试
 */
export class KeyboardLayoutCalculator {
  /**
   * 根据容器尺寸与 MIDI 范围计算完整键盘布局
   */
  static calculateLayout(
    width: number,
    height: number,
    from: number,
    to: number,
  ): KeyboardLayout {
    const whiteKeys: number[] = [];
    for (let m = from; m <= to; m++) {
      if (isWhiteKey(m)) {
        whiteKeys.push(m);
      }
    }
    const count = Math.max(1, whiteKeys.length);
    const whiteKeyWidth = width / count;
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    const blackKeyHeight = height * BLACK_KEY_HEIGHT_RATIO;
    return {
      whiteKeys,
      whiteKeyWidth,
      blackKeyWidth,
      height,
      blackKeyHeight,
      from,
      to,
    };
  }

  /**
   * 构建 MIDI → 白键索引的映射表
   */
  static buildMidiToIndex(from: number, to: number): Map<number, number> {
    const map = new Map<number, number>();
    let whiteIdx = 0;
    for (let m = from; m <= to; m++) {
      if (isWhiteKey(m)) {
        map.set(m, whiteIdx);
        whiteIdx++;
      }
    }
    return map;
  }

  /**
   * 将 MIDI 音符号转换为对应的水平像素坐标（键中心位置）
   */
  static midiToX(
    midi: number,
    layout: KeyboardLayout,
    midiToIndex: Map<number, number>,
  ): number {
    if (isWhiteKey(midi)) {
      const idx = midiToIndex.get(midi);
      if (idx === undefined) return 0;
      return (idx + 0.5) * layout.whiteKeyWidth;
    }
    const aboveWhite = midi + 1;
    const idx = midiToIndex.get(aboveWhite);
    if (idx === undefined || idx <= 0) return 0;
    return idx * layout.whiteKeyWidth;
  }

  /**
   * 将水平像素坐标转换为对应的 MIDI 音符号，优先匹配黑键边界区域
   */
  static xToMidi(x: number, layout: KeyboardLayout): number | null {
    if (layout.whiteKeys.length === 0) return null;
    const wkw = layout.whiteKeyWidth;
    let wi = Math.floor(x / wkw);
    wi = Math.max(0, Math.min(layout.whiteKeys.length - 1, wi));
    const whiteMidi = layout.whiteKeys[wi];
    const halfBlack = layout.blackKeyWidth / 2;
    const rightBoundary = (wi + 1) * wkw;
    if (
      isBlackKey(whiteMidi + 1) &&
      whiteMidi + 1 <= layout.to &&
      Math.abs(x - rightBoundary) <= halfBlack
    ) {
      return whiteMidi + 1;
    }
    const leftBoundary = wi * wkw;
    if (
      isBlackKey(whiteMidi - 1) &&
      whiteMidi - 1 >= layout.from &&
      Math.abs(x - leftBoundary) <= halfBlack
    ) {
      return whiteMidi - 1;
    }
    return whiteMidi;
  }

  /**
   * 根据标签模式生成琴键上显示的文本
   */
  static labelFor(
    midi: number,
    mode: KeyboardConfig["keyLabel"],
  ): string | null {
    if (mode === "none") return null;
    if (mode === "note") return midiToNoteName(midi);
    if (mode === "pitchClass") return midiToPitchClass(midi);
    if (mode === "octave") {
      return midi % 12 === 0 ? midiToNoteName(midi) : null;
    }
    return null;
  }

  /**
   * 根据键盘配置中的范围设置计算 MIDI 范围
   */
  static rangeFromConfig(config: KeyboardConfig): { from: number; to: number } {
    if (config.range === "custom") {
      return {
        from: noteNameToMidi(config.customFrom || "A0"),
        to: noteNameToMidi(config.customTo || "C8"),
      };
    }
    const r = KEYBOARD_RANGES[config.range];
    return { from: r.from, to: r.to };
  }

  /**
   * 根据宽度决定是否应使用窄屏范围
   */
  static rangeForWidth(
    width: number,
    config: KeyboardConfig,
  ): { from: number; to: number } {
    if (width < NARROW_BREAKPOINT) {
      return { from: NARROW_RANGE.from, to: NARROW_RANGE.to };
    }
    return KeyboardLayoutCalculator.rangeFromConfig(config);
  }

  /** 黑键宽度比例（导出供 NoteBlockRenderer 等使用） */
  static readonly BLACK_KEY_WIDTH_RATIO = BLACK_KEY_WIDTH_RATIO;
  /** 黑键高度比例 */
  static readonly BLACK_KEY_HEIGHT_RATIO = BLACK_KEY_HEIGHT_RATIO;
}
