import type { WaterfallPianoSettings } from "../types";
import { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockSystem, type NoteBlockMode } from "./NoteBlockSystem";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { noteToColor } from "./NoteColorMapper";
import type { SoundEngine } from "../audio/SoundEngine";
import {
  FluidSimulation,
  resolveConfig,
  type FluidSimulationConfig,
} from "@/engine/fluid";
import { createLogger } from "@/utils/logger";
import { SplatPerturbation } from "@/engine/fluid/FluidConfig";
import { PerlinNoise1D } from "@/utils/PerlinNoise1D";

const logger = createLogger("WaterfallEngine");
const noise = new PerlinNoise1D();
/** Box-Muller 高斯随机数（均值 0，标准差 1） */
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

export interface WaterfallCanvases {
  background: HTMLCanvasElement;
  fluid: HTMLCanvasElement;
  waterfall: HTMLCanvasElement;
  keyboard: HTMLCanvasElement;
}

interface EngineCallbacks {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

const DEFAULT_VELOCITY = 90;

/**
 * 瀑布钢琴主引擎，协调键盘渲染、音符方块系统、背景渲染、流体模拟与音频输出
 */
export class WaterfallEngine {
  private canvases: WaterfallCanvases | null = null;
  private settings: WaterfallPianoSettings | null = null;
  private keyboardRenderer = new KeyboardRenderer();
  private noteBlockSystem = new NoteBlockSystem();
  private backgroundRenderer = new BackgroundRenderer();
  private perfMonitor = new PerformanceMonitor();
  private fluid: FluidSimulation | null = null;
  private soundEngine: SoundEngine | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private keyboardHeight = 0;
  private dpr = 1;
  private pointerDown = false;
  private activePointerMidi: number | null = null;
  /** 保存旧值的数值副本，用于检测设置变更（避免 deep watch 引用问题） */
  private prevKeyboardHeightRatio: number | null = null;
  private prevFluidEnabled: boolean | null = null;
  public showFPS = true;
  callbacks: EngineCallbacks = {};
  /** 每帧回调，在 noteBlockSystem.update() 之前调用，用于推进播放器时间 */
  frameCallback: (() => void) | null = null;
  /** 资源清理任务注册表（增强型 RAII 模式） */
  private cleanupTasks: Map<string, () => void | Promise<void>> = new Map();
  private disposed = false;
  /** MIDI 模式暂停标志：为 true 时渲染循环跳过 fluid.update() 和所有 splat 调用 */
  private fluidPaused = false;

  /**
   * 注册资源清理任务
   * @param name - 资源名称（用于日志和调试）
   * @param task - 清理函数（支持异步）
   */
  registerCleanup(name: string, task: () => void | Promise<void>): void {
    this.cleanupTasks.set(name, task);
  }

  /**
   * 初始化引擎：绑定画布、初始化各子系统、启动流体模拟与主循环
   * 初始化失败时自动执行完整清理（dispose），避免半初始化状态
   * @param canvases - 四层画布（背景、流体、瀑布、键盘）
   * @param settings - 瀑布钢琴配置
   */
  init(canvases: WaterfallCanvases, settings: WaterfallPianoSettings): void {
    try {
      this.canvases = canvases;
      this.settings = settings;
      this.keyboardRenderer.init(canvases.keyboard, settings);
      this.noteBlockSystem.init(canvases.waterfall, settings);
      this.backgroundRenderer.init(canvases.background, settings);
      this.noteBlockSystem.callbacks = {
        onNoteTrigger: (midi, vel) => this.onSynthesiaTrigger(midi, vel),
        onNoteEnd: (midi) => this.onSynthesiaEnd(midi),
      };
      this.maybeInitFluid();
      this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
      this.prevFluidEnabled = settings.background.fluidEnabled;
      this.bindPointerEvents();
      this.startLoop();

      // 注册清理任务
      this.registerCleanup("pointerEvents", () => this.unbindPointerEvents());
      this.registerCleanup("noteBlockSystem", () =>
        this.noteBlockSystem.dispose(),
      );
      this.registerCleanup("backgroundRenderer", () =>
        this.backgroundRenderer.dispose(),
      );
      this.registerCleanup("fluid", () => {
        this.fluid?.destroy();
        this.fluid = null;
      });
      this.registerCleanup("keyboardHighlights", () =>
        this.keyboardRenderer.clearAllHighlights(),
      );
    } catch (error) {
      logger.error({ err: error }, "Initialization failed");
      this.dispose();
      throw error;
    }
  }

