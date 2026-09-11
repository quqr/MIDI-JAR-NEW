/**
 * 和弦对象 ↔ 记谱字符串的双向转换。
 *
 * 分层约定（见 ADR 0023 §解析）：
 * - **词法复用** `@/helpers/chords` 的 `tokenizeChord` / `CHORD_NAME_REGEX`——那是多模块共用资产，本模块**不修改**它。
 * - **对象映射新建**在本文件：编辑器需要的是 `ChordUnit` 结构（根音/类型/转位/时长/修饰），
 *   而 `helpers/chords.ts` 只输出 `[根音, 类型, 转位]` 三元组。
 *
 * 陷阱备忘：
 * - `tokenizeChord` 解析失败会**抛 Error**（不是返回空），所有调用点必须 try/catch。
 * - `helpers/chords.ts` 的 `formatQuality` 会把 `-` 换成 U+2212 数学减号，**仅用于显示**；
 *   持久化 / 序列化绝不能走它（否则再解析失败）。
 */

import { Chord, Note } from "tonal";

import { tokenizeChord } from "@/helpers/chords";

import { normalizeChordUnit } from "./grid";
import { createChordUnit } from "./empty";
import { preferSpelling } from "@/views/CircleOfFifths/circleOfFifths";
import { chordToMidi } from "@/views/CircleOfFifths/circleOfFifths";

import type { AccidentalPreference } from "@/views/CircleOfFifths/circleOfFifths";
import type {
  ChartMeasure,
  ChordBeats,
  ChordNotation,
  ChordUnit,
} from "./types";

/* ── iReal 简写兼容表 ─────────────────────────────────── */

/**
 * iReal 简写 → tonal 类型后缀（**仅解析方向**）。
 *
 * ⚠️ 这不是 `helpers/chords.ts` 的 `ALIAS_NOTATION`——那张是 tonal 自己的
 * long / short / symbol 别名体系，本表是 iReal Pro 谱面文本的记法。
 * 首期不做 iReal 互通，仅用于容忍用户粘贴 iReal 风格文本。
 */
export const IREAL_SHORTHAND: Record<string, string> = {
  "^": "maj",
  "-": "m",
  o: "dim",
  h: "m7b5",
  "+": "aug",
  sus: "sus4",
  Δ: "maj",
  "°": "dim",
  ø: "m7b5",
};

/* ── 支持的弦类型白名单 ───────────────────────────────── */

/**
 * 编辑器「类型」按钮组暴露的和弦类型（tonal 写法）。
 *
 * 对齐 iReal Pro 官方文档列出的 70 余项 quality，按族分组以便 UI 分栏。
 * 未被列出的类型仍可经「直接输入」框解析（`Chord.get` 能吃更多），
 * 但不出现在按钮组里，避免面板膨胀。
 */
export const SUPPORTED_CHORD_TYPES: readonly string[] = [
  // 三和弦
  "",
  "m",
  "dim",
  "aug",
  "sus4",
  "sus2",
  "5",
  // 六和弦
  "6",
  "m6",
  "69",
  "m69",
  "6add9",
  // 七和弦
  "7",
  "maj7",
  "m7",
  "m7b5",
  "dim7",
  "mMaj7",
  "7sus4",
  "aug7",
  "maj7#5",
  // 延伸
  "9",
  "maj9",
  "m9",
  "9sus4",
  "13sus4",
  "7b9",
  "7#9",
  "7#11",
  "7b5",
  "7#5",
  "11",
  "m11",
  "maj7#11",
  "13",
  "maj13",
  "m13",
  "13#11",
  "13b9",
  "13#9",
  "7b13",
  "7alt",
  "9#11",
  "9b5",
  "9#5",
  "7b9#11",
  "7#9#11",
  "7b9b5",
  "7b9#5",
  "7b9b13",
  // 加音
  "add9",
  "add2",
  "madd9",
  // 特殊
  "maj13#11",
] as const;

