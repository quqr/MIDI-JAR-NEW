/**
 * 视觉特效管理器：统一封装 FluidSimulation 生命周期、PixiJS 滤镜（AdvancedBloom +
 * BackdropBlur）与流体 splat 逻辑，将复杂的"流体配置解析"和"滤镜参数同步"黑盒化。
 *
 * 主引擎只需调用 visualEffects.update() 即可完成每帧流体更新，无需关心内部细节。
 */

import type { WaterfallPianoSettings } from "../types";
import { AdvancedBloomFilter, BackdropBlurFilter } from "pixi-filters";
import type { KeyboardRenderer } from "./KeyboardRenderer";
import type { NoteBlockSystem } from "./NoteBlockSystem";
import type { WaterfallLayers } from "./WaterfallEngine";
import {
  FluidSimulation,
  resolveConfig,
  type FluidSimulationConfig,
  type IFluidSimulation,
} from "@/engine/fluid";
import { SplatPerturbation } from "@/engine/fluid/FluidConfig";
import { noteToColor } from "./NoteColorMapper";
import { hexToRgbNorm, hslToRgbNorm } from "./colorUtils";
import { PerlinNoise1D } from "@/utils/PerlinNoise1D";
import { createLogger } from "@/utils/logger";

const logger = createLogger("VisualEffectsManager");

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

const DEFAULT_SPLAT_VELOCITY = 90;

export interface VisualEffectsManagerDeps {
  /** 提供 KeyboardRenderer 引用（用于 splat 的 midiToX / getActiveNotes） */
  keyboardRenderer: KeyboardRenderer;
  /** 提供 NoteBlockSystem 引用（用于 blockCoverage 尾焰） */
  noteBlockSystem: NoteBlockSystem;
  /** 获取当前布局尺寸 */
  getLayout: () => { width: number; height: number; keyboardHeight: number };
  /** 通知背景渲染器流体激活状态（用于跳过背景绘制） */
  onFluidActiveChange: (active: boolean) => void;
}

/**
 * 管理 FluidSimulation 生命周期、PixiJS 后期滤镜与 splat 逻辑的统一管理器
 */
export class VisualEffectsManager {
  private deps: VisualEffectsManagerDeps;
  private settings: WaterfallPianoSettings | null = null;
  private fluidCanvas: HTMLCanvasElement | null = null;
  private layers: WaterfallLayers | null = null;
  private fluid: IFluidSimulation | null = null;
  /** AdvancedBloomFilter 实例（持久化，应用到 waterfall 层） */
  private advancedBloomFilter: AdvancedBloomFilter | null = null;
  /** BackdropBlurFilter 实例（持久化，应用到 fluid 层以模糊 background 层） */
  private backdropBlurFilter: BackdropBlurFilter | null = null;
  /** MIDI 模式暂停标志：为 true 时跳过 fluid.update() 和所有 splat 调用 */
  private fluidPaused = false;

  constructor(deps: VisualEffectsManagerDeps) {
    this.deps = deps;
  }

  /**
   * 初始化流体（若 settings 启用）并应用后期滤镜
   * @param settings - 瀑布钢琴配置
   * @param fluidCanvas - 流体模拟专用 canvas（可为 null）
   * @param layers - PixiJS 四层容器
   */
  init(
    settings: WaterfallPianoSettings,
    fluidCanvas: HTMLCanvasElement | null,
    layers: WaterfallLayers,
  ): void {
    this.settings = settings;
    this.fluidCanvas = fluidCanvas;
    this.layers = layers;
    this.maybeInitFluid();
    // 仅当流体在 bottom 层时跳过背景绘制（让流体穿透显示）
    this.deps.onFluidActiveChange(
      settings.background.fluidEnabled &&
        !!this.fluid &&
        settings.background.fluidLayerPosition === "bottom",
    );
    this.applyEffects(settings);
  }

  /**
   * 更新流体模拟专用 canvas 引用
   * 用于运行时流体 canvas 挂载/卸载后，让管理器拿到最新的 canvas 引用
   * 必须在 updateConfig 之前调用，以便 maybeInitFluid 能拿到正确的 canvas
   */
  setFluidCanvas(canvas: HTMLCanvasElement | null): void {
    this.fluidCanvas = canvas;
  }

