/**
 * 乐谱滚动（Score Scroll）模块类型定义
 *
 * 领域术语见 CONTEXT.md：扫描线、谱面行位置、渐显。
 */

/** 背景样式预设（custom = 用户自选纯色，见 ScoreAppearanceSettings.customColor） */
export type ScoreBackgroundStyle = "theme" | "paper" | "custom";

/**
 * 谱面显示设置（0-100 的连续参数为百分比）
 *
 * 播放动画：飞入（fly-in）、符头染色（glow）、扫描线。
 * 术语见 CONTEXT.md：飞入（Fly-in）、符头染色（Notehead Tint）。
 */
export interface ScoreDisplaySettings {
  /** 扫描线位置：竖直扫描线在视口内的水平位置（0=最左，100=最右），当前发声音符对齐于此 */
  scanlinePosition: number;
  /** 谱面行位置：单行谱线在视口内的垂直位置（0=顶部，100=底部） */
  snapPosition: number;
  /** 是否显示扫描线（竖直播放指示线） */
  showScanline: boolean;
  /** 飞入：横向飞入距离（0-200，100 ≈ 800px，自扫描线右侧飞入） */
  flyInDistance: number;
  /** 飞入：纵向散落范围（0-200，100 ≈ ±200px 垂直散落） */
  flyInScatter: number;
  /** 飞入：起步延迟（0-200，100 ≈ 600px 的额外起步距离） */
  flyInDelay: number;
  /**
   * 飞入带宽度（0-100，100 ≈ 300px，默认 50 = 150px）：
   * 图元越过揭示边缘（视口右缘内缩 50px）后在此宽度内完成飞入，
   * 见 ADR 0012（空间揭示带）
   */
  flyInDuration: number;
  /** 飞出开关（默认开）：已播放音符越过扫描线后飞出消失 */
  showFlyOut: boolean;
  /** 飞出：横向飞出距离（0-200，与飞入距离同量纲） */
  flyOutDistance: number;
  /** 飞出：纵向散落范围（0-200） */
  flyOutScatter: number;
  /** 飞出：起步延迟（0-200） */
  flyOutDelay: number;
  /** 飞出带宽度（0-200，与飞入带宽度同量纲）：音符越过扫描线后在此宽度内完成飞出 */
  flyOutDuration: number;
  /** 高光：作用范围（0-200，映射为播放头两侧的世界坐标 px 半径） */
  glowRange: number;
  /** 高光：强度（0-100，映射染色最大插值比例） */
  glowIntensity: number;
  /** 飞入开关（默认开） */
  showFlyIn: boolean;
  /** 符头染色开关（默认开） */
  showGlow: boolean;
  /** 染色颜色（hex）：播放头附近音符 fill/stroke 的插值目标 */
  tintColor: string;
}

/** 外观设置 */
export interface ScoreAppearanceSettings {
  /** 背景样式 */
  background: ScoreBackgroundStyle;
  /** 自定义背景色（hex，仅 background="custom" 时使用） */
  customColor: string;
}

/** 乐谱滚动模块设置（持久化） */
export interface ScoreScrollSettings {
  display: ScoreDisplaySettings;
  appearance: ScoreAppearanceSettings;
}

/** 从 OSMD 提取的单个音符信息（用于播放同步与滚动定位） */
export interface ScoreNoteInfo {
  /** MIDI 音高（0-127），无固定音高的音符（如休止符）不会出现在列表中 */
  midi: number;
  /** 起始拍（四分音符 = 1 拍），来自 OSMD 音符的绝对时间戳 */
  beat: number;
  /** 时值（拍），用于乐谱驱动播放的发声时长 */
  durationBeats: number;
  /**
   * 谱表索引（从 0 开始，跨声部全局编号）。
   * 取自 OSMD 图形模型外层 GraphicalMeasures 的下标；三维乐谱按此分轨。
   * 可选字段：既有测试夹具不含此值时按 0（单一谱表）处理。
   */
  staffIndex?: number;
  /** 全局小节索引（从 0 开始） */
  measureIndex: number;
  /** 音符头在谱面 SVG 坐标系中的外接矩形 */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 乐谱元信息（对齐原站顶部信息栏） */
export interface ScoreMetaInfo {
  /** 曲目标题 */
  title: string;
  /** 小节线数量 */
  barlines: number;
  /** 小节数量 */
  measures: number;
  /** 拍号，如 "4/4"；未知为 "-" */
  timeSignature: string;
  /** 调号，如 "C 大调"；未知为 "-" */
  keySignature: string;
}

/** 乐谱小节的时间范围信息 */
export interface ScoreMeasureInfo {
  /** 全局小节索引（从 0 开始） */
  index: number;
  /** 起始拍 */
  startBeat: number;
  /** 结束拍 */
  endBeat: number;
  /**
   * 图形小节左缘 x（px，缩放后内容坐标）；
   * 缺省/未知时不参与节拍→坐标锚点
   */
  x?: number;
}

/** 谱面系统行（一行谱面）的几何与时间范围，用于滚动同步 */
export interface ScoreSystemInfo {
  index: number;
  /** 起始拍 */
  startBeat: number;
  /** 结束拍 */
  endBeat: number;
  /** 系统行顶部 y 坐标（px，含当前 zoom） */
  topY: number;
  /** 系统行底部 y 坐标（px，含当前 zoom） */
  bottomY: number;
}

/** 播放状态（非持久化，由播放器驱动） */
export type ScorePlaybackState = "idle" | "playing" | "paused";