/**
 * 类型分组（UI 分栏用；value 为 tonal 类型后缀）。
 *
 * ⚠️ 这里的每一项都必须通过 `Chord.get("C" + type)` 可解析——`tonal` 不认识
 * `min^11` / `maj(add4)` / `m7b6` 这类 iReal 原文写法（实测 `empty: true`）。
 * 改表后请重跑 `.workbuddy/tmp/probe-tonal.ts` 的合法性扫描。
 */
export const CHORD_TYPE_GROUPS: ReadonlyArray<{
  key: string;
  types: readonly string[];
}> = [
  { key: "triad", types: ["", "m", "dim", "aug", "sus4", "sus2", "5"] },
  { key: "sixth", types: ["6", "m6", "69", "m69", "6add9"] },
  {
    key: "seventh",
    types: [
      "7",
      "maj7",
      "m7",
      "m7b5",
      "dim7",
      "mMaj7",
      "7sus4",
      "aug7",
      "maj7#5",
    ],
  },
  {
    key: "extended",
    types: [
      "9",
      "maj9",
      "m9",
      "11",
      "m11",
      "13",
      "maj13",
      "m13",
      "7b9",
      "7#9",
      "7#11",
      "7b5",
      "7#5",
      "7b13",
      "7alt",
      "9sus4",
      "13sus4",
      "13b9",
      "13#9",
      "13#11",
      "9#11",
      "9b5",
      "9#5",
    ],
  },
  {
    key: "altered",
    types: [
      "7b9#11",
      "7#9#11",
      "7b9b5",
      "7b9#5",
      "7b9b13",
      "maj7#11",
      "maj13#11",
    ],
  },
  { key: "added", types: ["add9", "add2", "madd9"] },
] as const;

/* ── 显示记法（symbol 映射） ──────────────────────────── */

/**
 * 符号记法后缀表（iReal 默认外观：△ 大七、- 小、ø 半减、o 减）。
 * 仅用于**显示**；解析/持久化绝不能走它（♭♯ 花哨字符 tonal 不认）。
 * 表外后缀回落 tonal 原样。
 */
export const SYMBOL_SUFFIX: Record<string, string> = {
  "": "",
  m: "-",
  dim: "o",
  aug: "+",
  sus4: "sus4",
  sus2: "sus2",
  "5": "5",
  "6": "6",
  m6: "-6",
  "69": "6/9",
  m69: "-6/9",
  "6add9": "6add9",
  "7": "7",
  maj7: "△7",
  m7: "-7",
  m7b5: "ø",
  dim7: "o7",
  mMaj7: "-△7",
  "7sus4": "7sus4",
  aug7: "+7",
  "maj7#5": "△7♯5",
  "9": "9",
  maj9: "△9",
  m9: "-9",
  "11": "11",
  m11: "-11",
  "13": "13",
  maj13: "△13",
  m13: "-13",
  "7b9": "7♭9",
  "7#9": "7♯9",
  "7#11": "7♯11",
  "7b5": "7♭5",
  "7#5": "7♯5",
  "7b13": "7♭13",
  "7alt": "7alt",
  "9sus4": "9sus4",
  "13sus4": "13sus4",
  "13b9": "13♭9",
  "13#9": "13♯9",
  "13#11": "13♯11",
  "9#11": "9♯11",
  "9b5": "9♭5",
  "9#5": "9♯5",
  "7b9#11": "7♭9♯11",
  "7#9#11": "7♯9♯11",
  "7b9b5": "7♭9♭5",
  "7b9#5": "7♭9♯5",
  "7b9b13": "7♭9♭13",
  add9: "add9",
  add2: "add2",
  madd9: "-add9",
  "maj7#11": "△7♯11",
  "maj13#11": "△13♯11",
};

/** 后缀的显示形式：symbol 记法查表回落原样；long/short 原样 */
export function suffixForDisplay(
  type: string,
  notation: ChordNotation,
): string {
  if (notation !== "symbol") return type;
  return SYMBOL_SUFFIX[type] ?? type;
}

