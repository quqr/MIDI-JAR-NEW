import * as PIXI from "pixi.js";
import { isBlackKey, noteToName } from "./KeyboardRenderer";
import { ParticleSystem } from "./ParticleSystem";
import type {
  VisualStyle,
  ColorScheme,
  ParticleShape,
  ScheduledNote,
  HitLineConfig,
  NoteBlockConfig,
  TrailParticleConfig,
  HitParticleConfig,
  ParticlePhysicsConfig,
  NoteTextureConfig,
  NoteBlockParticleConfig,
  FlowDirection,
} from "../types";

// ─── 音符块 ───
interface NoteBlock {
  midi: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha: number;
  startTime: number;
  active: boolean;
  hitTime: number;
  endTime: number;
  hasTriggered: boolean;
  hasEnded: boolean;
  velocity: number;
  hand: "left" | "right" | "unknown";
  trackColor: number | null;
  nameSprite: PIXI.Text | null; // 音名标签
}

export interface NoteBlockCallbacks {
  onNoteTrigger?: (
    midi: number,
    velocity: number,
    hand: "left" | "right" | "unknown",
  ) => void;
  onNoteEnd?: (midi: number) => void;
}

const TEXT_HEIGHT = 14; // 音名标签的固定文字高度（用于自适应判断）

export class NoteBlockSystem {
  private graphics: PIXI.Graphics;
  private trailGraphics: PIXI.Graphics;
  private hitLineGraphics: PIXI.Graphics;
  private nameLayer: PIXI.Container; // 音名标签层（位于音符块之上）
  private particleSystem: ParticleSystem;
  private blocks: NoteBlock[] = [];

  private mode: "realtime" | "synthesia" = "realtime";

  // 布局
  private keyboardY = 0;
  private canvasHeight = 0;
  private canvasWidth = 0;
  private keyWidth = 0;
  private blackKeyWidth = 0;

  // 速度
  private realtimeSpeed = 2;
  private fallSpeed = 120;
  private lookAhead = 3;

  // 视觉配置
  private style: VisualStyle = "blocks";
  private colorScheme: ColorScheme = "pitch";
  private opacity = 0.9;
  private cornerRadius = 3;
  private particleSize = 6;
  private trailEnabled = false;
  private density = 5;

  // 命中线配置
  private hitLineConfig: HitLineConfig = {
    color: "#ffffff",
    glow: true,
    thickness: 2,
    glowRadius: 15,
    glowIntensity: 0.8,
    style: "solid",
    visible: true,
    shaderGlow: true,
  };
  private hitLineColor = 0xffffff;

  // 音符块配置
  private noteBlockConfig: NoteBlockConfig = {
    borderColor: "#ffffff",
    borderWidth: 1,
    borderEnabled: false,
    gradientEnabled: false,
    gradientTopColor: "#6366f1",
    gradientBottomColor: "#14b8a6",
    gradientMidColor: "#3b82f6",
    highlightEnabled: true,
    highlightOpacity: 0.3,
    fadeIn: true,
    fadeOut: true,
    multiLayerGradient: true,
    activeGlow: true,
    activeGlowRadius: 8,
    shadowEnabled: true,
  };

  // 音符块纹理配置
  private noteTextureConfig: NoteTextureConfig = {
    preset: "none",
    scale: 1,
    intensity: 0.3,
    customImage: "",
    customImageIntensity: 0.5,
  };

  // 音符块粒子配置
  private noteBlockParticleConfig: NoteBlockParticleConfig = {
    surfaceEmission: { enabled: false, rate: 0.3, speed: 1, lifetime: 20 },
    hitExplosion: { enabled: false, count: 12, speed: 4, lifetime: 25 },
    orbiting: { enabled: false, count: 4, radius: 10, speed: 2 },
  };

  // Synthesia 播放状态
  private transportTime = 0;
  private isTransportPlaying = false;