  setSoundEngine(engine: SoundEngine): void {
    this.soundEngine = engine;
  }

  setSustain(enabled: boolean): void {
    this.soundEngine?.setSustain(enabled);
  }

  /**
   * 响应配置变更：更新各子系统，并在键盘高度比例或流体开关变化时重新布局
   * @param settings - 新的瀑布钢琴配置
   */
  applySettings(settings: WaterfallPianoSettings): void {
    // 用保存的数值副本检测变更（不依赖 watch 传递旧值，避免引用问题）
    const oldHeightRatio =
      this.prevKeyboardHeightRatio ?? settings.keyboard.heightRatio;
    const oldFluidEnabled =
      this.prevFluidEnabled ?? settings.background.fluidEnabled;
    this.settings = settings;
    // 保存数值副本供下次比较
    this.prevKeyboardHeightRatio = settings.keyboard.heightRatio;
    this.prevFluidEnabled = settings.background.fluidEnabled;
    // 键盘高度比例变化时需要重新布局所有 canvas
    if (
      settings.keyboard.heightRatio !== oldHeightRatio &&
      this.width > 0 &&
      this.height > 0
    ) {
      this.resize(this.width, this.height);
    }
    this.keyboardRenderer.resize(this.width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.setSettings(settings);
    this.backgroundRenderer.setSettings(settings);
    if (settings.background.fluidEnabled && !oldFluidEnabled) {
      this.maybeInitFluid();
      // 流体开启后需要重新布局确保 canvas 尺寸正确
      if (this.width > 0 && this.height > 0) {
        this.resize(this.width, this.height);
      }
    } else if (
      !settings.background.fluidEnabled &&
      oldFluidEnabled &&
      this.fluid
    ) {
      this.fluid.destroy();
      this.fluid = null;
    } else if (this.fluid && settings.background.fluidEnabled) {
      this.fluid.updateConfig(this.buildFluidConfig());
    }
  }

  /**
   * 切换音符方块模式；模式变化时清空已有音符方块
   * @param mode - 音符方块模式（realtime / synthesia）
   */
  setMode(mode: NoteBlockMode): void {
    if (this.noteBlockSystem.getMode() !== mode) {
      this.noteBlockSystem.clearVisualBlocks();
    }
    this.noteBlockSystem.setMode(mode);
  }

  getFPS(): number {
    return this.perfMonitor.getFps();
  }

  /**
   * 重新计算布局：根据键盘高度比例分配画布尺寸，并通知各子系统与流体
   * @param width - 画布总宽度（CSS 像素）
   * @param height - 画布总高度（CSS 像素）
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const kbRatio = this.settings?.keyboard.heightRatio ?? 0.3;
    this.keyboardHeight = Math.max(80, Math.floor(height * kbRatio));
    const waterfallHeight = height - this.keyboardHeight;
    this.keyboardRenderer.resize(width, this.keyboardHeight, this.dpr);
    this.noteBlockSystem.resize(
      width,
      waterfallHeight,
      this.dpr,
      this.keyboardRenderer,
    );
    this.backgroundRenderer.resize(width, height, this.dpr);
    this.layoutCanvases(waterfallHeight);
    if (this.fluid) {
      this.fluid.resize();
    }
  }

  /**
   * 设置四层画布的 CSS 定位：背景/流体全屏，瀑布区占顶部，键盘区占底部
   * @param waterfallHeight - 瀑布区域高度（像素）
   */
  private layoutCanvases(waterfallHeight: number): void {
    if (!this.canvases) return;
    const setBox = (c: HTMLCanvasElement, top: number, h: number) => {
      c.style.position = "absolute";
      c.style.top = `${top}px`;
      c.style.left = "0";
      c.style.width = `${this.width}px`;
      c.style.height = `${h}px`;
    };
    setBox(this.canvases.background, 0, this.height);
    setBox(this.canvases.fluid, 0, this.height);
    setBox(this.canvases.waterfall, 0, waterfallHeight);
    setBox(this.canvases.keyboard, waterfallHeight, this.keyboardHeight);
  }

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
   * 在设置启用流体且尚未创建实例时，初始化 FluidSimulation 并启动
   */
  private maybeInitFluid(): void {
    if (!this.canvases || !this.settings) return;
    if (!this.settings.background.fluidEnabled) return;
    const config = this.buildFluidConfig();
    if (this.fluid || (config.SIM_RESOLUTION ?? 0) <= 0) return;
    try {
      this.fluid = new FluidSimulation(
        this.canvases.fluid,
        config,
      );
      this.fluid.start();
    } catch {
      this.fluid = null;
    }
  }

  private bindPointerEvents(): void {
    if (!this.canvases) return;
    const kb = this.canvases.keyboard;
    kb.style.touchAction = "none";
    kb.addEventListener("pointerdown", this.onPointerDown);
    kb.addEventListener("pointermove", this.onPointerMove);
    kb.addEventListener("pointerup", this.onPointerUp);
    kb.addEventListener("pointercancel", this.onPointerUp);
    kb.addEventListener("pointerleave", this.onPointerUp);
  }

  private unbindPointerEvents(): void {
    if (!this.canvases) return;
    const kb = this.canvases.keyboard;
    kb.removeEventListener("pointerdown", this.onPointerDown);
    kb.removeEventListener("pointermove", this.onPointerMove);
    kb.removeEventListener("pointerup", this.onPointerUp);
    kb.removeEventListener("pointercancel", this.onPointerUp);
    kb.removeEventListener("pointerleave", this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = true;
    const midi = this.keyboardRenderer.xToMidi(e.offsetX);
    if (midi !== null) {
      this.activePointerMidi = midi;
      this.triggerNoteOn(midi, DEFAULT_VELOCITY);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    const midi = this.keyboardRenderer.xToMidi(e.offsetX);
    if (midi !== null && midi !== this.activePointerMidi) {
      if (this.activePointerMidi !== null) {
        this.triggerNoteOff(this.activePointerMidi);
      }
      this.activePointerMidi = midi;
      this.triggerNoteOn(midi, DEFAULT_VELOCITY);
    }
  };

  private onPointerUp = (): void => {
    this.pointerDown = false;
    if (this.activePointerMidi !== null) {
      this.triggerNoteOff(this.activePointerMidi);
      this.activePointerMidi = null;
    }
  };

  /**
   * 触发音符发声：驱动音频、实时音符方块、键盘高亮、流体喷射及命中爆炸效果
   * @param midi - MIDI 音符编号（0-127）
   * @param velocity - 力度（0-127）
   */
  triggerNoteOn(midi: number, velocity: number): void {
    if (!this.settings) return;
    this.soundEngine?.noteOn(midi, velocity);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.playRealtimeNote(midi, velocity);
    }
    this.keyboardRenderer.highlightNote(midi);
    this.fluidSplat(midi, velocity);
    // hitExplosion: 在音符X + 命中线Y位置触发爆发式 splat
    if (this.settings.background.fluidParams.hitExplosion && this.fluid) {
      this.hitExplosionSplat(midi, velocity);
    }
    this.callbacks.onNoteOn?.(midi, velocity);
  }

  triggerNoteOff(midi: number): void {
    this.soundEngine?.noteOff(midi);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.releaseRealtimeNote(midi);
    }
    this.keyboardRenderer.clearHighlight(midi);
    this.callbacks.onNoteOff?.(midi);
  }

  /**
   * Synthesia 模式下音符触发回调：驱动音频、键盘高亮与流体效果（不产生实时方块）
   * @param midi - MIDI 音符编号
   * @param velocity - 力度
   */
  private onSynthesiaTrigger(midi: number, velocity: number): void {
    this.soundEngine?.noteOn(midi, velocity);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.playRealtimeNoteFromMidi(midi, velocity);
    }
    this.keyboardRenderer.highlightNote(midi);
    this.fluidSplat(midi, velocity);
    // hitExplosion: 在音符X + 命中线Y位置触发爆发式 splat
    if (this.settings?.background.fluidParams.hitExplosion && this.fluid) {
      this.hitExplosionSplat(midi, velocity);
    }
  }

