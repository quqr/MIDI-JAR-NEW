/**
 * 乐谱滚动（Score Scroll）模块类型定义
 *
 * 领域术语见 CONTEXT.md：扫描线、吸顶位置、音符命中、音符命中特效。
 */

/** 音乐字体（OSMD 内置 VexFlow 支持的 SMuFL 字体子集） */
export type ScoreMusicFont = "bravura" | "petaluma" | "gonville";

/** 背景样式预设 */
export type ScoreBackgroundStyle = "theme" | "paper" | "black" | "gradient";

/**
 * 音符命中特效参数（0-100 百分比，渲染时换算为实际值）
 * 名称与原站 score-scroll.cn 的特效面板对齐
 */
export interface ScoreEffectSettings {
  /** 飘入距离：谱面行入场动画的位移距离 */
  driftInDistance: number;
  /** 散落范围：粒子爆散时的位移半径 */
  scatterRange: number;
  /** 碎片延迟：碎片粒子间的 stagger 延迟 */
  fragmentDelay: number;
  /** 高光范围：命中高光框相对音符外接框的扩展范围 */
  highlightRange: number;
  /** 高光强度：命中高光的透明度/辉光强度 */
  highlightIntensity: number;
  /** 高光大小：命中高光框的基础尺寸 */
  highlightSize: number;
  /** 扫描线位置：扫描线在视口内的垂直位置（0=顶部，100=底部） */
  scanlinePosition: number;
  /** 吸顶位置：换行时新谱面行在视口内的吸附锚点位置 */
  snapPosition: number;
}

/** 外观设置 */
export interface ScoreAppearanceSettings {
  /** 音乐字体 */
  musicFont: ScoreMusicFont;
  /** 背景样式 */
  background: ScoreBackgroundStyle;
}

/** 乐谱滚动模块设置（持久化） */
export interface ScoreScrollSettings {
  effects: ScoreEffectSettings;
  appearance: ScoreAppearanceSettings;
}

/** 从 OSMD 提取的单个音符信息（用于同步与特效定位） */
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
