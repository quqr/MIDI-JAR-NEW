/**
 * 三维乐谱（3D Score）模块类型定义
 *
 * 领域术语见 CONTEXT.md：三维乐谱、时间轴、播放头、声部轨、符号实体、
 * 能量轨迹（引导线）、光点、相机目标跟随。
 *
 * 数据源为 MusicXML 自驱动：拍位与音长来自乐谱本身，秒值由小节速度标记
 * 构建的 tempo map 换算（见 useOsmd.extractTempo / beatMap.buildTempoMapFromMeasures）。
 * MusicXML 无逐音符力度，velocity 取常量兜底。
 *
 * 场景架构见 ADR 0018：OSMD 渲染的每个符号以轮廓挤出为三维浮雕体
 * （符号实体），保持谱面布局直铺；能量轨迹降级为引导线；相机由
 * OrbitControls 接管，注视目标平滑跟随播放头。
 */

/** 三维乐谱音符记录：乐谱音符补出秒级时间与声部轨归属后的形态 */
export interface Score3dNote {
  /** MIDI 音高（0-127） */
  midi: number;
  /** 力度（0-1）；MusicXML 无逐音符力度，取 DEFAULT_VELOCITY 兜底 */
  velocity: number;
  /** 起始时间（秒） */
  timeOn: number;
  /** 结束时间（秒） */
  timeOff: number;
  /** 起始拍（经 tempo map 换算，供谱面对齐） */
  beatOn: number;
  /** 声部轨索引（由谱表索引映射而来，连续编号） */
  trackIndex: number;
}

/** 声部轨摘要（供界面展示与显隐交互） */
export interface TrackInfo {
  /** 声部轨索引 */
  trackIndex: number;
  /** 该轨音符数 */
  noteCount: number;
  /** 该轨最低音 */
  minMidi: number;
  /** 该轨最高音 */
  maxMidi: number;
}

/** 三维空间中的一点 */
export interface TrailPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * 谱表带（px @ zoom 1）：一条谱表在一个系统行内的 y 区间与 x 范围。
 * 符号图元按 y 中心归入谱表带 → 声部轨；播放头高亮与声部显隐均以此为准。
 */
export interface StaffBand {
  /** 声部轨索引（谱表索引压缩映射后的连续编号） */
  trackIndex: number;
  /** 带上缘（px，含容差外扩） */
  yTop: number;
  /** 带下缘（px） */
  yBottom: number;
  /** 该行该谱表的 x 起点与终点（px） */
  x0: number;
  x1: number;
}

/** 时间↔谱面 x 的锚点（由音符的秒级时间与谱面像素坐标配对而来） */
export interface TimeXPoint {
  /** 时间（秒） */
  t: number;
  /** 谱面 x（px @ zoom 1） */
  x: number;
  /** 声部轨索引（该锚点所属音符） */
  trackIndex: number;
}

/**
 * 声部轨播放事件（追迹小球的数据源，ADR 0019）：
 * 同一时刻（同拍）同声部轨的所有音符符头位置——单音 1 个、和弦 N 个。
 */
export interface VoiceEvent {
  /** 时间（秒，音符起点） */
  t: number;
  /** 声部轨索引 */
  trackIndex: number;
  /** 该时刻发声的音符符头中心（谱面 px @ zoom 1，按 y 升序） */
  notes: { x: number; y: number }[];
}

/** 光点参数 */
export interface GlowParams {
  /** 光点球体半径（世界单位） */
  radius: number;
  /** 静息辉光强度 */
  baseIntensity: number;
  /** 峰值辉光强度（播放头经过符号块时的高亮上限） */
  peakIntensity: number;
}

/** 播放状态 */
export type Score3dPlaybackState = "idle" | "playing" | "paused";

/** 三维场景的时间范围（秒） */
export interface Score3dTimeRange {
  start: number;
  end: number;
}
