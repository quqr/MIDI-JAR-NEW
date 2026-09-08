/**
 * 帧参数构建（实时视口与视频导出共用的纯函数层）
 *
 * 职责：把 store 的 0-100 显示设置 + 已解析主题色 + 时间轴采样
 * 统一映射为 drawScoreFrame 的 ScoreFrameOptions。
 * 实时侧（ScoreViewport.drawNow）提供"当前视图 + 播放头"；
 * 导出侧由 deriveViewAtTime 按帧时间推导视图——两侧共用同一映射，
 * 保证导出画面与实时视图所见即所得。
 *
 * 纯函数约束：不读 DOM——主题色由调用方在开始时一次性
 * getComputedStyle 解析后传入（ResolvedColors）。
 */

import {
  secondsToBeat,
  xAtBeat,
  type BeatXPoint,
  type TempoSegment,
} from "./beatMap";
import type {
  BackgroundDraw,
  FlyInEffect,
  FlyOutEffect,
  GlowEffect,
  ScanlineDraw,
  ScoreFrameOptions,
  ScoreViewState,
} from "./scoreCanvasRenderer";
import type { ScoreBackgroundStyle } from "../types";

/** 已解析的主题色（调用方一次性 getComputedStyle 读取） */
export interface ResolvedColors {
  /** --color-primary（扫描线颜色） */
  scanlineColor: string;
  /** --color-base-300（theme 背景底色） */
  baseColor: string;
  /** --color-base-content（theme 点阵点色） */
  dotColor: string;
}

/** 帧效果输入（来自 store.settings，实时/导出共用） */
export interface ScoreFrameInputs extends ResolvedColors {
  /** 扫描线在视口内的水平位置（0-100，播放头对齐于此） */
  scanlinePosition: number;
  /** 谱面行在视口内的垂直位置（0-100，导出侧用于垂直定位） */
  snapPosition: number;
  showScanline: boolean;
  showFlyIn: boolean;
  /** 飞入：横向飞入距离（0-100） */
  flyInDistance: number;
  /** 飞入：纵向散落范围（0-100） */
  flyInScatter: number;
  /** 飞入：起步延迟（0-100） */
  flyInDelay: number;
  /** 飞入带宽度（0-100） */
  flyInDuration: number;
  showFlyOut: boolean;
  /** 飞出：横向飞出距离（0-100） */
  flyOutDistance: number;
  /** 飞出：纵向散落范围（0-100） */
  flyOutScatter: number;
  /** 飞出：起步延迟（0-100） */
  flyOutDelay: number;
  /** 飞出带宽度（0-100） */
  flyOutDuration: number;
  showGlow: boolean;
  /** 高光：作用范围（0-100） */
  glowRange: number;
  /** 高光：强度（0-100） */
  glowIntensity: number;
  tintColor: string;
  background: ScoreBackgroundStyle;
  /** 自定义背景色（仅 background="custom"） */
  customColor: string;
  /**
   * 播放动画激活门槛（ADR 0012）：已加载乐谱即激活。
   * 实时侧 = primitives.items.length > 0；导出侧恒 true。
   */
  activated: boolean;
}

function mapScanline(inputs: ScoreFrameInputs): ScanlineDraw | null {
  return inputs.activated && inputs.showScanline
    ? { positionPct: inputs.scanlinePosition, color: inputs.scanlineColor }
    : null;
}

/** 飞入：0-100 设置 → 世界 px（映射与 score-scroll.cn 对齐） */
function mapFlyIn(
  inputs: ScoreFrameInputs,
  view: ScoreViewState,
  cssWidth: number,
): FlyInEffect | null {
  if (!(inputs.activated && inputs.showFlyIn)) return null;
  return {
    // 带宽 100 ≈ 300px；飞入带起始 = 扫描线的内容位置（随画布平移变化）
    bandEdgeX:
      ((cssWidth * inputs.scanlinePosition) / 100 - view.panX) / view.zoom -
      view.contentOffsetX,
    bandWidth: inputs.flyInDuration * 3,
    distance: inputs.flyInDistance * 8,
    scatter: inputs.flyInScatter * 4,
    delay: inputs.flyInDelay * 6,
  };
}

