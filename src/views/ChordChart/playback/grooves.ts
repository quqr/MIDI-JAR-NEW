/**
 * 风格伴奏模板库（grooves）。
 *
 * 约定（见计划 Phase 2）：
 * - 模板内拍位一律按**等分网格**书写（1.5 = 第 2 拍前的八分位）；
 *   swing 由调度层按 `swingRatio` 做非线性映射，生成层零感知。
 * - drums / piano pattern 按「一小节（4 拍）」书写；生成层按实际小节拍数截断适配
 *   （beat >= 小节拍数的 hit 被丢弃）。
 * - velocity 必填：swing 听感一半来自时值、一半来自力度。
 * - jazz 系用声学鼓（drumKit: "acoustic"，GM 声学鼓组映射），
 *   TR-808（合成鼓）留给 rock/电子风——电子鼓配 swing 很出戏。
 */

/* ── 类型 ─────────────────────────────────────────────── */

export type DrumPiece = "kick" | "snare" | "hihat" | "ride";

export interface GrooveDrumHit {
  /** 小节内拍位（等分网格，0 起） */
  beat: number;
  piece: DrumPiece;
  /** 0–1 */
  velocity: number;
}

export interface GroovePianoHit {
  beat: number;
  /** 时值（拍） */
  durationBeats: number;
  /** 0–1 */
  velocity: number;
}

export type BassStyle = "two-feel" | "walking" | "bossa" | "root-fifth";

export interface Groove {
  id: string;
  /** i18n key */
  labelKey: string;
  /**
   * swing 比例：等分八分位（x.5 拍）映射为「整数拍 + ratio × 拍长」。
   * 0.5 = 平直（退化为线性）；快 swing ≈ 0.62；慢 swing / ballad ≈ 0.66。
   */
  swingRatio: number;
  drums: GrooveDrumHit[];
  piano: GroovePianoHit[];
  bassStyle: BassStyle;
  /** 声学鼓组（GM）或 TR-808 */
  drumKit: "acoustic" | "tr808";
}

/* ── 模板 ─────────────────────────────────────────────── */

/**
 * Medium Swing：ride「重-轻轻-重」律动 + hi-hat 2/4 踩镲、two-feel bass、切分 comping。
 * 典型 comping：1 拍正拍、2.5 反拍、4 正拍（Charleston 变体）。
 */
const MEDIUM_SWING: Groove = {
  id: "medium-swing",
  labelKey: "chordChart.playback.grooveMediumSwing",
  swingRatio: 0.62,
  drums: [
    { beat: 0, piece: "ride", velocity: 0.9 },
    { beat: 0.5, piece: "ride", velocity: 0.4 },
    { beat: 1, piece: "hihat", velocity: 0.7 },
    { beat: 1.5, piece: "ride", velocity: 0.5 },
    { beat: 2, piece: "ride", velocity: 0.7 },
    { beat: 2.5, piece: "ride", velocity: 0.4 },
    { beat: 3, piece: "hihat", velocity: 0.7 },
    { beat: 3.5, piece: "ride", velocity: 0.5 },
    { beat: 0, piece: "kick", velocity: 0.5 },
    { beat: 2.5, piece: "snare", velocity: 0.45 },
  ],
  piano: [
    { beat: 0, durationBeats: 1, velocity: 0.7 },
    { beat: 1.5, durationBeats: 1, velocity: 0.55 },
    { beat: 3, durationBeats: 0.75, velocity: 0.65 },
  ],
  bassStyle: "two-feel",
  drumKit: "acoustic",
};

/** Ballad：慢 swing、稀疏 comping、轻鼓 */
const BALLAD: Groove = {
  id: "ballad",
  labelKey: "chordChart.playback.grooveBallad",
  swingRatio: 0.66,
  drums: [
    { beat: 0, piece: "ride", velocity: 0.5 },
    { beat: 1, piece: "ride", velocity: 0.3 },
    { beat: 2, piece: "ride", velocity: 0.45 },
    { beat: 3, piece: "ride", velocity: 0.3 },
    { beat: 0, piece: "kick", velocity: 0.4 },
    { beat: 2, piece: "snare", velocity: 0.3 },
  ],
  piano: [
    { beat: 0, durationBeats: 2, velocity: 0.65 },
    { beat: 2.5, durationBeats: 1, velocity: 0.5 },
  ],
  bassStyle: "two-feel",
  drumKit: "acoustic",
};

