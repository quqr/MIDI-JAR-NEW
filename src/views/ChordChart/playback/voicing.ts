/**
 * Piano voicing 规则生成（纯函数）。
 *
 * 策略（见计划 Phase 2）：
 * - shell voicing：3 音 / 7 音（或 sus 替代）必含，5/6 音次之，至多取一个延伸音；
 * - 根音落在 C2–B3 区间，与前一 voicing 的根音就近；
 * - 上方声部与前一 voicing 同序位就近连接（voice leading），无前声部时在根音上方堆叠；
 * - slash 和弦（chord.bass）：低音交给 bass 轨，voicing 排除该音高类；
 * - N.C. / 无根音和弦 → 空数组（生成层跳过）。
 *
 * 本模块不依赖 Vue / Pinia；音频无关（输出 MIDI 号）。
 */

import { Chord, Note } from "tonal";

import type { ChordUnit } from "../domain/types";

/* ── 音域常量 ─────────────────────────────────────────── */

/** 根音下限：C2 */
const ROOT_LOW = 36;
/** 根音上限：B3 */
const ROOT_HIGH = 59;
/** 上方声部下限：C3 */
const UPPER_LOW = 48;
/** 上方声部上限：B5 */
const UPPER_HIGH = 83;

/** 上方声部最多几个（不含根音） */
const MAX_UPPER_VOICES = 4;

/* ── 和弦音提取 ───────────────────────────────────────── */

/** 和弦的音高类（chroma 0–11）列表；解析失败回退仅根音 */
export function chordPitchClasses(chord: ChordUnit): number[] {
  if (chord.noChord || !chord.root) return [];
  const c = Chord.get(`${chord.root}${chord.type}`);
  let notes = c.notes.length > 0 ? [...c.notes] : [chord.root];

  // slash：低音交给 bass 轨，voicing 排除该音高类
  if (chord.bass) {
    const bassPc = Note.chroma(chord.bass);
    const filtered = notes.filter((n) => Note.chroma(n) !== bassPc);
    if (filtered.length > 0) notes = filtered;
  }
  return notes.map((n) => Note.chroma(n));
}

/** 按声部重要度排序的上方面音（chroma 0–11，不含根音，至多 MAX_UPPER_VOICES 个） */
function orderedUpperChromas(chord: ChordUnit): number[] {
  const rootPc = Note.chroma(chord.root);
  const chromas = chordPitchClasses(chord);

  const weight = (pc: number): number => {
    if (pc === rootPc) return 0; // 根音单独处理
    const semis = (pc - rootPc + 12) % 12;
    if (semis === 3 || semis === 4) return 1; // 三音
    if (semis === 10 || semis === 11) return 1; // 七音（b7 / maj7）
    if (semis === 5) return 2; // 11/sus4（视作 3 音替代）
    if (semis === 7) return 3; // 五音
    if (semis === 9) return 3; // 六音
    if (semis === 2) return 4; // 九音
    if (semis === 1 || semis === 8) return 4; // b9 / b6(#5)
    if (semis === 6) return 4; // #11/b5
    return 5;
  };

  return chromas
    .filter((pc) => pc !== rootPc)
    .map((pc) => ({ pc, w: weight(pc) }))
    .sort((a, b) => a.w - b.w)
    .slice(0, MAX_UPPER_VOICES)
    .map((x) => x.pc);
}

/* ── MIDI 工具 ────────────────────────────────────────── */

/** 音高类在 [low, high] 内离 target 最近的 MIDI 号 */
function nearestMidiWithPc(pc: number, low: number, high: number, target: number): number {
  const base = pc + 12 * Math.round((target - pc) / 12);
  const candidates = [base - 12, base, base + 12].filter((m) => m >= low && m <= high);
  if (candidates.length === 0) {
    // 区间内不存在该音高类（区间 < 12 半音时可能）：取区间内最近的
    return Math.min(high, Math.max(low, base));
  }
  return candidates.reduce((best, m) =>
    Math.abs(m - target) < Math.abs(best - target) ? m : best,
  );
}

/* ── 主入口 ───────────────────────────────────────────── */

/**
 * 生成一个和弦的 voicing（MIDI 号数组，升序）。
 * @param chord - 谱内和弦单元（N.C. → 空数组）
 * @param previousVoicing - 前一和弦的 voicing（用于 voice leading）；null = 曲首
 */
export function voiceChord(chord: ChordUnit, previousVoicing: number[] | null): number[] {
  if (chord.noChord || !chord.root) return [];

  const rootPc = Note.chroma(chord.root);
  const prevRoot = previousVoicing && previousVoicing.length > 0 ? previousVoicing[0] : 48; // 默认 C3
  const rootMidi = nearestMidiWithPc(rootPc, ROOT_LOW, ROOT_HIGH, prevRoot);

  const uppers = orderedUpperChromas(chord);
  const voicing: number[] = [rootMidi];

  for (let i = 0; i < uppers.length; i += 1) {
    const pc = uppers[i];
    // voice leading：与前一同序位声部就近；无则贴着已堆叠的最高音上方
    const target =
      previousVoicing && previousVoicing[i + 1] !== undefined
        ? previousVoicing[i + 1]
        : voicing[voicing.length - 1] + 3;
    let midi = nearestMidiWithPc(pc, UPPER_LOW, UPPER_HIGH, target);
    // 保证升序（防止 voice leading 交叉后倒序）
    if (midi <= voicing[voicing.length - 1]) {
      midi += 12;
      if (midi > UPPER_HIGH) midi -= 12;
    }
    voicing.push(midi);
  }

  return voicing;
}
