import { Chord, Key, Note } from "tonal";

/**
 * 五度循环圈的领域纯函数层。
 *
 * 本模块不依赖 Vue / DOM，可直接用 node 冒烟（符合项目「不写单测」的约定）。
 *
 * 已内建规避的三个 `tonal` 陷阱：
 * 1. `Key.minorKey("F#m")` 会**静默返回空对象** —— API 只接受主音字母，必须传 `Key.minorKey("F#")`。
 * 2. `grades` 恒为大写（大调 `I II III…`，小调自带降号前缀 `bIII bVI bVII`），
 *    罗马数字的大小写与「°」需从三和弦品质自行推导，`tonal` 不给。
 * 3. 顺阶和弦可能出现 `E#dim` / `B#` 等异常拼写（F# 大调确实含 E#），
 *    播放前一律经 `Note.midi` 转 MIDI 数字，以 `playNote(number)` 绕过音名解析。
 */

/* ── 记法偏好 ─────────────────────────────────────────── */

/** 音名记法偏好；复用 `settings.notation.accidentals`，不另建设置项 */
export type AccidentalPreference = "flat" | "sharp";

export type KeyMode = "major" | "minor";

const SHARP_TO_FLAT: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

/**
 * 按听感偏好归一音名的升降拼写（仅处理主音，不含八度）。
 * 用于移调结果的呈现——环上主音名与顺阶和弦保持项目既有调序不变。
 * @param note - 音名（如 "C#" / "Db"）
 * @param preference - 记法偏好
 * @returns 归一后的音名，无等音异名时原样返回
 */
export function preferSpelling(
  note: string,
  preference: AccidentalPreference,
): string {
  const map = preference === "flat" ? SHARP_TO_FLAT : FLAT_TO_SHARP;
  return map[note] ?? note;
}

/* ── 环几何 ───────────────────────────────────────────── */

/**
 * 五度偏移序列：0..6 后接 −5..−1。
 * 这正是「±7 限制内」的 12 个调，与 `QuickChangeKeyToolbar` 的调序一致——不复用会两套调序打架。
 */
export const FIFTHS_OFFSETS = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];

/** 环上位置总数 */
export const POSITION_COUNT = FIFTHS_OFFSETS.length;

/** 圈上的一次选中：位置 + 所在环（调式） */
export type KeySelection = { position: number; mode: KeyMode };

/** 每个扇区占的角度（度） */
export const SECTOR_ANGLE = 360 / POSITION_COUNT;

/** 位置 0（C）所在的角度：12 点方向 */
export const START_ANGLE = -90;

/**
 * 把环上位置换算为扇区中心角。
 * @param position - 环上位置（0 = C，顺时针递增）
 * @returns 角度（度）——0° 为 3 点方向，顺时针为正
 */
export function positionToAngle(position: number): number {
  return START_ANGLE + position * SECTOR_ANGLE;
}

/** 把角度换算回环上位置（就近取整，用于指针拖拽） */
export function angleToPosition(angle: number): number {
  const raw = Math.round((angle - START_ANGLE) / SECTOR_ANGLE);
  return ((raw % POSITION_COUNT) + POSITION_COUNT) % POSITION_COUNT;
}

/* ── 环数据 ───────────────────────────────────────────── */

export type CircleKey = {
  /** 环上位置（0 = C，顺时针递增） */
  position: number;
  /** 五度偏移（−5..6） */
  fifths: number;
  /** 扇区中心角（度） */
  angle: number;
  /** 外环大调主音 */
  majorTonic: string;
  /** 外环大调的升降号数（正为升、负为降） */
  majorAlteration: number;
  /** 中环关系小调主音字母，**不含** "m" */
  minorTonic: string;
  /** 中环关系小调的升降号数（与同格大调相同） */
  minorAlteration: number;
  /** 调号记号里升降号的个数 */
  signatureCount: number;
  /** 调号记号的升降方向 */
  signatureAccidentals: "sharp" | "flat" | "natural";
};

const SHARP_GLYPH = "♯";
const FLAT_GLYPH = "♭";

/**
 * 构建整个环的数据（12 格 × 三环内容）。
 * 每格只需 `Key.majorKey` 一次读数即可拿到外环主音、升降号数与关系小调。
 * @returns 按环上位置升序排列的 12 个 `CircleKey`
 */
export function buildCircleData(): CircleKey[] {
  return FIFTHS_OFFSETS.map((fifths, position) => {
    const majorTonic = Note.transposeFifths("C", fifths);
    const majorKey = Key.majorKey(majorTonic);
    const minorTonic = majorKey.minorRelative;
    // ⚠️ 只传主音字母；传 "F#m" 会静默返回空对象
    const minorKey = Key.minorKey(minorTonic);

    const alteration = majorKey.alteration;
    const signatureCount = Math.abs(alteration);

    return {
      position,
      fifths,
      angle: positionToAngle(position),
      majorTonic,
      majorAlteration: alteration,
      minorTonic,
      minorAlteration: minorKey.alteration,
      signatureCount,
      signatureAccidentals:
        signatureCount === 0 ? "natural" : alteration > 0 ? "sharp" : "flat",
    };
  });
}