  // 新增配置
  private showNoteNames = false;
  private flowDirection: FlowDirection = "down";
  private degradeMode = false;

  private callbacks: NoteBlockCallbacks = {};

  constructor(
    blockContainer: PIXI.Container,
    hitLineContainer: PIXI.Container,
  ) {
    this.trailGraphics = new PIXI.Graphics();
    this.hitLineGraphics = new PIXI.Graphics();
    this.graphics = new PIXI.Graphics();
    this.nameLayer = new PIXI.Container();
    blockContainer.addChild(this.trailGraphics);
    blockContainer.addChild(this.graphics);
    blockContainer.addChild(this.nameLayer);
    hitLineContainer.addChild(this.hitLineGraphics);

    this.particleSystem = new ParticleSystem(blockContainer);
  }

  setCallbacks(callbacks: NoteBlockCallbacks) {
    this.callbacks = callbacks;
  }

  // ─── 布局设置 ───
  setCanvasSize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.updateFallSpeed();
  }

  setKeyboardY(y: number) {
    this.keyboardY = y;
    this.updateFallSpeed();
  }

  setKeyWidth(width: number) {
    this.keyWidth = width;
    this.blackKeyWidth = width * 0.6;
  }

  private updateFallSpeed() {
    const fallDistance = this.keyboardY;
    if (this.lookAhead > 0 && fallDistance > 0) {
      this.fallSpeed = fallDistance / this.lookAhead;
    }
  }

  setMode(mode: "realtime" | "synthesia") {
    this.mode = mode;
  }

  // ─── 视觉配置 ───
  setRealtimeSpeed(speed: number) {
    this.realtimeSpeed = speed;
  }

  setLookAhead(seconds: number) {
    this.lookAhead = seconds;
    this.updateFallSpeed();
  }

  setStyle(style: VisualStyle) {
    this.style = style;
  }

  setColorScheme(scheme: ColorScheme) {
    this.colorScheme = scheme;
  }

  setOpacity(op: number) {
    this.opacity = op;
  }

  setCornerRadius(r: number) {
    this.cornerRadius = r;
  }

  setParticleShape(shape: ParticleShape) {
    this.particleSystem.setShape(shape);
  }

  setParticleSize(size: number) {
    this.particleSize = size;
  }

  setTrailEnabled(enabled: boolean) {
    this.trailEnabled = enabled;
  }

  setDensity(d: number) {
    this.density = d;
  }

  setHitLineConfig(config: HitLineConfig) {
    this.hitLineConfig = config;
    this.hitLineColor = this.hexStringToNumber(config.color);
  }

  setNoteBlockConfig(config: NoteBlockConfig) {
    this.noteBlockConfig = config;
  }

  setTrailParticleConfig(config: TrailParticleConfig) {
    this.particleSystem.setTrailConfig(config);
    this.particleSystem.setUseGlowTexture(config.glowTexture);
  }

  setHitParticleConfig(config: HitParticleConfig) {
    this.particleSystem.setHitConfig(config);
  }

  setPhysicsConfig(config: ParticlePhysicsConfig) {
    this.particleSystem.setPhysicsConfig(config);
  }

  setNoteTextureConfig(config: NoteTextureConfig) {
    this.noteTextureConfig = config;
  }

  setNoteBlockParticleConfig(config: NoteBlockParticleConfig) {
    this.noteBlockParticleConfig = config;
  }

  setShowNoteNames(enabled: boolean) {
    this.showNoteNames = enabled;
    if (!enabled) {
      // 清理所有音名标签
      for (const block of this.blocks) {
        if (block.nameSprite) {
          this.nameLayer.removeChild(block.nameSprite);
          block.nameSprite.destroy();
          block.nameSprite = null;
        }
      }
    }
  }

  setFlowDirection(direction: FlowDirection) {
    this.flowDirection = direction;
  }

  setParticleHardLimit(limit: number) {
    this.particleSystem.setHardLimit(limit);
  }

  setLifecycleCurve(enabled: boolean) {
    this.particleSystem.setLifecycleEnabled(enabled);
  }

  setDegradeMode(enabled: boolean) {
    this.degradeMode = enabled;
    this.particleSystem.setDegradeMode(enabled);
  }

  // ─── Synthesia 播放控制 ───
  setTransportTime(time: number) {
    this.transportTime = time;
  }

  setTransportPlaying(playing: boolean) {
    this.isTransportPlaying = playing;
  }

  // ─── 实时模式：开始音符 ───
  startRealtimeNote(midi: number, x: number, velocity: number) {
    const color = this.resolveColor(midi, "unknown", null);
    const w = isBlackKey(midi) ? this.blackKeyWidth : this.keyWidth;
    const block: NoteBlock = {
      midi,
      x: x - w / 2,
      y: this.keyboardY,
      width: w,
      height: 0,
      color,
      alpha: this.opacity,
      startTime: performance.now(),
      active: true,
      hitTime: 0,
      endTime: 0,
      hasTriggered: true,
      hasEnded: false,
      velocity,
      hand: "unknown",
      trackColor: null,
      nameSprite: null,
    };
    this.blocks.push(block);
  }

  endRealtimeNote(midi: number) {
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (b.midi === midi && b.active) {
        b.active = false;
        break;
      }
    }
  }

  // ─── Synthesia 模式：调度音符 ───
  scheduleNotes(notes: ScheduledNote[], getX: (midi: number) => number) {
    for (const note of notes) {
      const x = getX(note.midi);
      if (x < 0) continue;
      const color = this.resolveColor(note.midi, note.hand, null);
      const blockHeight = Math.max(8, note.duration * this.fallSpeed);
      const w = isBlackKey(note.midi) ? this.blackKeyWidth : this.keyWidth;

      const block: NoteBlock = {
        midi: note.midi,
        x: x - w / 2,
        y: 0,
        width: w,
        height: blockHeight,
        color,
        alpha: this.opacity,
        startTime: 0,
        active: false,
        hitTime: note.time,
        endTime: note.time + note.duration,
        hasTriggered: false,
        hasEnded: false,
        velocity: note.velocity,
        hand: note.hand,
        trackColor: null,
        nameSprite: null,
      };
      this.blocks.push(block);
    }
  }

  // ─── 颜色解析 ───
  private resolveColor(
    midi: number,
    hand: "left" | "right" | "unknown",
    trackColor: number | null,
  ): number {
    if (trackColor !== null) return trackColor;

    switch (this.colorScheme) {
      case "pitch": {
        const t = (midi - 21) / 87;
        return this.hslToHex(t * 300, 85, 55);
      }
      case "hands": {
        if (hand === "left") return 0x6366f1;
        if (hand === "right") return 0x14b8a6;
        return 0xf59e0b;
      }
      case "rainbow": {
        const hue = ((midi - 21) / 87) * 360;
        return this.hslToHex(hue, 90, 55);
      }
      case "warm": {
        const t = (midi - 21) / 87;
        return this.hslToHex(t * 60, 90, 55);
      }
      case "cool": {
        const t = (midi - 21) / 87;
        return this.hslToHex(180 + t * 80, 80, 50);
      }
      case "neon": {
        const t = (midi - 21) / 87;
        return this.hslToHex(t * 360, 100, 60);
      }
      default:
        return 0x6366f1;
    }
  }

  private hslToHex(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color);
    };
    return (f(0) << 16) + (f(8) << 8) + f(4);
  }

  private hexStringToNumber(hex: string): number {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 0xffffff;
    return (
      (parseInt(result[1], 16) << 16) +
      (parseInt(result[2], 16) << 8) +
      parseInt(result[3], 16)
    );
  }

  // ─── 获取命中线 Y 坐标（受流动方向影响） ───
  private getHitLineY(): number {
    // 向下流动（默认）：命中线在键盘上方（keyboardY）
    // 向上流动：命中线在键盘下方（但键盘本身在底部，所以仍使用 keyboardY）
    // 简化处理：命中线始终在 keyboardY 位置，只是音符块流动方向不同
    return this.keyboardY;
  }

  // ─── 主更新循环 ───
  update(delta: number, deltaSeconds: number) {
    // 清理上一帧可能遗留的子节点并销毁，防止 Graphics 子节点累积泄漏
    if (this.graphics.children.length > 0) {
      const children = this.graphics.removeChildren();
      for (const child of children) child.destroy();
    }
    this.graphics.clear();
    this.trailGraphics.clear();
    this.hitLineGraphics.clear();

    const now = performance.now();
    const toRemove: number[] = [];

    this.drawHitLine();

    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];

      if (this.mode === "realtime") {
        this.updateRealtimeBlock(block, now, delta);
      } else {
        this.updateSynthesiaBlock(block, deltaSeconds);
      }

      if (this.shouldRemove(block)) {
        toRemove.push(i);
        if (block.nameSprite) {
          this.nameLayer.removeChild(block.nameSprite);
          block.nameSprite.destroy();
          block.nameSprite = null;
        }
        continue;
      }

      if (this.style === "blocks" || this.style === "hybrid") {
        this.drawBlock(block);
        this.updateNameLabel(block);
      }

      // 表面散发粒子
      if (this.noteBlockParticleConfig.surfaceEmission.enabled) {
        const active =
          block.active ||
          (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded);
        if (active) {
          this.particleSystem.spawnSurfaceEmission(
            block.x,
            block.y,
            block.width,
            block.height,
            block.color,
            this.noteBlockParticleConfig.surfaceEmission.rate,
            this.noteBlockParticleConfig.surfaceEmission.speed,
            this.noteBlockParticleConfig.surfaceEmission.lifetime,
          );
        }
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.blocks.splice(toRemove[i], 1);
    }

    // 更新粒子系统（替代原有的 trails/hitParticles/surface/orbiting）
    this.particleSystem.update(delta);
  }

  // ─── 实时模式更新 ───
  private updateRealtimeBlock(block: NoteBlock, now: number, delta: number) {
    if (block.active) {
      const elapsed = now - block.startTime;
      block.height = Math.max(8, elapsed * this.realtimeSpeed * 0.04);
      // 向下流动时，块从键盘向上生长；向上流动时，块从键盘向下生长（但实时模式主要向上）
      // 实时模式保持原行为：向上生长
      block.y = this.keyboardY - block.height;
    } else {
      block.y -= this.realtimeSpeed * delta;
    }

    if (this.trailEnabled && block.active && Math.random() < 0.3) {
      // 实时模式向上：拖尾从底部向上
      this.particleSystem.spawnTrail(
        block.x + block.width / 2,
        block.y + block.height,
        block.color,
        -1,
        this.density,
      );
    }
  }

  // ─── Synthesia 模式更新 ───
  private updateSynthesiaBlock(block: NoteBlock, _deltaSeconds: number) {
    if (!this.isTransportPlaying) return;

    const hitY = this.getHitLineY();
    if (this.flowDirection === "down") {
      // 向下流动：音符块从顶部下落，底边在 hitTime 到达命中线
      block.y = hitY - (block.hitTime - this.transportTime) * this.fallSpeed;
    } else {
      // 向上流动：音符块从底部向上，底边在 hitTime 到达命中线
      // 这里"底边"的概念需要反转：向上流动时，块的顶部先到达命中线
      // 简化处理：块从下方（屏幕外）向上移动，块底到达命中线时触发
      block.y =
        hitY +
        (block.hitTime - this.transportTime) * this.fallSpeed -
        block.height;
    }

    // 触发 noteOn
    if (!block.hasTriggered && this.transportTime >= block.hitTime) {
      block.hasTriggered = true;
      this.callbacks.onNoteTrigger?.(block.midi, block.velocity, block.hand);
      if (this.noteBlockParticleConfig.hitExplosion.enabled) {
        this.particleSystem.spawnHitExplosion(
          block.x + block.width / 2,
          hitY,
          block.color,
          this.particleSize,
        );
      } else if (this.style === "hybrid") {
        this.particleSystem.spawnHitExplosion(
          block.x + block.width / 2,
          hitY,
          block.color,
          this.particleSize,
        );
      }
    }

    // 触发 noteOff
    if (!block.hasEnded && this.transportTime >= block.endTime) {
      block.hasEnded = true;
      this.callbacks.onNoteEnd?.(block.midi);
    }

    // 拖尾粒子
    if (
      this.trailEnabled &&
      block.y > 0 &&
      block.y < this.keyboardY &&
      Math.random() < 0.2
    ) {
      // 向下流动时拖尾向下，向上流动时拖尾向上
      const direction = this.flowDirection === "down" ? 1 : -1;
      const py = direction > 0 ? block.y : block.y + block.height;
      this.particleSystem.spawnTrail(
        block.x + block.width / 2,
        py,
        block.color,
        direction,
        this.density,
      );
    }
  }

  // ─── 移除判断 ───
  private shouldRemove(block: NoteBlock): boolean {
    if (this.mode === "realtime") {
      return !block.active && block.y + block.height < 0;
    } else {
      if (this.flowDirection === "down") {
        return block.hasEnded && block.y > this.canvasHeight;
      } else {
        // 向上流动：块向上离开屏幕
        return block.hasEnded && block.y + block.height < 0;
      }
    }
  }

  // ─── 绘制命中线 ───
  private drawHitLine() {
    const cfg = this.hitLineConfig;
    if (!cfg.visible) return;

    const g = this.hitLineGraphics;
    const y = this.getHitLineY();
    const half = cfg.thickness / 2;

    // 如果启用 shader 泛光，则由 PostProcessingRenderer 处理，这里只画主线
    // 否则使用多层矩形模拟
    if (cfg.glow && !cfg.shaderGlow) {
      const layers = Math.max(1, Math.ceil(cfg.glowRadius / 5));
      for (let i = layers; i > 0; i--) {
        const spread = (i / layers) * cfg.glowRadius;
        const alpha = 0.08 * cfg.glowIntensity * (i / layers);
        g.rect(
          0,
          y - half - spread,
          this.canvasWidth,
          cfg.thickness + spread * 2,
        );
        g.fill({ color: this.hitLineColor, alpha });
      }
    }

    // 主线
    if (cfg.style === "dashed") {
      const dashLen = 12;
      const gapLen = 8;
      for (let x = 0; x < this.canvasWidth; x += dashLen + gapLen) {
        g.rect(
          x,
          y - half,
          Math.min(dashLen, this.canvasWidth - x),
          cfg.thickness,
        );
        g.fill({ color: this.hitLineColor, alpha: 0.6 });
      }
    } else if (cfg.style === "dotted") {
      const dotSpacing = 8;
      for (let x = 0; x < this.canvasWidth; x += dotSpacing) {
        g.circle(x, y, cfg.thickness / 2);
        g.fill({ color: this.hitLineColor, alpha: 0.6 });
      }
    } else {
      g.rect(0, y - half, this.canvasWidth, cfg.thickness);
      g.fill({ color: this.hitLineColor, alpha: 0.6 });
    }
  }

  // ─── 绘制音符块（多层渐变 + 活跃发光 + 阴影） ───
  private drawBlock(block: NoteBlock) {
    const g = this.graphics;
    const cfg = this.noteBlockConfig;

    // 淡入淡出动画
    let alpha = block.alpha;
    if (cfg.fadeIn && !block.hasTriggered && this.mode === "synthesia") {
      const enterProgress = Math.max(
        0,
        Math.min(1, block.y / (this.keyboardY * 0.3)),
      );
      alpha *= enterProgress;
    }
    if (cfg.fadeOut && block.hasEnded && this.mode === "synthesia") {
      const fadeProgress = Math.max(0, 1 - (block.y - this.keyboardY) / 100);
      alpha *= fadeProgress;
    }

    // 微妙阴影
    if (cfg.shadowEnabled && block.height > 4 && !this.degradeMode) {
      this.drawRoundedRect(
        g,
        block.x + 1,
        block.y + 2,
        block.width,
        block.height,
        this.cornerRadius,
      );
      g.fill({ color: 0x000000, alpha: 0.3 * alpha });
    }

    // 活跃音符柔和边缘发光
    // 直接绘制到主 graphics 上，避免每帧创建子 Graphics 导致内存泄漏
    const isActive =
      block.active ||
      (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded);
    if (cfg.activeGlow && isActive && block.height > 4 && !this.degradeMode) {
      const glowR = cfg.activeGlowRadius;
      // 内层光晕
      this.drawRoundedRect(
        g,
        block.x - glowR * 0.3,
        block.y - glowR * 0.3,
        block.width + glowR * 0.6,
        block.height + glowR * 0.6,
        this.cornerRadius + glowR * 0.3,
      );
      g.fill({ color: block.color, alpha: 0.15 * alpha });
      // 外层光晕
      this.drawRoundedRect(
        g,
        block.x - glowR * 0.6,
        block.y - glowR * 0.6,
        block.width + glowR * 1.2,
        block.height + glowR * 1.2,
        this.cornerRadius + glowR * 0.6,
      );
      g.fill({ color: block.color, alpha: 0.08 * alpha });
    }

    // 主体（多层渐变：高光 → 主色 → 暗部）—— 降级时退化为单色
    if (cfg.multiLayerGradient && block.height > 8 && !this.degradeMode) {
      this.drawMultiLayerBlock(g, block, alpha);
    } else if (cfg.gradientEnabled && block.height > 8) {
      const topColor = this.hexStringToNumber(cfg.gradientTopColor);
      const bottomColor = this.hexStringToNumber(cfg.gradientBottomColor);
      this.drawRoundedRect(
        g,
        block.x,
        block.y,
        block.width,
        block.height,
        this.cornerRadius,
      );
      g.fill({ color: topColor, alpha });
      const bandH = Math.min(block.height * 0.3, 12);
      g.rect(block.x, block.y + block.height - bandH, block.width, bandH);
      g.fill({ color: bottomColor, alpha: alpha * 0.35 });
    } else {
      this.drawRoundedRect(
        g,
        block.x,
        block.y,
        block.width,
        block.height,
        this.cornerRadius,
      );
      g.fill({ color: block.color, alpha });
    }

    // 程序化纹理叠加
    if (this.noteTextureConfig.preset !== "none" && block.height > 4) {
      this.drawBlockTexture(g, block, alpha);
    }

    // 顶部高光
    if (cfg.highlightEnabled && block.height > 8) {
      const highlightH = Math.min(3, block.height * 0.1);
      g.rect(block.x + 1, block.y + 1, block.width - 2, highlightH);
      g.fill({ color: 0xffffff, alpha: cfg.highlightOpacity * alpha * 0.5 });
    }

    // 自定义边框
    if (cfg.borderEnabled) {
      this.drawRoundedRect(
        g,
        block.x,
        block.y,
        block.width,
        block.height,
        this.cornerRadius,
      );
      g.stroke({
        color: this.hexStringToNumber(cfg.borderColor),
        alpha,
        width: cfg.borderWidth,
      });
    }

    // 已触发但未结束的块（正在响）的微妙提示边框
    if (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded) {
      this.drawRoundedRect(
        g,
        block.x,
        block.y,
        block.width,
        block.height,
        this.cornerRadius,
      );
      g.stroke({ color: 0xffffff, alpha: 0.6 * alpha, width: 1.5 });
    }
  }

  // ─── 多层渐变块（高光 → 主色 → 暗部） ───
  private drawMultiLayerBlock(
    g: PIXI.Graphics,
    block: NoteBlock,
    alpha: number,
  ) {
    const cfg = this.noteBlockConfig;
    const mainColor = block.color;
    const topColor = this.hexStringToNumber(cfg.gradientTopColor);
    const midColor = this.hexStringToNumber(cfg.gradientMidColor);
    const bottomColor = this.hexStringToNumber(cfg.gradientBottomColor);

    // 主体填充（主色）
    this.drawRoundedRect(
      g,
      block.x,
      block.y,
      block.width,
      block.height,
      this.cornerRadius,
    );
    g.fill({ color: mainColor, alpha });

    // 顶部高光层（渐变上 1/3）
    const topH = block.height * 0.35;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = this.blendColor(topColor, midColor, t);
      g.rect(
        block.x + 1,
        block.y + t * topH,
        block.width - 2,
        topH / steps + 1,
      );
      g.fill({ color, alpha: alpha * 0.4 * (1 - t) });
    }

    // 底部暗部层（渐变下 1/3）
    const bottomH = block.height * 0.35;
    const bottomY = block.y + block.height - bottomH;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = this.blendColor(midColor, bottomColor, t);
      g.rect(
        block.x + 1,
        bottomY + t * bottomH,
        block.width - 2,
        bottomH / steps + 1,
      );
      g.fill({ color, alpha: alpha * 0.3 * t });
    }

    // 中间高光带（极细的亮线，模拟反光）
    if (block.height > 20) {
      const midY = block.y + block.height * 0.4;
      g.rect(block.x + 1, midY, block.width - 2, 1);
      g.fill({ color: 0xffffff, alpha: alpha * 0.15 });
    }
  }

  private blendColor(c1: number, c2: number, t: number): number {
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }

  private drawRoundedRect(
    g: PIXI.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    r = Math.min(r, w / 2, h / 2);
    if (r < 1) {
      g.rect(x, y, w, h);
    } else {
      g.roundRect(x, y, w, h, r);
    }
  }

  // ─── 程序化纹理绘制 ───
  private drawBlockTexture(g: PIXI.Graphics, block: NoteBlock, alpha: number) {
    const cfg = this.noteTextureConfig;
    const intensity = cfg.intensity * alpha;
    const scale = cfg.scale;
    const x = block.x;
    const y = block.y;
    const w = block.width;
    const h = block.height;

    switch (cfg.preset) {
      case "noise": {
        const step = Math.max(3, 6 / scale);
        for (let py = y; py < y + h; py += step) {
          for (let px = x; px < x + w; px += step) {
            if (Math.random() < 0.4) {
              const bright = Math.random() < 0.5;
              g.rect(px, py, step * 0.6, step * 0.6);
              g.fill({
                color: bright ? 0xffffff : 0x000000,
                alpha: intensity * (0.1 + Math.random() * 0.15),
              });
            }
          }
        }
        break;
      }
      case "stripes": {
        const spacing = Math.max(4, 8 / scale);
        const stripeW = Math.max(1, 2 / scale);
        for (let i = -h; i < w + h; i += spacing) {
          const sx = x + i;
          const sy = y;
          g.moveTo(sx, sy);
          g.lineTo(sx + h, sy + h);
          g.lineTo(sx + h + stripeW, sy + h);
          g.lineTo(sx + stripeW, sy);
          g.closePath();
          g.fill({ color: 0xffffff, alpha: intensity * 0.15 });
        }
        break;
      }
      case "dots": {
        const spacing = Math.max(5, 10 / scale);
        const dotR = Math.max(0.8, 1.5 / scale);
        for (let py = y + spacing / 2; py < y + h; py += spacing) {
          for (let px = x + spacing / 2; px < x + w; px += spacing) {
            g.circle(px, py, dotR);
            g.fill({ color: 0xffffff, alpha: intensity * 0.2 });
          }
        }
        break;
      }
      case "glow": {
        const bandH = Math.min(h * 0.4, 8);
        const bandY = y + (h - bandH) / 2;
        g.rect(x + 1, bandY, w - 2, bandH);
        g.fill({ color: 0xffffff, alpha: intensity * 0.25 });
        break;
      }
      case "metallic": {
        const spacing = Math.max(3, 5 / scale);
        for (let py = y + spacing; py < y + h; py += spacing) {
          g.rect(x + 1, py, w - 2, 1);
          g.fill({
            color: py % (spacing * 2) < spacing ? 0xffffff : 0x000000,
            alpha: intensity * 0.1,
          });
        }
        break;
      }
    }
  }

  // ─── 音名标签 ───
  private updateNameLabel(block: NoteBlock) {
    if (!this.showNoteNames) {
      if (block.nameSprite) {
        this.nameLayer.removeChild(block.nameSprite);
        block.nameSprite.destroy();
        block.nameSprite = null;
      }
      return;
    }

    // 块高不足时隐藏音名
    if (block.height < TEXT_HEIGHT * 2) {
      if (block.nameSprite) {
        block.nameSprite.visible = false;
      }
      return;
    }

    // 创建或更新音名标签
    if (!block.nameSprite) {
      const name = noteToName(block.midi);
      const textColor = this.getContrastColor(block.color);
      block.nameSprite = new PIXI.Text({
        text: name,
        style: {
          fontFamily: "SF Mono, Menlo, monospace",
          fontSize: Math.min(12, block.width * 0.5),
          fill: textColor,
          align: "center",
          dropShadow: {
            color: 0x000000,
            alpha: 0.6,
            angle: Math.PI / 2,
            distance: 1,
            blur: 1,
          },
        },
      });
      block.nameSprite.anchor.set(0.5, 0.5);
      block.nameSprite.resolution = 2;
      this.nameLayer.addChild(block.nameSprite);
    }

    block.nameSprite.visible = true;
    block.nameSprite.x = block.x + block.width / 2;
    block.nameSprite.y = block.y + block.height / 2;
    block.nameSprite.alpha = block.alpha;
  }

  // 计算与块颜色对比度足够的文字颜色（黑或白）
  private getContrastColor(bgColor: number): number {
    const r = (bgColor >> 16) & 0xff;
    const g = (bgColor >> 8) & 0xff;
    const b = bgColor & 0xff;
    // 相对亮度（简化）
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 0x000000 : 0xffffff;
  }

  // ─── 清理 ───
  clear() {
    for (const block of this.blocks) {
      if (block.nameSprite) {
        block.nameSprite.destroy();
      }
    }
    this.blocks = [];
    this.particleSystem.clear();
    // 移除并销毁所有子节点（防止历史遗留的 glowG 子节点泄漏）
    const children = this.graphics.removeChildren();
    for (const child of children) child.destroy();
    this.graphics.clear();
    this.trailGraphics.clear();
    this.hitLineGraphics.clear();
    this.nameLayer.removeChildren();
  }

  clearBlocksOnly() {
    for (const block of this.blocks) {
      if (block.nameSprite) {
        this.nameLayer.removeChild(block.nameSprite);
        block.nameSprite.destroy();
      }
    }
    this.blocks = [];
    this.graphics.clear();
  }

  getBlockCount(): number {
    return this.blocks.length;
  }

  getActiveBlockCount(): number {
    return this.blocks.filter(
      (b) =>
        b.active ||
        (this.mode === "synthesia" && b.hasTriggered && !b.hasEnded),
    ).length;
  }

  destroy() {
    this.clear();
    this.particleSystem.destroy();
    // 销毁 Graphics 对象本身
    this.graphics.destroy();
    this.trailGraphics.destroy();
    this.hitLineGraphics.destroy();
    this.nameLayer.destroy({ children: true });
  }
}
