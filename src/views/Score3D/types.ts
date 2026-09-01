/**
 * 三维乐谱（3D Score）模块类型定义
 *
 * 领域术语见 CONTEXT.md：三维乐谱、时间轴、音高轴、声部轴、播放头、
 * 声部轨、能量轨迹、光点。
 *
 * 数据源为 MusicXML 自驱动：拍位与音长来自乐谱本身，秒值由小节速度标记
 * 构建的 tempo map 换算（见 useOsmd.extractTempo / beatMap.buildTempoMapFromMeasures）。
 * MusicXML 无逐音符力度，velocity 取常量兜底。
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

/** 和弦锚点：主音控制点之外、同时发声的其他音高 */
export interface ChordAnchor {
  /** 所属主音控制点在 points 中的下标 */
  pointIndex: number;
  /** 同时发声的其他音高（已排序，不含主音） */
  otherMidis: number[];
  /** 其他音高对应的空间点（与 otherMidis 一一对应） */
  otherPoints: TrailPoint[];
}

/** 一条声部轨的能量轨迹 */
export interface TrailTrack {
  /** 声部轨索引 */
  trackIndex: number;
  /** 主音控制点（按时间升序） */
  points: TrailPoint[];
  /** 和弦锚点（光点经过时点亮） */
  chordAnchors: ChordAnchor[];
}

/** 轨迹布局参数 */
export interface TrailLayoutOptions {
  /** 每秒对应的世界坐标长度（时间轴缩放） */
  unitsPerSecond: number;
  /** 每个半音对应的世界坐标高度（音高轴缩放） */
  unitsPerSemitone: number;
  /** 相邻声部轨在声部轴上的间距 */
  staffGap: number;
  /** 和弦主音选取策略：最高音 / 最低音 */
  chordPolicy: "top" | "bottom";
}

/** ADSR 包络参数（时间单位：秒） */
export interface EnvelopeParams {
  /** 起音时长 */
  attack: number;
  /** 衰减时长 */
  decay: number;
  /** 延音电平（0-1） */
  sustain: number;
  /** 释音时长 */
  release: number;
  /** 力度对包络的影响权重（0 = 无影响，1 = 完全按力度缩放） */
  velocitySensitivity: number;
}

/** 光点参数 */
export interface GlowParams {
  /** 光点球体半径（世界单位） */
  radius: number;
  /** 静息辉光强度 */
  baseIntensity: number;
  /** 峰值辉光强度（包络 × 力度映射后达到的上限） */
  peakIntensity: number;
}

/** 播放状态 */
export type Score3dPlaybackState = "idle" | "playing" | "paused";

/** 三维场景的时间范围（秒） */
export interface Score3dTimeRange {
  start: number;
  end: number;
}
