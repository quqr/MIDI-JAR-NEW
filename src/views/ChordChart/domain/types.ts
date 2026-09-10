/**
 * 和弦谱（Chord Chart）领域类型。
 *
 * 设计要点（见 ADR 0022）：
 * - 网格用「每小节和弦数组 + 每个和弦带时长」表达，**不用**固定 cell 数组。
 *   理由：iReal 语义下「空 cell 不推迟和弦」，cell 网格不独立承载信息；
 *   真正承载音乐信息的是「和弦 + 时长」。cell 宽度是纯渲染概念。
 * - 本文件为纯类型 + 常量，**不依赖 Vue / Pinia**，也不依赖任何运行时库。
 */

/* ── 调号与元信息 ──────────────────────────────────── */

/** 调号：主音 + 调式（小调在序列化层表达为 "A-" 形式，对象内分离） */
export interface ChartKey {
  /** 主音，12 半音拼写："C" | "Db" | "F#" ...（与 notation.key 同源） */
  tonic: string;
  mode: "major" | "minor";
}

/** 和弦记号显示记法偏好 */
export type ChordNotation = "long" | "short" | "symbol";

/** 曲目元信息 */
export interface ChartMeta {
  /** 曲名 */
  title: string;
  /** 作曲者，LastName FirstName（便于排序） */
  composer: string;
  /** 风格文本，自由填写，如 "Medium Swing"（首期不驱动播放） */
  style: string;
  /** 默认调号 */
  key: ChartKey;
  /** 速度（BPM）；首期仅存不播 */
  tempo: number;
  /** 整体重复次数（播放时的 chorus 次数） */
  repeats: number;
  /** 谱面显示记法 */
  notation: ChordNotation;
}

/* ── 和弦单元 ──────────────────────────────────────── */

/**
 * 和弦时长，单位「拍」（4/4 下一拍 = 一个 cell）。
 * 只允许离散值——iReal 的和弦时长本质上是「占多少 cell」的离散量。
 */
export type ChordBeats = 1 | 1.5 | 2 | 3 | 4;

/** 和弦显示尺寸 */
export type ChordSize = "normal" | "small";

/**
 * 一个和弦单元。
 *
 * 位置由渲染层按「前序和弦 beats 累计」推导，单元自身不存绝对位置
 * （避免两套真相源）。
 */
export interface ChordUnit {
  /** 根音，如 "C"；N.C. 时为空串 */
  root: string;
  /** 类型后缀（tonal 兼容写法），如 "m7" / "maj7" / "7b9" / "sus4"；空串 = 大三和弦 */
  type: string;
  /** 转位低音，如 "E"（表示 C/E）；无转位为 null */
  bass: string | null;
  /** 占用的拍数（= 占用的 cell 数） */
  beats: ChordBeats;
  /** 上方小和弦（alternate）；不占 cell；深度限 1（其自身 alternate 恒为 null） */
  alternate: ChordUnit | null;
  /** N.C.（无和弦）：和声与贝斯停奏，仅留鼓 */
  noChord: boolean;
  /** 不可见根音：只显示贝斯音（iReal 的 "/A"） */
  invisibleRoot: boolean;
  /** 显示尺寸 */
  size: ChordSize;
}

/* ── 小节线与拍号 ──────────────────────────────────── */

/** 小节线类型 */
export type BarlineKind =
  | "single"
  | "double"
  | "repeat-start"
  | "repeat-end"
  | "final";

/** 拍号（iReal 记号法：T44 = 4/4） */
export type TimeSignature =
  | "T44"
  | "T34"
  | "T24"
  | "T54"
  | "T64"
  | "T74"
  | "T22"
  | "T32"
  | "T58"
  | "T68"
  | "T78"
  | "T98"
  | "T12";

/**
 * 奇数拍分组，如 [3, 2] 表示 5 拍按 3+2 分组。
 * null = 使用该拍号的默认分组（5 拍默认 3+2，7 拍默认 4+3）。
 */
export type BeatGrouping = number[] | null;

/* ── 反复与跳转 ────────────────────────────────────── */

/** 1st / 2nd / 3rd ending */
export type EndingNumber = 1 | 2 | 3;

/** D.C. / D.S. 系列跳转指令 */
export type JumpCommand =
  | "dc"
  | "dc-al-fine"
  | "dc-al-coda"
  | "ds"
  | "ds-al-fine"
  | "ds-al-coda"
  | "ds-al-1st";

/**
 * 小节上的反复与跳转标记集合。
 * 首期只存不执行（无播放引擎），字段预留以冻结格式。
 */