  /**
   * Synthesia 模式下音符结束回调：停止音频并清除键盘高亮
   * @param midi - MIDI 音符编号
   */
  private onSynthesiaEnd(midi: number): void {
    this.soundEngine?.noteOff(midi);
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.releaseRealtimeNoteFromMidi(midi);
    }
    this.keyboardRenderer.clearHighlight(midi);
  }

  /**
   * 在命中线位置发射流体 splat，颜色取自音符色或单一色相配置
   * @param midi - MIDI 音符编号，用于确定 splat 的水平位置和颜色
   * @param velocity - 力度，影响颜色亮度与喷射强度
   */
  private fluidSplat(midi: number, velocity = DEFAULT_VELOCITY): void {
    if (!this.fluid || !this.canvases) return;
    let x = this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
    let y = this.keyboardHeight / Math.max(1, this.height);

    let rgb: { r: number; g: number; b: number };
    const hue = this.settings?.background.fluidParams.splatColorHue;
    if (hue !== undefined && hue > 0) {
      const lightness = 0.4 + (velocity / 127) * 0.3;
      rgb = hslToRgbNorm(hue, 0.8, lightness);
    } else {
      const colorHex = noteToColor(
        midi,
        this.settings?.particles.colorScheme ?? "pitch",
        undefined,
        this.settings?.particles.customColors,
      );
      rgb = hexToRgbNorm(colorHex);
    }

    let dx = 0;
    let dy = 200;
    const p = this.settings?.background.fluidParams.fluidSplatPerturbation;
    if (hasPerturbation(p)) {
      if (p!.positionJitter && p!.positionJitter > 0) {
        x += PerlinNoise1DRandomNumber() * p!.positionJitter * 0.02;
        y += PerlinNoise1DRandomNumber() * p!.positionJitter * 0.02;
      }
      if (p!.forceJitter && p!.forceJitter > 0) {
        dx += PerlinNoise1DRandomNumber() * dy * p!.forceJitter;
        dy += PerlinNoise1DRandomNumber() * dy * p!.forceJitter;
      }
      if (p!.colorJitter && p!.colorJitter > 0) {
        rgb = {
          r: Math.max(0, rgb.r + PerlinNoise1DRandomNumber() * p!.colorJitter * 0.15),
          g: Math.max(0, rgb.g + PerlinNoise1DRandomNumber() * p!.colorJitter * 0.15),
          b: Math.max(0, rgb.b + PerlinNoise1DRandomNumber() * p!.colorJitter * 0.15),
        };
      }
    }
    this.fluid.splat(x, y, dx, dy, rgb);
  }

