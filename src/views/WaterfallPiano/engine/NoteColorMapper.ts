import type { ColorScheme } from "../types";

// Color schemes mapping MIDI note to HSL
const COLOR_SCHEMES: Record<ColorScheme, (midi: number) => string> = {
  pitch: (midi: number) => {
    // Rainbow based on pitch (low=red, high=violet)
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    const hue = t * 300; // red → violet
    return `hsl(${hue}, 85%, 55%)`;
  },
  hands: (_midi: number) => {
    // Default - will be overridden by hand info
    return `hsl(250, 80%, 55%)`; // indigo default
  },
  warm: (midi: number) => {
    // Red (0) → Orange (30) → Yellow (60)
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    const hue = t * 60; // 0-60
    return `hsl(${hue}, 85%, 55%)`;
  },
  cool: (midi: number) => {
    // Blue (210) → Cyan (180) → Teal (160)
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    const hue = 210 - t * 50; // 210-160
    return `hsl(${hue}, 80%, 55%)`;
  },
  rainbow: (midi: number) => {
    // Full rainbow across the keyboard
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    const hue = t * 360;
    return `hsl(${hue}, 80%, 55%)`;
  },
  neon: (midi: number) => {
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    const hue = t * 300; // Magenta → Cyan
    return `hsl(${hue}, 100%, 60%)`;
  },
  custom: (midi: number) => {
    // Fallback - will be overridden by custom colors
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    const hue = t * 360;
    return `hsl(${hue}, 80%, 55%)`;
  },
};

export class NoteColorMapper {
  private scheme: ColorScheme = "rainbow";
  private customColors = { low: "#ff4444", mid: "#44ff44", high: "#4444ff" };

  setScheme(scheme: ColorScheme) {
    this.scheme = scheme;
  }

  setCustomColors(colors: { low: string; mid: string; high: string }) {
    this.customColors = colors;
  }

  getColor(midi: number): string {
    if (this.scheme === "custom") {
      return this.getCustomColor(midi);
    }
    return COLOR_SCHEMES[this.scheme](midi);
  }

  private getCustomColor(midi: number): string {
    const t = Math.min(1, Math.max(0, (midi - 21) / 87));
    // Interpolate between low (0-0.33), mid (0.33-0.67), high (0.67-1)
    if (t < 0.33) {
      return this.interpolateColor(this.customColors.low, this.customColors.mid, t / 0.33);
    } else if (t < 0.67) {
      return this.interpolateColor(this.customColors.mid, this.customColors.high, (t - 0.33) / 0.34);
    } else {
      return this.customColors.high;
    }
  }

  private interpolateColor(color1: string, color2: string, t: number): string {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }
}