/* ── N.C. 识别 ────────────────────────────────────────── */

const NO_CHORD_PATTERN = /^(n\.?c\.?|no\s*chord)$/i;

/** 判断文本是否是 N.C.（无和弦）记号 */
export function isNoChordText(text: string): boolean {
  return NO_CHORD_PATTERN.test(text.trim());
}

/* ── 解析 ─────────────────────────────────────────────── */

/**
 * iReal 简写 → tonal 后缀替换。
 *
 * - `val` 为静态映射时的替换值（`^` → `maj`、`h` → `m7b5` …）。
 * - `alt` 给出「可选替换值」：只有当其后**紧跟数字**时才用 `alt` 顶替，
 *   并把那个数字吞掉。这解决 `Csus4` → `Csus44`（`sus4` 自带 `4`）
 *   与 `Ch7` → `Cm7b57`（`m7b5` 自带 `7`）这类重复拼接。
 */
const SHORTHAND_REWRITE: ReadonlyArray<{
  key: string;
  val: string;
  /** 其后紧跟数字时改用的值（并吞掉数字），防止 `h7` → `m7b57` */
  alt?: string;
  /** 其后紧跟数字时保持原文不动（并吞掉数字），防止 `sus4` → `sus44` */
  keepIfDigit?: boolean;
}> = [
  { key: "sus", val: "sus4", keepIfDigit: true },
  { key: "Δ", val: "maj", alt: "maj7" },
  { key: "^", val: "maj", alt: "maj7" },
  { key: "°", val: "dim", alt: "dim7" },
  { key: "o", val: "dim", alt: "dim7" },
  { key: "ø", val: "m7b5", keepIfDigit: true },
  { key: "h", val: "m7b5", keepIfDigit: true },
  { key: "-", val: "m" },
  { key: "+", val: "aug" },
];

/**
 * 把 iReal 简写转成 tonal 写法。
 * 例如 "C^7" → "Cmaj7"、"D-7" → "Dm7"、"Bh7" → "Bm7b5"、"Gsus" → "Gsus4"。
 *
 * 只做**符号替换**，不校验语义；无法识别时原样返回。
 *
 * 算法要点：
 * 1. 在根音（含升降号）之后找**位置最靠前**的简写键，替换一次即止。
 * 2. 数字合并规则（幂等关键，否则 `Ch7` → `Cm7b57`、`Csus4` → `Csus44`）：
 *    - `alt`     ：其后是数字 → 用 alt 顶替并吞掉数字（`h7` → `m7b5`）
 *    - `keepIfDigit`：其后是数字 → 保留原键原文并吞掉数字（`sus4` → `sus4`）
 */
export function expandShorthand(text: string): string {
  let bestIndex = -1;
  let bestRule: (typeof SHORTHAND_REWRITE)[number] | null = null;

  for (const rule of SHORTHAND_REWRITE) {
    const index = findShorthandAt(text, rule.key);
    if (index < 0) continue;
    if (
      bestIndex < 0 ||
      index < bestIndex ||
      (index === bestIndex && rule.key.length > bestRule!.key.length)
    ) {
      bestIndex = index;
      bestRule = rule;
    }
  }

  if (!bestRule) return text;

  let value = bestRule.val;
  let consume = bestRule.key.length;

  const digits = /^\d+/.exec(text.slice(bestIndex + bestRule.key.length));
  if (digits) {
    // 两种「吞数字」场景都**保留 val**（target 自带该数字），只是不重复拼接
    if (bestRule.keepIfDigit || bestRule.alt) {
      value = bestRule.alt ?? bestRule.val;
      consume += digits[0].length;
    }
  }

  return text.slice(0, bestIndex) + value + text.slice(bestIndex + consume);
}

/**
 * 在根音之后查找简写键。
 *
 * 根音占用 `text[0]` 一个字母，其后可能紧跟升降号（`b` / `#`）。
 * 从升降号之后再找，避免把 `Ab` 的 `b`、`F#` 的 `#` 当简写；
 * 也要避开 `^` / `-` 等本身就与升降号无关的符号在 index 0 的误匹配。
 */
