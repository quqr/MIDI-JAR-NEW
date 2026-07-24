import type { BackgroundConfig, ParticleConfig } from "../types";
import type { KeyboardRenderer } from "./KeyboardRenderer";
import type { NoteBlockSystem } from "./NoteBlockSystem";
import type { IFluidSimulation } from "@/engine/fluid-pixi";
import { SplatPerturbation } from "@/engine/fluid/FluidConfig";
import { noteToColor } from "./NoteColorMapper";
import { hexToRgbNorm, hslToRgbNorm } from "./colorUtils";
import { PerlinNoise1D } from "@/utils/PerlinNoise1D";

const noise = new PerlinNoise1D();
/** Perlin 噪声驱动的随机数（均值 0，标准差 1） */
function PerlinNoise1DRandomNumber(): number {
  return noise.noise(Math.random() * 1000);
}

/** 判断扰动参数是否全部为 0/undefined（用于跳过计算） */
function hasPerturbation(p: SplatPerturbation | undefined): boolean {
  if (!p) return false;
  return !!(
    (p.positionJitter && p.positionJitter > 0) ||
    (p.forceJitter && p.forceJitter > 0) ||
    (p.colorJitter && p.colorJitter > 0)
  );
}

const DEFAULT_VELOCITY = 90;

export interface FluidSplatDeps {
  keyboardRenderer: KeyboardRenderer;
  noteBlockSystem: NoteBlockSystem;
  getParticleConfig: () => ParticleConfig | null;
  getBackgroundConfig: () => BackgroundConfig | null;
  getLayout: () => { width: number; height: number; keyboardHeight: number };
  hasCanvases: () => boolean;
}

/**
 * 流体喷射管理器：负责命中 splat、hitExplosion、持续 splat 与 blockCoverage 尾焰
 */
export class FluidSplatManager {
  private deps: FluidSplatDeps;

  constructor(deps: FluidSplatDeps) {
    this.deps = deps;
  }

  /**
   * 在命中线位置发射流体 splat，颜色取自音符色或单一色相配置
   */
  fluidSplat(
    fluid: IFluidSimulation,
    midi: number,
    velocity = DEFAULT_VELOCITY,
  ): void {
    if (!this.deps.hasCanvases()) return;
    const { keyboardRenderer } = this.deps;
    const { width, height, keyboardHeight } = this.deps.getLayout();
    const pCfg = this.deps.getParticleConfig();
    const bCfg = this.deps.getBackgroundConfig();
    let x = keyboardRenderer.midiToX(midi) / Math.max(1, width);
    let y = keyboardHeight / Math.max(1, height);

    let rgb: { r: number; g: number; b: number };
    const hue = bCfg?.fluidParams.splatColorHue;
    if (hue !== undefined && hue > 0) {
      const lightness = 0.4 + (velocity / 127) * 0.3;
      rgb = hslToRgbNorm(hue, 0.8, lightness);
    } else {
      const colorHex = noteToColor(
        midi,
        pCfg?.colorScheme ?? "pitch",
        undefined,
        pCfg?.customColors,
      );
      rgb = hexToRgbNorm(colorHex);
    }

    let dx = 0;
    let dy = 200;
    const perturbation = bCfg?.fluidParams.fluidSplatPerturbation;
    if (hasPerturbation(perturbation)) {
      if (perturbation!.positionJitter && perturbation!.positionJitter > 0) {
        x += PerlinNoise1DRandomNumber() * perturbation!.positionJitter * 0.02;
        y += PerlinNoise1DRandomNumber() * perturbation!.positionJitter * 0.02;
      }
      if (perturbation!.forceJitter && perturbation!.forceJitter > 0) {
        dx += PerlinNoise1DRandomNumber() * dy * perturbation!.forceJitter;
        dy += PerlinNoise1DRandomNumber() * dy * perturbation!.forceJitter;
      }
      if (perturbation!.colorJitter && perturbation!.colorJitter > 0) {
        rgb = {
          r: Math.max(
            0,
            rgb.r +
              PerlinNoise1DRandomNumber() * perturbation!.colorJitter * 0.15,
          ),
          g: Math.max(
            0,
            rgb.g +
              PerlinNoise1DRandomNumber() * perturbation!.colorJitter * 0.15,
          ),
          b: Math.max(
            0,
            rgb.b +
              PerlinNoise1DRandomNumber() * perturbation!.colorJitter * 0.15,
          ),
        };
      }
    }
    fluid.splat(x, y, dx, dy, {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
    });
  }

