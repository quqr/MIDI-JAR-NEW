import type { BlackholeConfig } from "./types";

export const DEFAULT_BLACKHOLE_CONFIG: BlackholeConfig = {
  // 黑洞与引力透镜
  holeRadius: 0.0200,
  lensDepth: 13.0,
  starGain: 0.5,

  // 吸积盘几何
  diskInner: 1.8,
  diskOuter: 8.0,
  diskIncl: 1.5,
  diskRoll: 0.35,

  // 吸积盘物质与光
  diskGain: 2.2,
  diskOpacity: 0.9,
  diskTemp: 5500.0,
  dopplerMix: 0.6,
  diskBeam: 2.5,
  diskSpeed: 8.0,
  diskWind: 7.0,
  diskContrast: 1.6,

  // 光照与屏幕
  exposure: 1.4,
  driftSpeed: 1.5,

  // 整体强度
  intensity: 0.8,

  // 自定义背景
  background: {
    imageUrl: "",
    fitMode: "cover",
    opacity: 0.5,
  },
};

/** 参数范围定义 */
export const BLACKHOLE_PARAM_RANGES: Record<
  string,
  { min: number; max: number; step: number }
> = {
  holeRadius: { min: 0.005, max: 0.1, step: 0.001 },
  lensDepth: { min: 1, max: 30, step: 0.5 },
  starGain: { min: 0, max: 1, step: 0.01 },
  diskInner: { min: 1.6, max: 5, step: 0.1 },
  diskOuter: { min: 3, max: 20, step: 0.5 },
  diskIncl: { min: 0, max: 1.57, step: 0.01 },
  diskRoll: { min: -3.14, max: 3.14, step: 0.01 },
  diskGain: { min: 0, max: 5, step: 0.1 },
  diskOpacity: { min: 0, max: 1, step: 0.01 },
  diskTemp: { min: 1500, max: 20000, step: 100 },
  dopplerMix: { min: 0, max: 1, step: 0.01 },
  diskBeam: { min: 0, max: 10, step: 0.1 },
  diskSpeed: { min: -20, max: 20, step: 0.1 },
  diskWind: { min: 0, max: 20, step: 0.1 },
  diskContrast: { min: 0, max: 3, step: 0.1 },
  exposure: { min: 0.1, max: 5, step: 0.05 },
  driftSpeed: { min: 0, max: 3, step: 0.05 },
  intensity: { min: 0, max: 1, step: 0.01 },
};