export interface RepeatMark {
  /** Ending 编号：N1 / N2 / N3 */
  ending: EndingNumber | null;
  /** Segno 记号 */
  segno: boolean;
  /** Coda 记号 */
  coda: boolean;
  /** Fermata 记号 */
  fermata: boolean;
  /** D.C. / D.S. 跳转指令 */
  jump: JumpCommand | null;
  /** 反复次数（iReal 的 "<8x>" 文本）；null = 无 */
  playTimes: number | null;
  /** END 记号（最后一次反复时停在此处） */
  end: boolean;
}

/** 是否为空标记（全 false / null）——用于避免存空对象 */
export function isEmptyRepeatMark(mark: RepeatMark | null): boolean {
  if (!mark) return true;
  return (
    mark.ending === null &&
    !mark.segno &&
    !mark.coda &&
    !mark.fermata &&
    mark.jump === null &&
    mark.playTimes === null &&
    !mark.end
  );
}

/* ── 小节 ──────────────────────────────────────────── */

/**
 * 一个小节。
 *
 * 拍号 / 分组为小节自身的属性（iReal 支持逐小节更换拍号）；
 * 和弦位置由 chords 数组顺序 + beats 累计决定。
 */
export interface ChartMeasure {
  /** 拍号；null = 继承前一小节（首小节则用默认 4/4） */
  timeSignature: TimeSignature | null;
  /** 奇数拍分组；null = 默认分组 */
  grouping: BeatGrouping;
  /** 和弦数组；beats 之和应 <= 该小节总拍数（校验层负责，不阻塞输入） */
  chords: ChordUnit[];
  /** 小节左侧（起始）小节线 */
  barlineStart: BarlineKind;
  /** 反复与跳转标记；null = 无 */
  repeat: RepeatMark | null;
  /** 小节右侧（结束）小节线 */
  barlineEnd: BarlineKind;
}

/* ── 段落与谱面文字 ────────────────────────────────── */

/**
 * 排练记号（段落）。
 * A/B/C/D 为段落；V = verse（仅开头演奏一次）；i = intro（前奏）。
 */
export type SectionMark = "A" | "B" | "C" | "D" | "V" | "i";

/** 挂在某小节上的段落记号 */
export interface ChartSection {
  /** 目标小节索引 */
  measureIndex: number;
  mark: SectionMark;
}

/** 谱面文字（iReal 的 staff text） */
export interface ChartText {
  /** 文本内容 */
  content: string;
  /**
   * 垂直偏移（iReal 的 <*36text>）：正数向上、null 表示基线位置。
   * 首期仅存，渲染层可选使用。
   */
  verticalOffset: number | null;
  /** 所属小节索引 */
  measureIndex: number;
}

/* ── 整曲 ─────────────────────────────────────────── */

/**
 * 完整和弦谱。
 * 这是持久化与编辑的唯一根对象。
 */
export interface ChordChart {
  /** 曲目元信息 */
  meta: ChartMeta;
  /** 小节序列（顺序即演奏顺序；反复语义由小节线 + 标记表达） */
  measures: ChartMeasure[];
  /** 段落记号 */
  sections: ChartSection[];
  /** 谱面文字 */
  texts: ChartText[];
  /**
   * system 起始处的垂直间距：key = system 索引，value = 1|2|3（间隔格数）。
   * 纯外观，不影响音乐。缺失 = 0。
   */
  systemSpacing: Record<number, 1 | 2 | 3>;
}

/* ── 持久化包封 ────────────────────────────────────── */

/** 单曲持久化包封（带版本号，供将来迁移） */
export interface StoredChart {
  version: number;
  chart: ChordChart;
}

/** 曲库索引条目 */
export interface ChartLibraryEntry {
  id: string;
  title: string;
  composer: string;
  /** 最近更新时间戳（毫秒） */
  updatedAt: number;
}

/* ── 编辑器 UI 专有（不进持久化模型） ───────────────── */

/** 光标位置；chordIndex === null 表示「小节级」（用于改小节属性） */
export interface CursorPos {
  measureIndex: number;
  chordIndex: number | null;
}

/** 选区（用于批量删除 / 移调） */
export interface Selection {
  anchor: CursorPos;
  focus: CursorPos;
}

/** 校验问题 */
export interface ChartIssue {
  level: "error" | "warning";
  /** 关联小节索引；-1 表示整曲级问题 */
  measureIndex: number;
  /** i18n key */
  messageKey: string;
}