  /** hitExplosion: 在命中线位置（音符X + 命中线Y）触发集中爆发 */
  hitExplosionSplat(
    fluid: IFluidSimulation,
    midi: number,
    _velocity: number,
  ): void {
    const pCfg = this.deps.getParticleConfig();
    const bCfg = this.deps.getBackgroundConfig();
    if (!pCfg || !bCfg) return;
    const { keyboardRenderer } = this.deps;
    const { width, height, keyboardHeight } = this.deps.getLayout();
    let x = keyboardRenderer.midiToX(midi) / Math.max(1, width);
    // 命中线 Y 坐标：键盘顶部位置（与 fluidSplat 一致，纹理坐标 Y=0 底部）
    const y = keyboardHeight / Math.max(1, height);
    let rgb: { r: number; g: number; b: number };
    const hue = bCfg.fluidParams.splatColorHue;
    if (hue !== undefined && hue > 0) {
      rgb = hslToRgbNorm(hue, 0.9, 0.6);
    } else {
      const colorHex = noteToColor(
        midi,
        pCfg.colorScheme,
        undefined,
        pCfg.customColors,
      );
      rgb = hexToRgbNorm(colorHex);
    }
    let spread = pCfg.hitExplosionRadius ?? 0.03;
    let force = spread * 5000;
    let colorMul = 0.7;

    const p = bCfg.fluidParams.hitExplosionPerturbation;
    if (hasPerturbation(p)) {
      if (p!.positionJitter && p!.positionJitter > 0) {
        x += PerlinNoise1DRandomNumber() * p!.positionJitter * 0.02;
      }
      if (p!.forceJitter && p!.forceJitter > 0) {
        force += PerlinNoise1DRandomNumber() * force * p!.forceJitter;
        spread += PerlinNoise1DRandomNumber() * spread * p!.forceJitter;
      }
      if (p!.colorJitter && p!.colorJitter > 0) {
        colorMul += PerlinNoise1DRandomNumber() * p!.colorJitter * 0.15;
        colorMul = Math.max(0, colorMul);
      }
    }

    fluid.splat(x - spread, y, -force * 0.6, force, {
      r: rgb.r * colorMul,
      g: rgb.g * colorMul,
      b: rgb.b * colorMul,
    });
    fluid.splat(x + spread, y, force * 0.6, force, {
      r: rgb.r * colorMul,
      g: rgb.g * colorMul,
      b: rgb.b * colorMul,
    });
  }

  /** 流体模拟更新 + 持续 splat（长按持续 + blockCoverage 尾焰） */
  updateAndSplat(fluid: IFluidSimulation): void {
    fluid.update();
    const pCfg = this.deps.getParticleConfig();
    const bCfg = this.deps.getBackgroundConfig();

    // 长按持续触发：对键盘上持续按住的音符发射弱 splat
    if (bCfg?.fluidEnabled) {
      const { keyboardRenderer } = this.deps;
      const { width, height, keyboardHeight } = this.deps.getLayout();
      const sP = bCfg.fluidParams.sustainedSplatPerturbation;
      const sHas = hasPerturbation(sP);
      for (const midi of keyboardRenderer.getActiveNotes()) {
        let x = keyboardRenderer.midiToX(midi) / Math.max(1, width);
        let y = keyboardHeight / Math.max(1, height);
        const hue = bCfg.fluidParams.splatColorHue;
        let rgb: { r: number; g: number; b: number };
        if (hue !== undefined && hue > 0) {
          rgb = hslToRgbNorm(hue, 0.8, 0.4);
        } else {
          const colorHex = noteToColor(
            midi,
            pCfg?.colorScheme ?? "pitch",
            undefined,
            pCfg?.customColors,
          );
          rgb = hexToRgbNorm(colorHex);
        }
        let dx = 0;
        let dy = 60;
        let colorMul = 0.4;
        if (sHas) {
          if (sP!.positionJitter && sP!.positionJitter > 0) {
            x += PerlinNoise1DRandomNumber() * sP!.positionJitter * 0.02;
            y += PerlinNoise1DRandomNumber() * sP!.positionJitter * 0.02;
          }
          if (sP!.forceJitter && sP!.forceJitter > 0) {
            dx += PerlinNoise1DRandomNumber() * dy * sP!.forceJitter;
            dy += PerlinNoise1DRandomNumber() * dy * sP!.forceJitter;
          }
          if (sP!.colorJitter && sP!.colorJitter > 0) {
            colorMul += PerlinNoise1DRandomNumber() * sP!.colorJitter * 0.15;
            colorMul = Math.max(0, colorMul);
          }
        }
        fluid.splat(x, y, dx, dy, {
          r: rgb.r * colorMul,
          g: rgb.g * colorMul,
          b: rgb.b * colorMul,
        });
      }
    }

    // blockCoverage: 对每个活跃音符块持续发射尾焰式 splat
    if (bCfg?.fluidParams.blockCoverage) {
      const { keyboardRenderer, noteBlockSystem } = this.deps;
      const { height } = this.deps.getLayout();
      const bP = bCfg.fluidParams.blockCoveragePerturbation;
      const bHas = hasPerturbation(bP);
      const blockPositions = noteBlockSystem.getActiveBlockPositions(
        keyboardRenderer,
        height,
      );
      for (const pos of blockPositions) {
        let px = pos.normX;
        let py = pos.normY;
        const hue = bCfg.fluidParams.splatColorHue;
        let rgb: { r: number; g: number; b: number };
        if (hue !== undefined && hue > 0) {
          rgb = hslToRgbNorm(hue, 0.8, 0.5);
        } else {
          const colorHex = noteToColor(
            pos.midi,
            pCfg?.colorScheme ?? "pitch",
            undefined,
            pCfg?.customColors,
          );
          rgb = hexToRgbNorm(colorHex);
        }
        let dx = 0;
        let dy = -20;
        let colorMul = 0.3;
        if (bHas) {
          if (bP!.positionJitter && bP!.positionJitter > 0) {
            px += PerlinNoise1DRandomNumber() * bP!.positionJitter * 0.02;
            py += PerlinNoise1DRandomNumber() * bP!.positionJitter * 0.02;
          }
          if (bP!.forceJitter && bP!.forceJitter > 0) {
            dx += PerlinNoise1DRandomNumber() * Math.abs(dy) * bP!.forceJitter;
            dy += PerlinNoise1DRandomNumber() * Math.abs(dy) * bP!.forceJitter;
          }
          if (bP!.colorJitter && bP!.colorJitter > 0) {
            colorMul += PerlinNoise1DRandomNumber() * bP!.colorJitter * 0.15;
            colorMul = Math.max(0, colorMul);
          }
        }
        fluid.splat(px, py, dx, dy, {
          r: rgb.r * colorMul,
          g: rgb.g * colorMul,
          b: rgb.b * colorMul,
        });
      }
    }
  }
}
