import type { ColorScheme } from "../types";

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

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r || 0, g || 0, b || 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateHex(low: string, high: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(low);
  const [r2, g2, b2] = hexToRgb(high);
  const tClamped = Math.max(0, Math.min(1, t));
  return rgbToHex(
    lerp(r1, r2, tClamped),
    lerp(g1, g2, tClamped),
    lerp(b1, b2, tClamped),
  );
}

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
      return pitchToColor(midi, customColors ?? DEFAULT_CUSTOM);
  }
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
