import { hslToHex, interpolateHex } from "@/helpers/color";
import type { ColorScheme } from "../types";

/**
 * 自定义配色方案的三个音高区间颜色，分别对应低音、中音、高音区
 */
export interface CustomColors {
  low: string;
  mid: string;
  high: string;
}

type Hand = "left" | "right" | "unknown" | undefined;

const HAND_COLORS = {
  left: "#3b82f6",
  right: "#f59e0b",
  unknown: "#9ca3af",
} as const;

const PITCH_LOW = 21;
const PITCH_MID = 60;
const PITCH_HIGH = 108;

/**
 * 根据 MIDI 音符号在低-中-高三个音区颜色之间分段插值
 * @param midi - MIDI 音符号（21~108）
 * @param colors - 三个音高区间的颜色配置
 * @returns 插值后的十六进制颜色
 */
function pitchToColor(midi: number, colors: CustomColors): string {
  if (midi <= PITCH_MID) {
    const t =
      PITCH_MID > PITCH_LOW ? (midi - PITCH_LOW) / (PITCH_MID - PITCH_LOW) : 0;
    return interpolateHex(colors.low, colors.mid, t);
  }
  const t =
    PITCH_HIGH > PITCH_MID ? (midi - PITCH_MID) / (PITCH_HIGH - PITCH_MID) : 0;
  return interpolateHex(colors.mid, colors.high, t);
}

const DEFAULT_CUSTOM: CustomColors = {
  low: "#6366f1",
  mid: "#14b8a6",
  high: "#f59e0b",
};

/**
 * 根据配色方案将音符映射为颜色
 * @param midi - MIDI 音符号
 * @param scheme - 配色方案类型
 * @param hand - 左右手标识，仅 scheme 为 "hands" 时有效
 * @param customColors - 自定义配色，仅 scheme 为 "custom" 时有效
 * @returns 十六进制颜色字符串
 */
export function noteToColor(
  midi: number,
  scheme: ColorScheme,
  hand?: Hand,
  customColors?: CustomColors,
): string {
  switch (scheme) {
    case "hands":
      return HAND_COLORS[hand ?? "unknown"];

    case "rainbow":
      return hslToHex((midi * 23) % 360, 80, 60);

    case "warm":
      return hslToHex((midi % 6) * 15, 85, 55);

    case "cool":
      return hslToHex((midi % 6) * 20 + 180, 75, 55);

    case "neon":
      return hslToHex((midi % 4) * 60 + 280, 95, 60);

    case "custom":
      return pitchToColor(midi, customColors ?? DEFAULT_CUSTOM);

    case "pitch":
    default:
      return pitchToColor(midi, DEFAULT_CUSTOM);
  }
}