  /** hitExplosion: 在命中线位置（音符X + 命中线Y）触发集中爆发 */
  private hitExplosionSplat(midi: number, _velocity: number): void {
    if (!this.fluid || !this.settings) return;
    let x = this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
    const hitLineY =
      (this.height - this.keyboardHeight) / Math.max(1, this.height);
    let rgb: { r: number; g: number; b: number };
    const hue = this.settings.background.fluidParams.splatColorHue;
    if (hue !== undefined && hue > 0) {
      rgb = hslToRgbNorm(hue, 0.9, 0.6);
    } else {
      const colorHex = noteToColor(
        midi,
        this.settings.particles.colorScheme,
        undefined,
        this.settings.particles.customColors,
      );
      rgb = hexToRgbNorm(colorHex);
    }
    let spread = this.settings.particles.hitExplosionRadius ?? 0.03;
    let force = spread * 5000;
    let colorMul = 0.7;

    const p = this.settings.background.fluidParams.hitExplosionPerturbation;
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

    this.fluid.splat(x - spread, -hitLineY, -force * 0.6, force, {
      r: rgb.r * colorMul, g: rgb.g * colorMul, b: rgb.b * colorMul,
    });
    this.fluid.splat(x + spread, -hitLineY, force * 0.6, force, {
      r: rgb.r * colorMul, g: rgb.g * colorMul, b: rgb.b * colorMul,
    });
  }