/** Bossa Nova：平直、clave 律动、root-fifth bass */
const BOSSA_NOVA: Groove = {
  id: "bossa-nova",
  labelKey: "chordChart.playback.grooveBossaNova",
  swingRatio: 0.5,
  drums: [
    { beat: 0, piece: "kick", velocity: 0.8 },
    { beat: 1.5, piece: "kick", velocity: 0.6 },
    { beat: 2, piece: "kick", velocity: 0.7 },
    { beat: 3.75, piece: "kick", velocity: 0.5 },
    { beat: 0.75, piece: "snare", velocity: 0.4 },
    { beat: 1, piece: "hihat", velocity: 0.5 },
    { beat: 1.75, piece: "snare", velocity: 0.45 },
    { beat: 3, piece: "hihat", velocity: 0.5 },
    { beat: 3.5, piece: "snare", velocity: 0.4 },
  ],
  piano: [
    { beat: 0, durationBeats: 1, velocity: 0.65 },
    { beat: 1.5, durationBeats: 0.5, velocity: 0.5 },
    { beat: 2, durationBeats: 1, velocity: 0.6 },
    { beat: 3.5, durationBeats: 0.5, velocity: 0.5 },
  ],
  bassStyle: "bossa",
  drumKit: "acoustic",
};

/** Straight / Rock：平直八分、TR-808 */
const STRAIGHT_ROCK: Groove = {
  id: "straight-rock",
  labelKey: "chordChart.playback.grooveStraightRock",
  swingRatio: 0.5,
  drums: [
    { beat: 0, piece: "kick", velocity: 0.9 },
    { beat: 1, piece: "hihat", velocity: 0.6 },
    { beat: 1.5, piece: "hihat", velocity: 0.5 },
    { beat: 2, piece: "kick", velocity: 0.7 },
    { beat: 2, piece: "snare", velocity: 0.85 },
    { beat: 3, piece: "hihat", velocity: 0.6 },
    { beat: 3.5, piece: "hihat", velocity: 0.5 },
  ],
  piano: [
    { beat: 0, durationBeats: 0.75, velocity: 0.7 },
    { beat: 1, durationBeats: 0.75, velocity: 0.6 },
    { beat: 2, durationBeats: 0.75, velocity: 0.7 },
    { beat: 3, durationBeats: 0.75, velocity: 0.6 },
  ],
  bassStyle: "root-fifth",
  drumKit: "tr808",
};

/** 模板注册表（顺序即 UI 选项顺序） */
export const GROOVES: readonly Groove[] = [
  MEDIUM_SWING,
  BALLAD,
  BOSSA_NOVA,
  STRAIGHT_ROCK,
];

/** 默认模板 */
export const DEFAULT_GROOVE: Groove = MEDIUM_SWING;

/** 按 id 取模板；未命中回退默认 */
export function grooveById(id: string): Groove {
  return GROOVES.find((g) => g.id === id) ?? DEFAULT_GROOVE;
}

/* ── 风格文本 → 模板 ──────────────────────────────────── */

/** 中英文关键词映射（命中即返回；顺序即优先级） */
const STYLE_KEYWORDS: Array<{ groove: Groove; keywords: string[] }> = [
  {
    groove: BOSSA_NOVA,
    keywords: ["bossa", "博萨", "波萨", "samba", "桑巴", "latin", "拉丁"],
  },
  {
    groove: STRAIGHT_ROCK,
    keywords: ["rock", "摇滚", "pop", "流形", "流行", "funk", "放克", "straight"],
  },
  {
    groove: BALLAD,
    keywords: ["ballad", "叙事曲", "抒情", "慢板", "slow", "waltz"],
  },
  {
    groove: MEDIUM_SWING,
    keywords: ["swing", "摇摆", "jazz", "爵士", "bop", "swing feel"],
  },
];

/**
 * 自由风格文本 → 模板（不命中回退 medium-swing）。
 * 匹配大小写不敏感的子串。
 */
export function resolveGroove(styleText: string): Groove {
  const text = styleText.trim().toLowerCase();
  if (!text) return DEFAULT_GROOVE;
  for (const { groove, keywords } of STYLE_KEYWORDS) {
    if (keywords.some((k) => text.includes(k.toLowerCase()))) return groove;
  }
  return DEFAULT_GROOVE;
}