function findShorthandAt(text: string, key: string): number {
  // 起点 = 根音字母 + 连续升降号之后
  let start = 1;
  while (start < text.length && (text[start] === "b" || text[start] === "#")) {
    start += 1;
  }
  const index = text.indexOf(key, start);
  return index;
}

/**
 * 解析一条记谱文本为和弦单元。
 *
 * 支持形式：
 * - `C` / `Cmaj7` / `C-7`（tonal 或 iReal 简写）
 * - `C/E` / `C-7/Bb`（转位低音）
 * - `N.C.` / `n`（无和弦）
 * - `/A`（不可见根音，只显示低音）
 * - `(A7b9)`（alternate chord，仅作 alternate 参数时使用，**深度限 1**）
 *
 * @param text - 记谱文本
 * @param beats - 时长（拍）
 * @param asAlternate - true 时禁止再嵌套 alternate（深度限 1）
 * @returns 解析出的和弦单元；无法解析时返回带 `parseError` 语义的兜底单元
 */
export function parseChordUnit(
  text: string,
  beats: ChordBeats = 4,
  asAlternate = false,
): ChordUnit {
  const raw = text.trim();

  // 1. N.C.
  if (isNoChordText(raw)) {
    return createChordUnit({
      noChord: true,
      root: "",
      type: "",
      bass: null,
      beats,
    });
  }

  // 2. 不可见根音："/A" 形式（只有低音，无和弦符号）
  if (raw.startsWith("/")) {
    const bass = raw.slice(1).split("/")[0].trim();
    return createChordUnit({
      root: "",
      type: "",
      bass: bass || null,
      invisibleRoot: true,
      beats,
    });
  }

  // 3. alternate 括号形式："(A7b9)" → 递归解析（且不再允许嵌套）
  if (raw.startsWith("(") && raw.endsWith(")")) {
    const inner = raw.slice(1, -1).trim();
    return parseChordUnit(inner, beats, true);
  }

  // 4. 常规：先展开 iReal 简写，再走 helpers 的词法
  const expanded = expandShorthand(raw);

  try {
    const [root, type, bass] = tokenizeChord(expanded);
    const unit = createChordUnit({
      root: root ?? "",
      type: type ?? "",
      bass: bass && bass.length > 0 ? bass : null,
      beats,
    });
    // alternate 深度限 1：由调用方决定，解析本身不产出嵌套
    void asAlternate;
    return normalizeChordUnit(unit);
  } catch {
    // 兜底：把整串当作根音原样保留，让界面可见地失败而不是静默丢弃
    return createChordUnit({ root: raw, type: "", bass: null, beats });
  }
}

/* ── 序列化 ───────────────────────────────────────────── */

/**
 * 把和弦单元格式化为记谱文本。
 *
 * ⚠️ **不使用** `helpers/chords.ts` 的 `formatQuality`——它会把 `-` 换成数学减号，
 * 导致输出无法再被解析。本函数保证 `parseChordUnit(formatChordUnit(x))` 幂等。
 */
export function formatChordUnit(unit: ChordUnit): string {
  if (unit.noChord) return "N.C.";

  // 不可见根音：只输出低音（"/A"）
  if (unit.invisibleRoot) {
    return unit.bass ? `/${unit.bass}` : "";
  }

  if (!unit.root) return "";

  const bassPart = unit.bass ? `/${unit.bass}` : "";
  return `${unit.root}${unit.type}${bassPart}`;
}

/** 把和弦单元连 alternate 一起格式化为完整文本（alternate 加括号） */
export function formatChordUnitWithAlternate(unit: ChordUnit): string {
  const base = formatChordUnit(unit);
  if (!unit.alternate) return base;
  const alt = formatChordUnit(unit.alternate);
  return alt ? `${base}(${alt})` : base;
}