/** 飞出：镜像飞入——音符越过扫描线（已播放）后飞出消失 */
function mapFlyOut(
  inputs: ScoreFrameInputs,
  bandEdgeX: number,
): FlyOutEffect | null {
  if (!(inputs.activated && inputs.showFlyOut)) return null;
  return {
    // 飞出带与飞入带同一起点（扫描线内容位置），向左延伸
    bandEdgeX,
    bandWidth: inputs.flyOutDuration * 3,
    distance: inputs.flyOutDistance * 8,
    scatter: inputs.flyOutScatter * 4,
    delay: inputs.flyOutDelay * 6,
  };
}

/** 高光：0-100 设置 → 世界 px（range 100 ≈ 播放头两侧 400px） */ function mapGlow(
  inputs: ScoreFrameInputs,
  playheadX: number,
): GlowEffect | null {
  return inputs.activated && inputs.showGlow
    ? {
        playheadX,
        range: inputs.glowRange * 4,
        intensity: inputs.glowIntensity / 100,
        tint: inputs.tintColor,
      }
    : null;
}

/** 背景：theme = 点阵网格；paper/custom = 纯色 */
function mapBackground(inputs: ScoreFrameInputs): BackgroundDraw | null {
  if (inputs.background === "theme") {
    return { kind: "dots", base: inputs.baseColor, dot: inputs.dotColor };
  }
  if (inputs.background === "paper") {
    return { kind: "solid", base: "#f5f1e8" };
  }
  return { kind: "solid", base: inputs.customColor || "#000000" };
}

/**
 * 组装一帧绘制参数（实时与导出共用）。
 * view 与 playheadX 由调用方提供：实时侧来自组件当前状态
 * （panX/panY refs + props.playheadX），导出侧来自 deriveViewAtTime。
 */
export function buildFrameOptions(
  inputs: ScoreFrameInputs,
  view: ScoreViewState,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  playheadX: number,
): ScoreFrameOptions {
  // 飞入/飞出带公共起点 = 扫描线的内容位置（随画布平移与播放推进变化）
  const scanlineEdgeX =
    ((cssWidth * inputs.scanlinePosition) / 100 - view.panX) / view.zoom -
    view.contentOffsetX;
  return {
    view,
    cssWidth,
    cssHeight,
    dpr,
    background: mapBackground(inputs),
    scanline: mapScanline(inputs),
    flyIn: mapFlyIn(inputs, view, cssWidth),
    flyOut: mapFlyOut(inputs, scanlineEdgeX),
    glow: mapGlow(inputs, playheadX),
  };
}

