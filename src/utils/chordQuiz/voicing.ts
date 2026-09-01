// ============================================================================
// 和弦测验 — 乱序音型（voicing）工具
//
// 为「音符乱序」模式生成跨八度的开放 voicing：
// 同一组和弦音以打乱的顺序、在 C3–B5 音域内重新分配八度落点，
// 避免所有音挤在同一个八度内（闭口 voicing）。
// ============================================================================

const DEFAULT_FROM = 48; // C3
const DEFAULT_TO = 83; // B5

/** 音级名 → pitch class 序号（0 = C） */
const PITCH_CLASS_INDEX: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function pitchClassIndex(pitchClass: string): number {
  return PITCH_CLASS_INDEX[pitchClass] ?? 0;
}

/**
 * Fisher–Yates 洗牌（不修改原数组，返回新数组）。
 * @param array - 待打乱的数组
 * @param rng - 随机数生成器（0~1），默认 Math.random
 */
export function randomizeOrder<T>(
  array: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 找到 pitch class 在 [from, to] 范围内距离目标 midi 最近的落点。
 * @param pitchClass - 音级名（如 "C"、"G#"）
 * @param from - 范围下限（midi）
 * @param to - 范围上限（midi）
 * @returns 落点 midi；范围无效时返回 -1
 */
export function nearestInRange(pitchClass: string, from = 60, to = 83): number {
  if (from > to) return -1;
  const pc = pitchClassIndex(pitchClass);
  // 目标八度取范围中间，保证结果落在范围内
  const midOctave = Math.floor((from + to) / 2 / 12);
  const base = pc + midOctave * 12;
  let candidate = base;
  // 向下逼近范围
  while (candidate > to) candidate -= 12;
  while (candidate < from) candidate += 12;
  if (candidate < from || candidate > to) return -1;
  // 与上下相邻八度比较取最近
  const lower = candidate - 12;
  const upper = candidate + 12;
  if (
    lower >= from &&
    Math.abs(lower - (from + to) / 2) < Math.abs(candidate - (from + to) / 2)
  ) {
    candidate = lower;
  } else if (
    upper <= to &&
    Math.abs(upper - (from + to) / 2) <= Math.abs(candidate - (from + to) / 2)
  ) {
    candidate = upper;
  }
  return candidate;
}

function inRange(midi: number, from: number, to: number): boolean {
  return midi >= from && midi <= to;
}

/**
 * 为「音符乱序」模式生成开放 voicing：
 * 打乱音序后，为每个音分配跨八度落点；间距不足 3 半音或音高冲突时整体上移八度。
 * 返回与传入 `chordNotes` 一一对应的乱序 midi 列表（仅重排顺序与八度）。
 *
 * @param chordNotes - 和弦音名（首位为根音）
 * @param rng - 随机数生成器
 * @returns 乱序 voicing midi 列表
 */
export function buildScrambledVoicing(
  chordNotes: readonly string[],
  rng: () => number = Math.random,
): number[] {
  const from = DEFAULT_FROM;
  const to = DEFAULT_TO;

  // 打乱音序（根音也参与乱序，保持神秘感）
  const order = randomizeOrder(chordNotes, rng);
  const result: number[] = [];
  const used = new Set<number>();

  for (const pitchClass of order) {
    const pc = pitchClassIndex(pitchClass);
    // 随机选择一个八度（3/4/5 → 48–71）
    const octave = 3 + Math.floor(rng() * 3);
    let midi = pc + octave * 12;
    // 与已放置音符间距 < 3 半音或音高重复时，整体上移八度
    while (midi <= to) {
      const conflict =
        used.has(midi) || result.some((placed) => Math.abs(placed - midi) < 3);
      if (!conflict) break;
      midi += 12;
    }
    if (!inRange(midi, from, to)) {
      // 向上越界时向下回退，仍冲突则就近放置
      midi = pc + 3 * 12;
      while (used.has(midi) && midi <= to) midi += 12;
      if (!inRange(midi, from, to)) midi = pc + 3 * 12;
    }
    result.push(midi);
    used.add(midi);
  }

  return result;
}