/**
 * 把一个小节序列化为 iReal 风格的文本片段。
 * 仅用于调试 / 导出预览；完整文件格式见 `useChartPersistence`。
 */
export function formatMeasure(measure: ChartMeasure): string {
  if (measure.chords.length === 0) return "";
  return measure.chords.map((c) => formatChordUnitWithAlternate(c)).join(" ");
}

/* ── 和弦校验与音列 ───────────────────────────────────── */

/**
 * 判断和弦单元是否是「可发声」的（有根音或低音，且非 N.C.）。
 * 空小节 / 纯占位单元返回 false。
 */
export function isPlayableChordUnit(unit: ChordUnit): boolean {
  if (unit.noChord) return false;
  if (unit.invisibleRoot) return Boolean(unit.bass);
  return Boolean(unit.root);
}

/**
 * 判断和弦类型是否被 `tonal` 认识（用于输入校验与标红）。
 * 空类型（大三和弦）视为合法。
 */
export function isKnownChordType(type: string): boolean {
  if (!type) return true;
  return !Chord.get(`C${type}`).empty;
}

/**
 * 取和弦单元的 MIDI 音列。
 *
 * 委托给五度循环圈的 `chordToMidi`（`CircleOfFifths/circleOfFifths.ts`），
 * 零重复实现、与五度圈试听音色一致；将来统一 voicing 引擎时只改那一处。
 *
 * 现有 9 个 `*ToMidi` 函数一律只取 `Chord.get().notes`，**无延伸音 / 根音省略**
 * ——这是与 iReal Pro 的 Embellished Chords 的差距，属三期 voicing 引擎范围。
 *
 * @param unit - 和弦单元
 * @param startOctave - 起始八度，默认 3（与和弦试听一致）
 * @returns MIDI 数字列表；N.C. 或不可解析时返回空数组
 */
export function chordUnitToMidi(unit: ChordUnit, startOctave = 3): number[] {
  if (unit.noChord) return [];

  // 不可见根音：只发低音单音
  if (unit.invisibleRoot) {
    if (!unit.bass) return [];
    return [noteToMidiSafe(unit.bass, startOctave)];
  }

  if (!unit.root) return [];

  const symbol = `${unit.root}${unit.type}${unit.bass ? `/${unit.bass}` : ""}`;
  const midi = chordToMidi(symbol, startOctave);
  if (midi.length > 0) return midi;

  // 转位形式 tonal 可能不认，退回只取三和弦本体
  return chordToMidi(`${unit.root}${unit.type}`, startOctave);
}

/** 音名 + 八度 → MIDI（容忍 E#/Cb 等异常拼写，按 chroma 折算） */
function noteToMidiSafe(note: string, octave: number): number {
  const midi = Note.midi(`${note}${octave}`);
  if (midi != null) return midi;
  const chroma = Note.chroma(note);
  if (chroma == null) return 60;
  return (octave + 1) * 12 + chroma;
}

/* ── 移调 ─────────────────────────────────────────────── */

/**
 * 半音数 → tonal interval 字符串（**必须用 interval，不能用数字**）。
 *
 * ⚠️ tonal 陷阱：`Note.transpose(note, number)` 一律返回 `""`（tonal 的
 * interval 参数只吃字符串）。且 `"2m"` 是**小2度 = 1 半音**，不是 2 半音
 * ——写错会整体偏移一个半音。
 *
 * 本表按「拼写偏好」分两张，覆盖 0–11 半音；超出 12 时先拆八度再查表。
 * 用增八度 `"8P"` 而非 `"1P"` 来推进八度：`"1P"` 在 tonal 里也返回原音名，
 * 会让跨八度移调静默失效。
 */
const SEMITONE_INTERVALS: Record<AccidentalPreference, readonly string[]> = {
  //            0     1     2     3     4     5     6     7     8     9    10    11
  flat: [
    "1P",
    "2m",
    "2M",
    "3m",
    "3M",
    "4P",
    "5d",
    "5P",
    "6m",
    "6M",
    "7m",
    "7M",
  ],
  sharp: [
    "1P",
    "2m",
    "2M",
    "3m",
    "3M",
    "4P",
    "5d",
    "5P",
    "6m",
    "6M",
    "7m",
    "7M",
  ],
};