  /**
   * 响应配置变更：流体开关、滤镜参数、splat 配置
   * 内部处理流体 ON→创建、OFF→销毁、配置变更→更新三种分支
   */
  updateConfig(settings: WaterfallPianoSettings): void {
    const oldFluidEnabled =
      this.settings?.background.fluidEnabled ??
      settings.background.fluidEnabled;
    this.settings = settings;

    if (settings.background.fluidEnabled && !oldFluidEnabled) {
      // 流体从 OFF → ON
      this.maybeInitFluid();
      this.deps.onFluidActiveChange(
        !!this.fluid && settings.background.fluidLayerPosition === "bottom",
      );
      // 流体开启后调用 fluid.resize() 确保尺寸正确
      if (this.fluid) {
        this.fluid.resize();
      }
    } else if (
      !settings.background.fluidEnabled &&
      oldFluidEnabled &&
      this.fluid
    ) {
      // 流体从 ON → OFF
      this.fluid.destroy();
      this.fluid = null;
      this.deps.onFluidActiveChange(false);
    } else if (this.fluid && settings.background.fluidEnabled) {
      // 流体保持启用，配置变更
      this.fluid.updateConfig(this.buildFluidConfig());
      this.deps.onFluidActiveChange(
        settings.background.fluidLayerPosition === "bottom",
      );
    }

    this.applyEffects(settings);
  }

  /** 适配画布尺寸（转发给 FluidSimulation） */
  resize(): void {
    this.fluid?.resize();
  }

  /** 每帧流体更新 + 持续 splat（由 RenderLoop 调用） */
  update(): void {
    if (!this.fluid) return;
    this.fluid.update();
    this.continuousSplat();
  }

  /**
   * 触发音符时的 splat（命中 splat + 可选 hitExplosion）
   * 合并原 WaterfallEngine.triggerNoteOn 中的 splat 调用
   */
  triggerNoteSplat(midi: number, velocity: number): void {
    if (!this.fluid) return;
    this.fluidSplat(midi, velocity);
    if (this.settings?.background.fluidParams.hitExplosion) {
      this.hitExplosionSplat(midi, velocity);
    }
  }

  /** 暂停/恢复流体更新（MIDI 模式用） */
  setPaused(paused: boolean): void {
    this.fluidPaused = paused;
  }

  /**
   * 清空流体（销毁重建，保持暂停状态）
   * 重建后保持 fluidPaused = true，直到下次播放时 setPaused(false) 才开始更新
   */
  clear(): void {
    if (this.fluid) {
      this.fluid.destroy();
      this.fluid = null;
      this.maybeInitFluid();
      this.fluidPaused = true;
    }
  }

  /** 当前是否已初始化流体且未暂停（供 RenderLoop.shouldUpdateFluid 判断） */
  isFluidActive(): boolean {
    return !!this.fluid && !this.fluidPaused;
  }

  /** 释放所有资源：销毁滤镜 → 销毁流体 → 重置状态 */
  dispose(): void {
    if (this.advancedBloomFilter) {
      this.advancedBloomFilter.destroy();
      this.advancedBloomFilter = null;
    }
    if (this.backdropBlurFilter) {
      this.backdropBlurFilter.destroy();
      this.backdropBlurFilter = null;
    }
    if (this.fluid) {
      this.fluid.destroy();
      this.fluid = null;
    }
    this.layers = null;
    this.fluidCanvas = null;
    this.settings = null;
    this.fluidPaused = false;
  }

  // ── 流体生命周期（私有） ──

  /**
   * 根据当前设置构建流体模拟配置
   * @returns 流体模拟的部分配置对象
   */
  private buildFluidConfig(): Partial<FluidSimulationConfig> {
    if (!this.settings) return {};
    const bg = this.settings.background;
    return resolveConfig(
      bg.fluidQuality,
      bg.fluidStyle,
      bg.fluidAdvanced,
      bg.fluidParams,
    );
  }

  /**
   * 在设置启用流体且尚未创建实例时，初始化 WebGL FluidSimulation 并启动
   *
   * WebGL 版本自带 canvas + GL context，渲染到独立的 canvas（由外部以 absolute
   * 定位层叠在 PixiJS canvas 之下），不参与 PixiJS stage 渲染。
   */
  private maybeInitFluid(): void {
    if (!this.settings) return;
    if (!this.settings.background.fluidEnabled) return;
    const config = this.buildFluidConfig();
    if (this.fluid || (config.SIM_RESOLUTION ?? 0) <= 0) return;
    const canvas = this.fluidCanvas;
    if (!canvas) {
      logger.warn("Fluid enabled but no fluid canvas provided");
      return;
    }
    try {
      this.fluid = new FluidSimulation(canvas, config);
      this.fluid.start();
    } catch (e) {
      logger.error({ err: e }, "Fluid initialization failed");
      this.fluid = null;
    }
  }