/**
 * 调号记号的显示文本（环内层用）。
 * @param key - 环上某一格
 * @returns 如 `"0"` / `"2♯"` / `"3♭"`
 */
export function signatureText(key: CircleKey): string {
  if (key.signatureCount === 0) return "0";
  const glyph = key.signatureAccidentals === "sharp" ? SHARP_GLYPH : FLAT_GLYPH;
  return `${key.signatureCount}${glyph}`;
}

/** 某个环上位置上、某一环的主音名 */
export function tonicOf(key: CircleKey, mode: KeyMode): string {
  return mode === "major" ? key.majorTonic : key.minorTonic;
}

/** 调性显示名（小调补 "m"，与 `Key.minorKey` 只收主音字母的约定互补） */
export function keyDisplayName(tonic: string, mode: KeyMode): string {
  return mode === "minor" ? `${tonic}m` : tonic;
}

/**
 * 按主音 + 调式在环上定位。用 chroma 比较以容忍等音异名（G# 与 Ab 视为同一位置）。
 * @param circle - `buildCircleData` 的结果
 * @param tonic - 主音字母（不含 "m"）
 * @param mode - 大调 / 小调
 * @returns 环上位置，未命中时回退 0
 */
export function findPosition(
  circle: readonly CircleKey[],
  tonic: string,
  mode: KeyMode,
): number {
  const chroma = Note.chroma(tonic);
  const index = circle.findIndex(
    (key) => Note.chroma(tonicOf(key, mode)) === chroma,
  );
  return index >= 0 ? index : 0;
}

/* ── 顺阶和弦与级数 ───────────────────────────────────── */

export type DiatonicChord = {
  /** 罗马数字级数（含大小写与品质标记，如 "I" / "ii" / "vii°"） */
  roman: string;
  /** 和弦记号 */
  symbol: string;
  /** `tonal` 的品质名（"Major" / "Minor" / "Diminished" / "Augmented" …） */
  quality: string;
};

/** 需要转小写的品质——小写罗马数字表示小三与减三和弦 */
const LOWERCASE_QUALITIES = new Set([
  "Minor",
  "Diminished",
  "Half Diminished",
  "Augmented",
]);

/** 品质后缀标记 */
const QUALITY_MARKS: Record<string, string> = {
  Diminished: "°",
  "Half Diminished": "ø",
  Augmented: "+",
};

/**
 * 由顺阶三和弦推出带大小写的罗马数字级数。
 *
 * `tonal` 的 `grades` 恒为大写（小调自带降号前缀），所以大小写与「°」必须
 * 从 `Chord.get(symbol).quality` 反推——这是本函数存在的唯一理由。
 * @param triads - 顺阶三和弦记号列表（如 `["C","Dm","Em","F","G","Am","Bdim"]`）
 * @param grades - `tonal` 给出的级数列表
 * @returns 级数 / 记号 / 品质三元组
 */
export function toRomanNumerals(
  triads: readonly string[],
  grades: readonly string[],
): DiatonicChord[] {
  return triads.map((symbol, index) => {
    const grade = grades[index] ?? "";
    const quality = Chord.get(symbol).quality;
    const numeral = LOWERCASE_QUALITIES.has(quality)
      ? grade.toLowerCase()
      : grade;

    return {
      roman: `${numeral}${QUALITY_MARKS[quality] ?? ""}`,
      symbol,
      quality,
    };
  });
}

/**
 * 取某调的 7 个顺阶三和弦（默认展示形态；七和弦可由 `tonal` 的 `chords` 直接替换）。
 * @param tonic - 主音字母（不含 "m"）
 * @param mode - 大调 / 小调（小调取自然小调）
 */
export function getDiatonicChords(
  tonic: string,
  mode: KeyMode,
): DiatonicChord[] {
  if (mode === "major") {
    const key = Key.majorKey(tonic);
    return toRomanNumerals(key.triads, key.grades);
  }
  const natural = Key.minorKey(tonic).natural;
  return toRomanNumerals(natural.triads, natural.grades);
}

/**
 * 取某调的音阶音名（小调取自然小调）。
 * @param tonic - 主音字母（不含 "m"）
 * @param mode - 大调 / 小调
 */
export function getScaleNotes(tonic: string, mode: KeyMode): string[] {
  return mode === "major"
    ? [...Key.majorKey(tonic).scale]
    : [...Key.minorKey(tonic).natural.scale];
}

/* ── 近关系调 ─────────────────────────────────────────── */

export type RelationKind = "dominant" | "subdominant" | "relative" | "parallel";

export type KeyRelation = {
  kind: RelationKind;
  /** 关系调主音字母（不含 "m"） */
  tonic: string;
  mode: KeyMode;
  /** 关系调所在的环上位置 */
  position: number;
};

/** 关系的呈现顺序：由近及远 */
export const RELATION_ORDER: RelationKind[] = [
  "dominant",
  "subdominant",
  "relative",
  "parallel",
];

