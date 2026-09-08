import type { GlowParams } from "./types";

/**
 * MusicXML 无逐音符力度标记（只有 pp/mf/ff 之类的表情记号，常见导出器不落 <velocity>），
 * 此处以常量兜底；力度视觉通道因此退化为常量，待后续接入力度来源。
 */
export const DEFAULT_VELOCITY = 0.8;

/** 声部轨配色（按 trackIndex 循环取用；字符串形式便于直接用于 CSS 与 THREE.Color） */
export const TRACK_COLORS: string[] = [
  "#38bdf8",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#facc15",
  "#60a5fa",
  "#f87171",
  "#2dd4bf",
  "#c084fc",
];

/** 按声部轨索引取颜色 */
export function trackColor(trackIndex: number): string {
  const len = TRACK_COLORS.length;
  if (len === 0) return "#38bdf8";
  return TRACK_COLORS[((trackIndex % len) + len) % len];
}

// ── 符号实体场景（ADR 0018）──

/** 谱面 px → 世界坐标的缩放系数 */
export const GLYPH_WORLD_SCALE = 0.1;

/** 符号挤出厚度（世界单位，固定常量，暂不暴露设置项；ADR 0019 加厚至 1.2） */
export const GLYPH_EXTRUDE_DEPTH = 1.2;

/** 符号合批的 x 窗口宽（谱面 px）：每窗口 × 每声部一个合并 Mesh */
export const GLYPH_CHUNK_PX = 600;

/** 五线谱线判定：细长水平条（与乐谱滚动的扫描线豁免判据一致） */
export function isStaffLinePrim(w: number, h: number): boolean {
  return w >= 60 && h <= 4;
}

/** 光点所在平面 z（世界单位，位于符号层前方）；追迹小球同层 */
export const GLOW_Z = 1.2;

/**
 * 描边图元管径加粗倍率：谱线/符杆在二维谱里只有 1-2px，按原宽映射到
 * 三维仍是发丝级（白底不可见），统一放大到与符头比例协调（ADR 0019）。
 */
export const STROKE_THICKNESS_BOOST = 3.5;

/** 追迹小球半径（世界单位） */
export const BALL_RADIUS = 0.5;

/** 追迹小球弹跳弧高（世界单位，沿谱面法向上抛） */
export const BALL_HOP_HEIGHT = 1.2;

/** 单次弹跳的目标时长（秒）：长间隙自动拆分为多次连续弹跳 */
export const BALL_HOP_SECONDS = 1.1;

/** 一次弹跳最多拆分的段数 */
export const BALL_MAX_HOPS = 6;

/** 待机时原地弹跳的幅度（世界单位） */
export const BALL_IDLE_BOUNCE = 0.3;

/** 球体自发光强度（配合 bloom 阈值 1.0 产生辉光） */
export const BALL_EMISSIVE_INTENSITY = 3;

/** bloom 后期强度 / 半径 / 阈值（阈值 1.0：只有 HDR 自发光体溢出，白色背景不参与辉光） */
export const BLOOM_STRENGTH = 0.8;
export const BLOOM_RADIUS = 0.4;
export const BLOOM_THRESHOLD = 1.0;

/** 三维乐谱设置持久化 key */
export const SCORE3D_STORAGE_KEY = "score3d-settings";

/** 默认场景背景色 */
export const DEFAULT_BACKGROUND = "#ffffff";

/** 追迹小球合并时透明度衰减的时间窗（秒，占飞行末段） */
export const BALL_MERGE_FADE = 0.25;

/** 追迹小球移动轨迹的点数（渐隐尾迹长度） */
export const BALL_TRAIL_POINTS = 24;

/** 追迹小球轨迹线的基础透明度 */
export const BALL_TRAIL_OPACITY = 0.35;

/** 默认光点参数 */
export const DEFAULT_GLOW_PARAMS: GlowParams = {
  radius: 0.9,
  baseIntensity: 0.35,
  peakIntensity: 3.2,
};

/** 相机相对播放头的默认偏移（俯视平铺谱面；回到播放头时使用） */
export const DEFAULT_CAMERA_OFFSET = { x: -6, y: 14, z: 7 };

/** 相机注视目标向播放头平滑跟随的每帧插值系数（60fps 基准） */
export const FOLLOW_TARGET_LERP = 0.12;

/** 文字图元转贴面网格的数量上限（防御异常乐谱的巨量文本） */
export const TEXT_PLANE_MAX = 200;