  /**
   * 启动 rAF 主循环：每帧推进播放、渲染各子系统、降帧更新流体并叠加持续 splat
   */
  private startLoop(): void {
    this.lastTime = performance.now();
    let fluidFrameCount = 0;
    let lastPerfLog = 0;
    const FLUID_SKIP_FRAMES = 1; // 每隔1帧更新流体，即30fps

    const loop = (now: number) => {
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.perfMonitor.recordFrame(dt);

      const t0 = performance.now();
      // 先推进播放器时间（通过 tick → onProgress → setTransportTime），
      // 再更新音符方块系统，确保 updateSynthesia 使用最新的 transportTime
      this.frameCallback?.();
      const tFrame = performance.now();

      this.backgroundRenderer.render(now);
      const tBg = performance.now();

      this.noteBlockSystem.update(dt / 1000);
      const tNbUpdate = performance.now();

      this.noteBlockSystem.render();
      const tNbRender = performance.now();

      this.keyboardRenderer.render();
      const tKb = performance.now();

      // FPS 显示：在所有渲染完成后绘制（避免被 clearRect 清掉）
      if (this.showFPS && this.canvases) {
        const ctx = this.canvases.waterfall.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.font = "bold 12px monospace";
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 4;
          ctx.fillText(`FPS: ${Math.round(this.perfMonitor.getFps())}`, 10, 20);
          ctx.restore();
        }
      }

      // 流体模拟由主循环驱动，但降帧运行
      // MIDI 暂停时 fluidPaused=true，完全跳过 fluid.update() 和 splat 调用
      fluidFrameCount++;
      let tFluid = 0;
      if (this.fluid && !this.fluidPaused && fluidFrameCount > FLUID_SKIP_FRAMES) {
        const tf0 = performance.now();
        this.fluid.update();
        fluidFrameCount = 0;

        // 长按持续触发：对键盘上持续按住的音符发射弱 splat
        if (this.fluid && this.settings?.background.fluidEnabled) {
          const sP = this.settings.background.fluidParams.sustainedSplatPerturbation;
          const sHas = hasPerturbation(sP);
          for (const midi of this.keyboardRenderer.getActiveNotes()) {
            let x =
              this.keyboardRenderer.midiToX(midi) / Math.max(1, this.width);
            let y = this.keyboardHeight / Math.max(1, this.height);
            const hue = this.settings.background.fluidParams.splatColorHue;
            let rgb: { r: number; g: number; b: number };
            if (hue !== undefined && hue > 0) {
              rgb = hslToRgbNorm(hue, 0.8, 0.4);
            } else {
              const colorHex = noteToColor(
                midi,
                this.settings.particles.colorScheme,
                undefined,
                this.settings.particles.customColors,
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
        if (this.settings?.background.fluidParams.blockCoverage && this.fluid) {
          const bP = this.settings.background.fluidParams.blockCoveragePerturbation;
          const bHas = hasPerturbation(bP);
          const blockPositions = this.noteBlockSystem.getActiveBlockPositions(
            this.keyboardRenderer,
            this.height,
          );
          for (const pos of blockPositions) {
            let px = pos.normX;
            let py = pos.normY;
            const hue = this.settings.background.fluidParams.splatColorHue;
            let rgb: { r: number; g: number; b: number };
            if (hue !== undefined && hue > 0) {
              rgb = hslToRgbNorm(hue, 0.8, 0.5);
            } else {
              const colorHex = noteToColor(
                pos.midi,
                this.settings.particles.colorScheme,
                undefined,
                this.settings.particles.customColors,
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
        tFluid = performance.now() - tf0;
      }

      // [DEBUG-perf] 每秒输出一次关键路径耗时
      if (now - lastPerfLog > 1000) {
        lastPerfLog = now;
        const total = performance.now() - t0;
        logger.info(
          `[DEBUG-perf] total=${total.toFixed(1)}ms frame=${tFrame - t0 > 0 ? (tFrame - t0).toFixed(1) : "0"}ms bg=${(tBg - tFrame).toFixed(1)}ms nbUpd=${(tNbUpdate - tBg).toFixed(1)}ms nbRdr=${(tNbRender - tNbUpdate).toFixed(1)}ms kb=${(tKb - tNbRender).toFixed(1)}ms fluid=${tFluid.toFixed(1)}ms fps=${Math.round(this.perfMonitor.getFps())}`,
        );
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  get keyboardRendererRef(): KeyboardRenderer {
    return this.keyboardRenderer;
  }

  get noteBlockSystemRef(): NoteBlockSystem {
    return this.noteBlockSystem;
  }

  get backgroundRendererRef(): BackgroundRenderer {
    return this.backgroundRenderer;
  }

  /**
   * 停止播放时的清理：清除所有键盘高亮、停止所有音频、释放实时方块
   */
  stopAllSounds(): void {
    this.keyboardRenderer.clearAllHighlights();
    this.soundEngine?.allNotesOff();
    if (this.noteBlockSystem.getMode() === "realtime") {
      this.noteBlockSystem.clearNoteBlocks();
    }
  }

  /**
   * MIDI 模式专用：暂停/恢复流体模拟。
   * 设置 fluidPaused 标志后，渲染循环完全跳过 fluid.update()（solver.step + render + splat），
   * 从根源上消除暂停时的 GPU 开销和帧率下降。
   */
  setFluidPaused(paused: boolean): void {
    this.fluidPaused = paused;
  }

  /**
   * MIDI 模式专用：清空流体模拟中的所有粒子和染料。
   * 销毁当前实例并重建，重建后保持暂停状态（fluidPaused = true），
   * 直到下次播放时 setFluidPaused(false) 才开始更新。
   */
  clearFluid(): void {
    if (this.fluid) {
      this.fluid.destroy();
      this.fluid = null;
      this.maybeInitFluid();
      this.fluidPaused = true;
    }
  }

  getPerformanceFps(): number {
    return this.perfMonitor.getFps();
  }

  /**
   * 增强型 dispose：执行所有注册的清理任务，支持异步等待完成
   * 初始化失败时直接调用 dispose 即可，无需 partialCleanup
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    // 停止渲染循环
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // 执行所有注册的清理任务
    const results = await Promise.allSettled(
      Array.from(this.cleanupTasks.entries()).map(async ([name, task]) => {
        try {
          await task();
          logger.debug(`Cleaned up ${name}`);
        } catch (e) {
          logger.error({ err: e }, `Cleanup ${name} failed`);
          throw e;
        }
      }),
    );

    this.cleanupTasks.clear();

    // 报告失败的清理
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      logger.warn(`${failed.length} cleanup tasks failed`);
    }
  }

  /** 检查引擎是否已被销毁 */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 强制重绘：清空所有 canvas 并重新渲染当前帧
   * 用于窗口最小化恢复后消除残留显示问题
   */
  forceRedraw(): void {
    if (this.disposed) return;
    this.backgroundRenderer.render(performance.now());
    this.noteBlockSystem.render();
    this.keyboardRenderer.render();
    logger.debug("Force redraw completed");
  }
}

/**
 * 十六进制颜色字符串转归一化 RGB（各分量 0-1）
 * @param hex - 十六进制颜色（如 "#ff8800"）
 * @returns 归一化 RGB 对象
 */
function hexToRgbNorm(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").padEnd(6, "0");
  return {
    r: (parseInt(normalized.slice(0, 2), 16) || 0) / 255,
    g: (parseInt(normalized.slice(2, 4), 16) || 0) / 255,
    b: (parseInt(normalized.slice(4, 6), 16) || 0) / 255,
  };
}

/** HSL (0-1 范围) → 归一化 RGB (0-1) */
function hslToRgbNorm(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: f(0), g: f(8), b: f(4) };
}