/** deriveViewAtTime 的输入：导出侧由帧时间推导视图 */
export interface ExportTimelineInputs {
  /** 当前帧时间（秒） */
  timeSec: number;
  /** 拍 → 谱面 X 映射（useScoreSync 暴露，导出开始时快照） */
  beatXMap: readonly BeatXPoint[];
  /** 分段 tempo map（useScoreSync 暴露，导出开始时快照） */
  tempoMap: readonly TempoSegment[];
  /** 导出缩放（摄像机模式 = 画面高 / 取景矩形高） */
  zoom: number;
  /** 导出画布 CSS 尺寸（离屏 dpr=1） */
  cssWidth: number;
  cssHeight: number;
  /** 扫描线位置（0-100，播放头对齐于此） */
  scanlinePosition: number;
  /** 谱面行位置（0-100，垂直定位） */
  snapPosition: number;
  /** 谱面完整布局高度（未缩放 px，useScoreSync.contentHeightPx） */
  contentHeightPx: number;
  /**
   * 显式垂直偏移（内容坐标 y，画面对应的内容顶）。
   * 摄像机取景用：给出后忽略 snapPosition 推导。
   */
  offsetYOverride?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 由帧时间推导视图与播放头（导出侧专用；公式与实时侧逐一对齐）：
 * - playheadX：时间 → 拍 → 谱面 x（tickFrame 的换算）
 * - contentOffsetX/Y：syncContentSize 同式（导出画布尺寸代入）
 * - panX：scrollToContentX 同式（播放头对齐扫描线锚点）
 * - panY：恒 0——垂直定位由 contentOffsetY 承担
 *   （渲染变换 = pan + (offset + y) × zoom；scrollToStart 同语义）
 */
export function deriveViewAtTime(t: ExportTimelineInputs): {
  view: ScoreViewState;
  playheadX: number;
} {
  const beat = secondsToBeat(t.tempoMap as TempoSegment[], t.timeSec);
  const playheadX = xAtBeat(t.beatXMap as BeatXPoint[], beat);

  const visibleUnscaledW = t.cssWidth / t.zoom;
  const visibleUnscaledH = t.cssHeight / t.zoom;
  const contentOffsetX = (visibleUnscaledW * t.scanlinePosition) / 100;
  const contentOffsetY =
    t.offsetYOverride !== undefined
      ? Math.max(0, t.offsetYOverride)
      : clamp(
          (visibleUnscaledH * t.snapPosition) / 100 - t.contentHeightPx / 2,
          0,
          Math.max(0, visibleUnscaledH - t.contentHeightPx),
        );

  const anchor = (t.cssWidth * t.scanlinePosition) / 100;
  const panX = anchor - (contentOffsetX + playheadX) * t.zoom;
  // 垂直定位由 contentOffsetY 承担（与实时侧 scrollToStart 同语义）：
  // panY 恒 0，谱面行中心对齐 snapPosition%
  const panY = 0;

  return {
    view: { panX, panY, zoom: t.zoom, contentOffsetX, contentOffsetY },
    playheadX,
  };
}

// ============================================================================
// 导出摄像机（取景矩形）
// ============================================================================

/** 取景矩形垂直余量（每侧，内容 px）：默认取景时谱面与矩形上下缘的留白 */
export const CAMERA_FIT_PADDING_PX = 32;

/** 取景矩形高度下限（内容 px），防止滑到不可用的极小值 */
export const CAMERA_RECT_MIN_HEIGHT_PX = 64;

/**
 * 默认取景矩形：谱面全高 + 上下余量，宽高比 16:9。
 * 乐谱加载时作为宽度/高度滑条的初始值，用户可再调整。
 */
export function cameraDefaultRect(contentHeightPx: number): {
  width: number;
  height: number;
} {
  const height = contentHeightPx + CAMERA_FIT_PADDING_PX * 2;
  return { width: Math.round(height * (16 / 9)), height };
}

export interface CameraRect {
  /** 矩形宽（内容 px） */
  width: number;
  /** 矩形高（内容 px，夹紧到谱面高度 + 余量内） */
  height: number;
  /** 矩形顶（内容 px y，夹紧后不高于谱面顶） */
  top: number;
}

/** 取景矩形宽度上限（内容 px）：防止拖出无意义的超宽画面 */
export const CAMERA_RECT_MAX_WIDTH_PX = 40000;

/**
 * 夹紧取景矩形（"有限制"的矩形）：
 * - 宽度夹到 [64, 40000]（画布比例另有硬上限兜底）；
 * - 高度夹到 [64, 谱面高 + 上下余量]，不允许无限放大/缩小；
 * - 垂直位置（中心相对谱面高度的百分比）换算为矩形顶后夹到
 *   [0, 谱面高 - 矩形高]（矩形不越过谱面上缘）。
 * 预览与导出共用，保证所见即所得。
 */
export function clampCameraRect(
  width: number,
  height: number,
  centerYPct: number,
  contentHeightPx: number,
): CameraRect {
  const w = clamp(width, CAMERA_RECT_MIN_HEIGHT_PX, CAMERA_RECT_MAX_WIDTH_PX);
  const h = clamp(
    height,
    CAMERA_RECT_MIN_HEIGHT_PX,
    Math.max(
      CAMERA_RECT_MIN_HEIGHT_PX,
      contentHeightPx + CAMERA_FIT_PADDING_PX * 2,
    ),
  );
  const rawTop = (centerYPct / 100) * contentHeightPx - h / 2;
  const top = clamp(rawTop, 0, Math.max(0, contentHeightPx - h));
  return { width: w, height: h, top };
}

/** 取景矩形在内容坐标系中的完整边界（预览画框与导出取景共用） */
export interface CameraFrameRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * 摄像机取景矩形的内容坐标边界：
 * 播放头对齐扫描线锚点，画面四缘对应的内容坐标即矩形边界。
 * 预览灰显与导出取景共用，保证预览即导出所见。
 */
export function cameraContentRect(
  playheadX: number,
  frameWidth: number,
  anchorPct: number,
  zoom: number,
  top: number,
  height: number,
): CameraFrameRect {
  const anchor = (frameWidth * anchorPct) / 100;
  const left = playheadX - anchor / zoom;
  return {
    left,
    right: left + frameWidth / zoom,
    top,
    bottom: top + height,
  };
}
