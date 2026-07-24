import type { KeyboardConfig, KeyLabel } from "@/views/WaterfallPiano/types";
import type { KeyboardSettings } from "@/types/settings";

// ─── 音级名查找表 ───
const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** 将 MIDI 音符号转为音级名（不含八度，60→"C"） */
export function midiToPitchClass(midi: number): string {
  return PITCH_CLASS_NAMES[midi % 12];
}

/**
 * 将音级名列表（如 ["C","E","G"]）映射到 [from, to] 范围内的 MIDI 值。
 * 每个音级取范围内第一个匹配，保证和弦形状在屏上可见。
 */
export function chordNotesToMidi(
  notes: string[],
  from: number,
  to: number,
): number[] {
  if (!notes.length) return [];
  const result: number[] = [];
  for (const pitchClass of notes) {
    for (let m = from; m <= to; m++) {
      if (midiToPitchClass(m) === pitchClass) {
        result.push(m);
        break;
      }
    }
  }
  return result;
}

/** 安全的 DPR 获取，上限 2 避免过高性能开销 */
export function getCanvasDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * 将应用层 KeyboardSettings 转换为渲染器需要的 KeyboardConfig。
 *
 * KeyboardSettings 中以下字段在当前 Canvas 键盘渲染器中没有对应概念，属预期丢弃：
 *   - skin / keyInfo / wrap / displaySustained / fadeOutDuration / textOpacity
 *   - sizes.height / sizes.ratio / sizes.bevel
 *   - colors.sustained / colors.wrapped（渲染器只有 pressedKeyColor）
 */
export function toKeyboardConfig(kb: KeyboardSettings): KeyboardConfig {
  return {
    visible: true,
    range: "custom",
    customFrom: kb.from,
    customTo: kb.to,
    keyLabel: kb.keyName as KeyLabel,
    showNoteNames: kb.label !== "none",
    whiteKeyColor: kb.colors.white ?? "#f0f0f0",
    blackKeyColor: kb.colors.black ?? "#1a1a1a",
    pressedKeyColor: kb.colors.played ?? "#6366f1",
    keyCornerRadius: Math.max(0, kb.sizes.radius),
    // KeyboardConfig 必填但 CanvasPianoKeyboard 不关心的字段——用固定默认值
    heightRatio: 0.3,
    keyBorderWidth: 1,
    keyBorderColor: "#333333",
    gapBlur: 6,
    separatorEnabled: true,
    separatorColor: "#ffffff",
    separatorThickness: 2,
    staffVisible: false,
    synthesiaFlowDirection: "down",
    defaultVelocity: 90,
  };
}