  // ── 后期滤镜（私有） ──

  /**
   * 应用后期效果（AdvancedBloomFilter + BackdropBlurFilter）
   *
   * - AdvancedBloomFilter 应用到 waterfall 层：使音符方块/光晕产生泛光
   * - BackdropBlurFilter 应用到 fluid 层（empty Container）：模糊其背后的 background 层
   *
   * 滤镜实例持久化，仅在启用/禁用状态切换时创建/销毁，参数变更原地更新。
   */
  private applyEffects(settings: WaterfallPianoSettings): void {
    if (!this.layers) return;
    const cfg = settings.effects;

    // ── AdvancedBloomFilter（waterfall 层） ──
    if (cfg.advancedBloomEnabled) {
      if (!this.advancedBloomFilter) {
        this.advancedBloomFilter = new AdvancedBloomFilter({
          threshold: cfg.advancedBloomThreshold,
          bloomScale: cfg.advancedBloomBloomScale,
          blur: cfg.advancedBloomBlur,
        });
      } else {
        this.advancedBloomFilter.threshold = cfg.advancedBloomThreshold;
        this.advancedBloomFilter.bloomScale = cfg.advancedBloomBloomScale;
        this.advancedBloomFilter.blur = cfg.advancedBloomBlur;
      }
      this.layers.waterfall.filters = this.composeWaterfallFilters(
        this.advancedBloomFilter,
      );
    } else if (this.advancedBloomFilter) {
      this.layers.waterfall.filters = this.composeWaterfallFilters(null);
      this.advancedBloomFilter.destroy();
      this.advancedBloomFilter = null;
    }

    // ── BackdropBlurFilter（fluid 层，模糊 background 层） ──
    if (cfg.backdropBlurEnabled) {
      if (!this.backdropBlurFilter) {
        this.backdropBlurFilter = new BackdropBlurFilter({
          strength: cfg.backdropBlurStrength,
        });
        this.layers.fluid.filters = [this.backdropBlurFilter];
      } else {
        this.backdropBlurFilter.strength = cfg.backdropBlurStrength;
      }
    } else if (this.backdropBlurFilter) {
      this.layers.fluid.filters = null;
      this.backdropBlurFilter.destroy();
      this.backdropBlurFilter = null;
    }
  }

  /**
   * 组合 waterfall 层的 filters 数组（AdvancedBloomFilter 由本管理器管理，
   * 其余由 NoteBlockRenderer 通过 setWaterfallFilterCompanion 注入）
   */
  private composeWaterfallFilters(
    bloom: AdvancedBloomFilter | null,
  ): Array<AdvancedBloomFilter> | null {
    return bloom ? [bloom] : null;
  }

  // ── Splat 逻辑（吸收自 FluidSplatManager） ──

  /**
   * 在命中线位置发射流体 splat，颜色取自音符色或单一色相配置
   */
  private fluidSplat(midi: number, velocity = DEFAULT_SPLAT_VELOCITY): void {
    if (!this.layers) return;
    const { keyboardRenderer } = this.deps;
    const { width, height, keyboardHeight } = this.deps.getLayout();
    const pCfg = this.settings?.particles ?? null;
    const bCfg = this.settings?.background ?? null;
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
    this.fluid!.splat(x, y, dx, dy, {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
    });
  }

  /** hitExplosion: 在命中线位置（音符X + 命中线Y）触发集中爆发 */
  private hitExplosionSplat(midi: number, _velocity: number): void {
    const pCfg = this.settings?.particles ?? null;
    const bCfg = this.settings?.background ?? null;
    if (!pCfg || !bCfg || !this.fluid) return;
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

    this.fluid.splat(x - spread, y, -force * 0.6, force, {
      r: rgb.r * colorMul,
      g: rgb.g * colorMul,
      b: rgb.b * colorMul,
    });
    this.fluid.splat(x + spread, y, force * 0.6, force, {
      r: rgb.r * colorMul,
      g: rgb.g * colorMul,
      b: rgb.b * colorMul,
    });
  }

  /** 流体持续 splat（长按持续 + blockCoverage 尾焰），由 update() 调用 */
  private continuousSplat(): void {
    if (!this.fluid) return;
    const pCfg = this.settings?.particles ?? null;
    const bCfg = this.settings?.background ?? null;

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
        this.fluid.splat(x, y, dx, dy, {
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
        this.fluid.splat(px, py, dx, dy, {
          r: rgb.r * colorMul,
          g: rgb.g * colorMul,
          b: rgb.b * colorMul,
        });
      }
    }
  }
}
