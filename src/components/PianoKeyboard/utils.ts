import type { KeyboardConfig, KeyLabel } from "@/views/WaterfallPiano/types";
import type { KeyboardSettings } from "@/types/settings";
import { getThemeColors } from "@/views/WaterfallPiano/config/pianoThemes";

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
  return PITCH_CLASS_NAMES[((midi % 12) + 12) % 12];
}

/** 音名 → 基础音级（C=0 … B=11）查找表 */
const BASE_PITCH_CLASS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * 将任意记法的音名归一化为音级数字（0–11）。
 *
 * 支持双升/双降等任意升降组合（tonal 对增和弦等会给出 "C##"/"Fb" 记法）：
 *   "C##" → 2（等同 D）、"Fb" → 4（等同 E）、"A" → 9。
 * 解析失败（如非音名字符串）返回 null。
 */
export function pitchClassOf(name: string): number | null {
  const m = /^([A-G])([#b]*)$/.exec(name);
  if (!m) return null;
  const base = BASE_PITCH_CLASS[m[1]];
  if (base === undefined) return null;
  let pc = base;
  for (const c of m[2]) {
    pc += c === "#" ? 1 : -1;
  }
  return ((pc % 12) + 12) % 12;
}

/**
 * 将音级名列表（如 ["C","E","G"]）映射到 [from, to] 范围内的 MIDI 值。
 *
 * 匹配按音级数字（0–11）而非字符串字面量 — 否则 tonal 的双升/双降记法
 * （如 A#aug 的 "C##"/"E##"）永远匹配不上单升名的 MIDI 音级，导致和弦音被
 * 静默丢弃、键盘只高亮部分和弦。
 *
 * 优先匹配 hintMidi 中相同音级的 MIDI（避免引入用户未点击的"幽灵键"）；
 * hint 中没有匹配音级时，回退到范围内第一个匹配。
 *
 * 例：chord=["A","E"]，range=[C3,B5]，hint=[A3=57, E4=64]
 *   - "A" → hint 有 A3=57 → 57
 *   - "E" → hint 有 E4=64 → 64
 *   - 结果 [57, 64]，不会误高亮 E3=52
 */
export function chordNotesToMidi(
  notes: string[],
  from: number,
  to: number,
  hintMidi?: number[],
): number[] {
  if (!notes.length) return [];
  const result: number[] = [];
  for (const note of notes) {
    const pc = pitchClassOf(note);
    if (pc === null) continue;
    // 优先匹配 hint 中相同音级且落在可见范围内的 MIDI；
    // hint 命中但在范围外时（如窄音域下题目音符越界）回退到范围内第一个匹配，
    // 保证和弦每个音级在当前可见音域内始终有可见高亮
    const hinted = hintMidi?.find(
      (m) => ((m % 12) + 12) % 12 === pc && m >= from && m <= to,
    );
    if (hinted !== undefined) {
      result.push(hinted);
      continue;
    }
    // 回退：范围内第一个匹配
    for (let m = from; m <= to; m++) {
      if (((m % 12) + 12) % 12 === pc) {
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
 * skin 为主题预设（coral/indigo/midnight），决定渲染器的渐变质感；
 * 白/黑/按下键颜色优先取 KeyboardSettings.colors.* 中的显式值，
 * 当 colors.* 为 null 时回退到主题色板。因此：
 *   - useThemeColors=true 时把 colors.* 置 null → 走主题色板；
 *   - useThemeColors=false 时填入自定义色 → 应用自定义色（仍带主题渐变）。
 * 用户的 keyCornerRadius 设置始终被尊重，不会被主题覆盖。
 *
 * KeyboardSettings 中以下字段在当前 Canvas 键盘渲染器中没有对应概念，属预期丢弃：
 *   - keyInfo / wrap / displaySustained / fadeOutDuration / textOpacity
 *   - sizes.height / sizes.ratio / sizes.bevel
 *   - colors.sustained / colors.wrapped（渲染器只有 pressedKeyColor）
 */
export function toKeyboardConfig(kb: KeyboardSettings): KeyboardConfig {
  const theme = kb.skin;
  const themeColors = getThemeColors(theme);

  // 显式自定义颜色优先于主题色板（useThemeColors=false 时 colors.* 为实际值，
  // useThemeColors=true 时 colors.* 为 null，自动回退到主题色板）。
  const whiteKeyColor =
    kb.colors.white ?? themeColors?.whiteKeyColor ?? "#FBF8F3";
  const blackKeyColor =
    kb.colors.black ?? themeColors?.blackKeyColor ?? "#2B2020";
  const pressedKeyColor =
    kb.colors.played ?? themeColors?.pressedKeyColor ?? "#FF5C5C";
  const keyBorderColor = themeColors?.keyBorderColor ?? "#EBE0D6";
  const separatorColor = themeColors?.separatorColor ?? "#FFC4B0";

  return {
    visible: true,
    range: "custom",
    customFrom: kb.from,
    customTo: kb.to,
    keyLabel: kb.keyName as KeyLabel,
    theme,
    showNoteNames: kb.label !== "none",
    whiteKeyColor,
    blackKeyColor,
    pressedKeyColor,
    // 始终尊重用户的圆角设置
    keyCornerRadius: Math.max(0, kb.sizes.radius),
    blackKeyHeightRatio: 0.62,
    heightRatio: 0.3,
    keyBorderWidth: 1,
    keyBorderColor,
    gapBlur: 6,
    separatorEnabled: true,
    separatorColor,
    separatorThickness: 2,
    staffVisible: false,
    synthesiaFlowDirection: "down",
    defaultVelocity: 90,
  };
}
