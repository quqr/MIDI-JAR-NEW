// ============================================================================
// 和弦测验 — 出题引擎（纯函数）
//
// 职责：基于难度档案随机生成一道测验题（目标答和弦名 + 4 个选项）。
// 仅依赖 tonal 与本项目 helpers，不依赖 Vue。
// ============================================================================

import { getChord } from "@tonaljs/chord";
import { NOTE_NAMES, getKeySignature } from "@/helpers";
import { chordNotesToMidi } from "@/components/PianoKeyboard/utils";
import type { QuizDifficulty, QuizMode, QuizQuestion } from "@/types";
import {
  buildScrambledVoicing,
  nearestInRange,
  randomizeOrder,
} from "./voicing";
import { getDifficultyTypes, validatePresets } from "./difficulties";

/** RNG 类型（0~1 随机数生成器，便于注入固定种子测试） */
export type Rng = () => number;

/** 模块加载时校验一次难度档案，剔除不可解析的类型 */
const VALIDATED = validatePresets();

/** 视觉 / 播放共用音域（C3–B5） */
const MIDI_FROM = 48;
const MIDI_TO = 83;

const PITCH_CLASSES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function pick<T>(array: readonly T[], rng: Rng): T {
  return array[randomInt(rng, array.length)];
}

/** 从 NOTE_NAMES（升号记法）中随机选一个根音 */
export function pickRoot(rng: Rng = Math.random): string {
  return pick(NOTE_NAMES, rng);
}

/** 依据根音 + 类型构建和弦符号（如 "Cmaj7"）；解析失败时兜底拼接 */
export function buildSymbol(root: string, type: string): string {
  try {
    const chord = getChord(type, root);
    if (chord.symbol) return chord.symbol;
  } catch {
    // 忽略解析失败，走兜底
  }
  return `${root}${type}`;
}

/** 获取和弦音名（跟随 tonal 的根音记法） */
export function getChordNoteNames(root: string, type: string): string[] {
  try {
    return getChord(type, root).notes ?? [];
  } catch {
    return [];
  }
}

/** 同根不同型干扰：从给定类型集合中随机抽取（排除 targetType） */
function pickDistractorType(
  candidateTypes: readonly string[],
  targetType: string,
  rng: Rng,
): string | null {
  const pool = candidateTypes.filter((t) => t !== targetType);
  if (!pool.length) return null;
  return pick(pool, rng);
}

/** 同型不同根干扰：根音偏移 offset（半音数，可负） */
function shiftedRoot(root: string, offset: number): string {
  const idx = PITCH_CLASSES.indexOf(root);
  if (idx === -1) return root;
  return PITCH_CLASSES[(idx + offset + 12) % 12];
}

/**
 * 生成 3 个干扰项 + 1 个正确答案，并打乱为 4 个唯一选项。
 *
 * 干扰策略：
 * 1. 同根不同型（从难度档案优先）；
 * 2. 同型不同根（根音 ±2 / +3 / +5 半音）；
 * 3. 全随机兜底（全部难度类型 × 12 根音）。
 *
 * 注意：`root` 为隐式目标根音，需要由 targetType 推导；
 * 但为了语义清晰，直接以 (root, type) 为目标生成选项。
 *
 * @returns options（打乱后）与 correctIndex
 */
export function buildOptions(
  root: string,
  type: string,
  difficulty: QuizDifficulty,
  rng: Rng = Math.random,
): { options: string[]; correctIndex: number } {
  const correctSymbol = buildSymbol(root, type);
  const types = getDifficultyTypes(difficulty);
  const distractors = new Set<string>();

  // 1. 同根不同型（1–2 个）
  const sameRootCount = 1 + randomInt(rng, 2); // 1–2
  for (let i = 0; i < sameRootCount && distractors.size < 3; i++) {
    const t = pickDistractorType(types, type, rng);
    if (t === null) break;
    const sym = buildSymbol(root, t);
    if (sym !== correctSymbol) distractors.add(sym);
  }

  // 2. 同型不同根（1–2 个）
  const offsets = [2, 3, 5, 7, -2, -3];
  randomizeOrder(offsets, rng);
  for (const offset of offsets) {
    if (distractors.size >= 3) break;
    const sym = buildSymbol(shiftedRoot(root, offset), type);
    if (sym !== correctSymbol) distractors.add(sym);
  }

  // 3. 随机兜底：重复尝试填充到 3 个
  let attempts = 0;
  while (distractors.size < 3 && attempts < 40) {
    attempts++;
    const t = pick(VALIDATED.all, rng);
    const r = pick(NOTE_NAMES, rng);
    const sym = buildSymbol(r, t);
    if (sym !== correctSymbol) distractors.add(sym);
  }

  // 拼装 4 个选项并打乱
  const options = randomizeOrder([correctSymbol, ...distractors], rng);
  const correctIndex = options.indexOf(correctSymbol); // 打乱后必有且唯一
  return { options, correctIndex };
}

/** 听觉播放用 midi：每个音在 C4–B5 内取最近落点 */
export function buildPlayMidi(chordNotes: readonly string[]): number[] {
  return chordNotes.map((note) => nearestInRange(note, 60, 83));
}

/** 视觉显示用 midi：原位堆叠（对越界音逐音 ±12 修正到 C3–B5） */
export function buildVisualMidi(chordNotes: readonly string[]): number[] {
  const raw = chordNotesToMidi(chordNotes as string[], MIDI_FROM, MIDI_TO);
  return raw.map((midi) => {
    let m = midi;
    while (m < MIDI_FROM) m += 12;
    while (m > MIDI_TO) m -= 12;
    return m;
  });
}

export interface GenerateOptions {
  difficulty: QuizDifficulty;
  mode: QuizMode;
}

/**
 * 生成一道测验题。
 * @param settings - 难度与模式；目标和弦类型从难度档案中随机抽取
 * @param id - 题目序号（从 0 起）
 * @param rng - 随机数生成器
 */
export function generateQuestion(
  settings: GenerateOptions,
  id: number,
  rng: Rng = Math.random,
): QuizQuestion {
  const root = pickRoot(rng);
  // 目标和弦类型：从难度档案中随机抽取（档案为空时回退到全部类型）
  const pool = getDifficultyTypes(settings.difficulty);
  const type = pool.length ? pick(pool, rng) : pick(VALIDATED.all, rng);
  const symbol = buildSymbol(root, type);
  const { options, correctIndex } = buildOptions(
    root,
    type,
    settings.difficulty,
    rng,
  );
  const chordNotes = getChordNoteNames(root, type);
  const playMidi = buildPlayMidi(chordNotes);
  const visualMidi =
    settings.mode === "scrambled"
      ? buildScrambledVoicing(chordNotes, rng)
      : buildVisualMidi(chordNotes);

  return {
    id,
    mode: settings.mode,
    symbol,
    options,
    correctIndex,
    chordNotes,
    visualMidi,
    playMidi,
    keySignature: getKeySignature("C"),
  };
}