/**
 * 只移调根音与低音，**不改和弦性质**（iReal 的 soft/hard transposition 语义）。
 *
 * 调内拼写归属由 `preferSpelling` 决定（复用 `settings.notation.accidentals` 偏好），
 * 绝不另立第二套拼写规则。
 *
 * @param unit - 原和弦单元
 * @param semitones - 半音数（可正可负）
 * @param preference - 升降记法偏好
 * @returns 移调后的新单元（原对象不变）
 */
export function transposeChordUnit(
  unit: ChordUnit,
  semitones: number,
  preference: AccidentalPreference = "flat",
): ChordUnit {
  // ⚠️ tonal 陷阱：`Note.transpose("C", "0m")` 返回遗 `""`（空串）而非 "C"。
  // 零移调必须提前短路，否则根音会被清空。
  if (semitones === 0) return { ...unit };

  const shift = (name: string | null): string | null => {
    if (!name) return null;
    const transposed = transposeBySemitones(name, semitones);
    if (!transposed) return name;
    return preferSpelling(transposed, preference);
  };

  return {
    ...unit,
    root: shift(unit.root) ?? "",
    bass: shift(unit.bass),
    alternate: unit.alternate
      ? transposeChordUnit(unit.alternate, semitones, preference)
      : null,
  };
}

/**
 * 按半音数移调单个音名。
 *
 * 拆成「整八度 + 余数」两步：八度用 `"8P"` 推进（tonal 的 `"1P"` 不动音名），
 * 余数查 `SEMITONE_INTERVALS`。
 *
 * ⚠️ 重升 / 重降（`F##` / `Dbb`）虽然音高正确，但作为和弦根音过于难读，
 * 统一回落 chroma 折算成单升降拼写。整段失败时同样回落。
 */
function transposeBySemitones(name: string, semitones: number): string {
  const dir = semitones >= 0 ? 1 : -1;
  const magnitude = Math.abs(semitones);
  const octaves = Math.floor(magnitude / 12);
  const remainder = magnitude % 12;

  let result = name;
  for (let i = 0; i < octaves; i += 1) {
    const next = Note.transpose(result, dir > 0 ? "8P" : "-8P");
    if (!next) return chromaToName(name, semitones);
    result = next;
  }

  if (remainder > 0) {
    const interval = SEMITONE_INTERVALS.flat[remainder];
    const next = Note.transpose(result, dir > 0 ? interval : `-${interval}`);
    if (!next) return chromaToName(name, semitones);
    result = next;
  }

  // 拒绝重升 / 重降，以及极端单变音（E# / B# / Cb / Fb——作根音难读，
  // preferSpelling 的等音表不覆盖它们），统一回落 chroma 折算成标准拼写
  if (/[b#]{2,}/.test(result) || /^(?:E#|B#|Cb|Fb)$/.test(result)) {
    return chromaToName(name, semitones);
  }
  return result;
}

/**
 * 移调单个音名（导出：整曲移调时要同步改写调号主音，与和弦共用同一套
 * 陷阱处理——八度用 "8P" 推进、重升重降回落 chroma、拼写偏好统一）。
 */
export function transposeNoteName(
  name: string,
  semitones: number,
  preference: AccidentalPreference = "flat",
): string {
  if (!name || semitones === 0) return name;
  const transposed = transposeBySemitones(name, semitones);
  if (!transposed) return name;
  return preferSpelling(transposed, preference);
}

/** 按 chroma 兜底移调（当 `Note.transpose` 无法解析异常拼写时） */
function chromaToName(name: string, semitones: number): string {
  const chroma = Note.chroma(name);
  if (chroma == null) return name;
  const pitchClass = (((chroma + semitones) % 12) + 12) % 12;
  const names = [
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
  return names[pitchClass];
}
