// ─── 流体模拟配置 ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

// 流体高级覆盖参数（用户友好语义，原 WaterfallPiano/types.ts 内联至此以保持模块自包含）
export interface FluidAdvancedParams {
  simResolution?: number; // 32-256 模拟分辨率
  splatRadius?: number; // 0.0001-0.01 溅射半径
  splatColorHue?: number; // 0-1 色相，undefined 时用音高映射
  trailLength?: number; // 0-1 拖尾长度（1=长拖尾，0=快消散）
  flowPersistence?: number; // 0-1 流动持久度（1=持久，0=短促）
  bloom?: boolean; // 发光开关
  bloomIntensity?: number; // 0.1-2.0 发光强度
  hitExplosion?: boolean; // 命中爆炸发射开关
  blockCoverage?: boolean; // 块体覆盖发射开关
}

export interface FluidSimulationConfig {
  // 模拟参数
  SIM_RESOLUTION: number; // 32-256
  DYE_RESOLUTION: number; // 128-1024
  CAPTURE_RESOLUTION: number; // 截图分辨率
  DENSITY_DISSIPATION: number; // 0-4 密度扩散
  VELOCITY_DISSIPATION: number; // 0-4 速度扩散
  PRESSURE: number; // 0-1
  PRESSURE_ITERATIONS: number; // 5-50 Jacobi 迭代次数
  CURL: number; // 0-50 涡度
  SPLAT_RADIUS: number; // 0.00001-0.01
  SPLAT_FORCE: number; // 1000-10000
  SHADING: boolean; // 法线着色（伪 3D 立体感）
  COLORFUL: boolean; // 自动随机色彩
  COLOR_UPDATE_SPEED: number; // 色彩更新速度
  PAUSED: boolean;
  BACK_COLOR: { r: number; g: number; b: number }; // 0-255
  TRANSPARENT: boolean;
  // Bloom 后处理
  BLOOM: boolean;
  BLOOM_ITERATIONS: number; // 2-16
  BLOOM_RESOLUTION: number; // 64-512
  BLOOM_INTENSITY: number; // 0.1-2.0
  BLOOM_THRESHOLD: number; // 0-1
  BLOOM_SOFT_KNEE: number; // 0-1
  // Sunrays 后处理
  SUNRAYS: boolean;
  SUNRAYS_RESOLUTION: number; // 64-512
  SUNRAYS_WEIGHT: number; // 0.3-1.0
}

// ─── 质量预设（用户根据 GPU 选择） ───
export type FluidQuality = "low" | "medium" | "high";

export const QUALITY_PRESETS: Record<
  FluidQuality,
  Pick<
    FluidSimulationConfig,
    | "DYE_RESOLUTION"
    | "SIM_RESOLUTION"
    | "BLOOM"
    | "SUNRAYS"
    | "BLOOM_RESOLUTION"
    | "SUNRAYS_RESOLUTION"
  >
> = {
  low: {
    DYE_RESOLUTION: 256,
    SIM_RESOLUTION: 64,
    BLOOM: false,
    SUNRAYS: false,
    BLOOM_RESOLUTION: 128,
    SUNRAYS_RESOLUTION: 128,
  },
  medium: {
    DYE_RESOLUTION: 512,
    SIM_RESOLUTION: 128,
    BLOOM: true,
    SUNRAYS: false,
    BLOOM_RESOLUTION: 256,
    SUNRAYS_RESOLUTION: 196,
  },
  high: {
    DYE_RESOLUTION: 1024,
    SIM_RESOLUTION: 128,
    BLOOM: true,
    SUNRAYS: true,
    BLOOM_RESOLUTION: 256,
    SUNRAYS_RESOLUTION: 196,
  },
};

// ─── 风格预设（视觉表现） ───
export type FluidStyle = "gentle" | "standard" | "turbulent";

export const STYLE_PRESETS: Record<
  FluidStyle,
  Pick<
    FluidSimulationConfig,
    "DENSITY_DISSIPATION" | "VELOCITY_DISSIPATION" | "CURL" | "SPLAT_RADIUS"
  >
> = {
  gentle: {
    DENSITY_DISSIPATION: 2,
    VELOCITY_DISSIPATION: 0.5,
    CURL: 10,
    SPLAT_RADIUS: 0.008,
  },
  standard: {
    DENSITY_DISSIPATION: 1,
    VELOCITY_DISSIPATION: 0.2,
    CURL: 30,
    SPLAT_RADIUS: 0.005,
  },
  turbulent: {
    DENSITY_DISSIPATION: 0.5,
    VELOCITY_DISSIPATION: 0.1,
    CURL: 50,
    SPLAT_RADIUS: 0.002,
  },
};

// ─── 默认配置（与原项目一致） ───
export const DEFAULT_CONFIG: FluidSimulationConfig = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.005,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0, g: 0, b: 0 },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
};

// ─── 高级覆盖参数（用户友好语义，由 types.ts 的 FluidAdvancedParams 定义） ───

// ─── 由质量 + 风格 + 高级覆盖生成最终配置 ───
// 始终应用 overrides，确保用户设置的参数生效
// 用户语义映射：trailLength/flowPersistence (0-1) → DENSITY/VELOCITY_DISSIPATION (0-4，反向)
export function resolveConfig(
  quality: FluidQuality,
  style: FluidStyle,
  _advanced: boolean,
  overrides: FluidAdvancedParams,
): FluidSimulationConfig {
  const base = { ...DEFAULT_CONFIG };
  Object.assign(base, QUALITY_PRESETS[quality]);
  Object.assign(base, STYLE_PRESETS[style]);
  // 用户友好旋钮映射到底层求解器参数
  if (overrides.simResolution !== undefined) {
    base.SIM_RESOLUTION = overrides.simResolution;
    base.DYE_RESOLUTION = Math.min(1024, overrides.simResolution * 4);
  }
  if (overrides.splatRadius !== undefined)
    base.SPLAT_RADIUS = overrides.splatRadius;
  if (overrides.trailLength !== undefined)
    base.DENSITY_DISSIPATION = (1 - overrides.trailLength) * 4;
  if (overrides.flowPersistence !== undefined)
    base.VELOCITY_DISSIPATION = (1 - overrides.flowPersistence) * 4;
  if (overrides.bloom !== undefined) base.BLOOM = overrides.bloom;
  if (overrides.bloomIntensity !== undefined)
    base.BLOOM_INTENSITY = overrides.bloomIntensity;
  // splatColorHue: 完全覆盖模式 — 设置色相时禁用随机色彩
  if (overrides.splatColorHue !== undefined) base.COLORFUL = false;
  base.TRANSPARENT = true;
  return base;
}