/**
 * 求某调的近关系调（属调 / 下属调 / 关系大小调 / 同名调）。
 *
 * 同名调（如 C 大调 ↔ c 小调）在环上相隔三格，是唯一「跨圈」的关系——
 * 它正是需要连线表达的原因。位置一律由主音查表得出，而非角度加减，
 * 以免把等音异名与环序约定混在一起。
 * @param circle - `buildCircleData` 的结果
 * @param selection - 当前选中的环上位置与调式
 */
export function buildRelations(
  circle: readonly CircleKey[],
  selection: { position: number; mode: KeyMode },
): KeyRelation[] {
  const slot = circle[selection.position];
  const { mode } = selection;
  const tonic = tonicOf(slot, mode);
  const opposite: KeyMode = mode === "major" ? "minor" : "major";

  const candidates: { kind: RelationKind; tonic: string; mode: KeyMode }[] = [
    { kind: "dominant", tonic: Note.transposeFifths(tonic, 1), mode },
    { kind: "subdominant", tonic: Note.transposeFifths(tonic, -1), mode },
    {
      kind: "relative",
      tonic: tonicOf(slot, opposite),
      mode: opposite,
    },
    { kind: "parallel", tonic, mode: opposite },
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    position: findPosition(circle, candidate.tonic, candidate.mode),
  }));
}

/* ── 移调 ─────────────────────────────────────────────── */

export type TransposedToken = {
  /** 用户输入的原始记号 */
  input: string;
  /** 移调后的记号；输入非法时为 null */
  output: string | null;
  valid: boolean;
};

/** 按空白 / 逗号 / 竖线 / 短横切分和弦进行 */
export function parseProgression(input: string): string[] {
  return input
    .split(/[\s,|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * 把和弦进行整体移到目标调。
 *
 * 语义：**按目标主音的音高整体平移**，保持各和弦的性质与级数关系不变。
 * 目标调为小调时同样只按主音音高移调，不改变和弦性质。
 * @param input - 和弦进行文本（如 "C - Am7 - F - G7"）
 * @param fromTonic - 源调主音字母（不含 "m"）
 * @param toTonic - 目标调主音字母（不含 "m"）
 * @param preference - 音名记法偏好，用于归一结果拼写
 */
export function transposeProgression(
  input: string,
  fromTonic: string,
  toTonic: string,
  preference: AccidentalPreference = "flat",
): TransposedToken[] {
  const interval = Note.distance(fromTonic, toTonic);

  return parseProgression(input).map((token) => {
    const chord = Chord.get(token);
    if (chord.empty || !chord.tonic || !interval) {
      return { input: token, output: null, valid: false };
    }

    const rootPart = chord.symbol.split("/")[0];
    // 从根和弦记号里切出品质后缀（"Am7" → "m7"），而不是从带低音的完整记号切，
    // 否则 "C/E" 会把 "/E" 也当成后缀，拼出 "Eb/E/G"。
    const suffix = rootPart.slice(chord.tonic.length);
    const root = preferSpelling(
      Note.transpose(chord.tonic, interval),
      preference,
    );
    const bass = chord.bass
      ? `/${preferSpelling(Note.transpose(chord.bass, interval), preference)}`
      : "";

    return { input: token, output: `${root}${suffix}${bass}`, valid: true };
  });
}

/* ── 播放 ─────────────────────────────────────────────── */

/**
 * 把音名 + 八度转为 MIDI 数字。
 *
 * 走 MIDI 数字而不是音名字符串，是为了绕开 `E#` / `B#` / `Cb` 这类
 * 采样器未必认得的异常拼写（F# 大调的顺阶和弦含 `E#dim`）。
 * @param note - 音名（可含升降号）
 * @param octave - 八度，默认 4
 * @returns MIDI 数字；无法解析时按 chroma 折算到该八度
 */
export function noteToPlayableMidi(note: string, octave = 4): number {
  const midi = Note.midi(`${note}${octave}`);
  if (midi != null) return midi;

  const chroma = Note.chroma(note);
  if (chroma == null) return 60;
  return (octave + 1) * 12 + chroma;
}

/**
 * 把一列音名（同一八度附近）铺成上行 MIDI 音列——音高回落时自动升八度，
 * 避免 `Cadd9` 的 D 跑到 G 下面。
 * @param notes - 音名列表
 * @param startOctave - 起始八度，默认 4
 */
export function voiceNotesToMidi(
  notes: readonly string[],
  startOctave = 4,
): number[] {
  let octave = startOctave;
  let previousChroma = -1;

  return notes.map((name) => {
    const chroma = Note.chroma(name) ?? 0;
    if (previousChroma >= 0 && chroma <= previousChroma) octave += 1;
    previousChroma = chroma;
    return noteToPlayableMidi(name, octave);
  });
}

/**
 * 取某和弦的 MIDI 音列（供试听）。
 * @param symbol - 和弦记号（如 "Cmaj7"）
 * @param startOctave - 起始八度，默认 3（和弦试听比音阶低一个八度更耐听）
 */
export function chordToMidi(symbol: string, startOctave = 3): number[] {
  const chord = Chord.get(symbol);
  if (chord.empty) return [];
  return voiceNotesToMidi(chord.notes, startOctave);
}
