// ─── 流体模拟配置 ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

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
  SPLAT_RADIUS: number; // 1-100 (divided by 100 in shader)
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
    | "DENSITY_DISSIPATION"
    | "VELOCITY_DISSIPATION"
    | "CURL"
    | "SPLAT_RADIUS"
  >
> = {
  gentle: {
    DENSITY_DISSIPATION: 2,
    VELOCITY_DISSIPATION: 0.5,
    CURL: 10,
    SPLAT_RADIUS: 40,
  },
  standard: {
    DENSITY_DISSIPATION: 1,
    VELOCITY_DISSIPATION: 0.2,
    CURL: 30,
    SPLAT_RADIUS: 25,
  },
  turbulent: {
    DENSITY_DISSIPATION: 0.5,
    VELOCITY_DISSIPATION: 0.1,
    CURL: 50,
    SPLAT_RADIUS: 15,
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
  SPLAT_RADIUS: 25,
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

// ─── 高级覆盖参数（精简后用户可调旋钮，发射开关由 WaterfallEngine 读取） ───
export interface FluidAdvancedOverrides {
  SPLAT_RADIUS?: number;
  SPLAT_COLOR_HUE?: number;
  DENSITY_DISSIPATION?: number;
  VELOCITY_DISSIPATION?: number;
  BLOOM?: boolean;
  BLOOM_INTENSITY?: number;
}

// ─── 由质量 + 风格 + 高级覆盖生成最终配置 ───
// 始终应用 overrides，确保用户设置的参数生效
export function resolveConfig(
  quality: FluidQuality,
  style: FluidStyle,
  _advanced: boolean,
  overrides: FluidAdvancedOverrides,
): FluidSimulationConfig {
  const base = { ...DEFAULT_CONFIG };
  Object.assign(base, QUALITY_PRESETS[quality]);
  Object.assign(base, STYLE_PRESETS[style]);
  // 仅应用 FluidSimulationConfig 已知字段（忽略发射开关等非求解器参数）
  if (overrides.SPLAT_RADIUS !== undefined) base.SPLAT_RADIUS = overrides.SPLAT_RADIUS;
  if (overrides.DENSITY_DISSIPATION !== undefined) base.DENSITY_DISSIPATION = overrides.DENSITY_DISSIPATION;
  if (overrides.VELOCITY_DISSIPATION !== undefined) base.VELOCITY_DISSIPATION = overrides.VELOCITY_DISSIPATION;
  if (overrides.BLOOM !== undefined) base.BLOOM = overrides.BLOOM;
  if (overrides.BLOOM_INTENSITY !== undefined) base.BLOOM_INTENSITY = overrides.BLOOM_INTENSITY;
  return base;
}
