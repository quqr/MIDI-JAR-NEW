import * as PIXI from "pixi.js";
import { isBlackKey } from "./KeyboardRenderer";
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
  TexturePreset,
  NoteBlockParticleConfig,
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
  // 实时模式
  startTime: number;
  active: boolean;
  // Synthesia 模式
  hitTime: number; // 秒，底边到达命中线的时间
  endTime: number; // 秒，顶边到达命中线的时间
  hasTriggered: boolean; // 是否已触发 noteOn
  hasEnded: boolean; // 是否已触发 noteOff
  velocity: number;
  hand: "left" | "right" | "unknown";
  trackColor: number | null;
}

// ─── 拖尾粒子 ───
interface TrailParticle {
  x: number;
  y: number;
  size: number;
  color: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// ─── 命中爆炸粒子 ───
interface HitParticle {
  x: number;
  y: number;
  size: number;
  color: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// ─── 表面散发粒子 ───
interface SurfaceParticle {
  x: number;
  y: number;
  size: number;
  color: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// ─── 环绕粒子 ───
interface OrbitingParticle {
  angle: number;
  radius: number;
  size: number;
  color: number;
  alpha: number;
  speed: number;
  centerX: number;
  centerY: number;
  life: number;
  maxLife: number;
}

export interface NoteBlockCallbacks {
  onNoteTrigger?: (
    midi: number,
    velocity: number,
    hand: "left" | "right" | "unknown",
  ) => void;
  onNoteEnd?: (midi: number) => void;
}

export class NoteBlockSystem {
  private graphics: PIXI.Graphics;
  private trailGraphics: PIXI.Graphics;
  private hitLineGraphics: PIXI.Graphics;
  private blocks: NoteBlock[] = [];
  private trails: TrailParticle[] = [];
  private hitParticles: HitParticle[] = [];

  // 模式
  private mode: "realtime" | "synthesia" = "realtime";

  // 布局
  private keyboardY = 0;
  private canvasHeight = 0;
  private canvasWidth = 0;
  private keyWidth = 0;
  private blackKeyWidth = 0;

  // 速度
  private realtimeSpeed = 2; // 实时模式上升速度（像素/帧）
  private fallSpeed = 120; // Synthesia 模式下落速度（像素/秒）
  private lookAhead = 3; // 提前显示时间（秒）

  // 视觉配置
  private style: VisualStyle = "blocks";
  private colorScheme: ColorScheme = "pitch";
  private opacity = 0.9;
  private cornerRadius = 3;
  private particleShape: ParticleShape = "circle";
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
    highlightEnabled: true,
    highlightOpacity: 0.3,
    fadeIn: true,
    fadeOut: true,
  };

  // 拖尾粒子配置
  private trailParticleConfig: TrailParticleConfig = {
    size: 4,
    colorDecay: 0.5,
    spreadAngle: 30,
    lifetime: 30,
  };

  // 命中爆炸粒子配置
  private hitParticleConfig: HitParticleConfig = {
    count: 8,
    speed: 3,
    lifetime: 20,
  };

  // 粒子物理配置
  private physicsConfig: ParticlePhysicsConfig = {
    gravity: 0,
    windX: 0,
    windY: 0,
  };

  // 音符块纹理配置
  private noteTextureConfig: NoteTextureConfig = {
    preset: "none",
    scale: 1,
    intensity: 0.3,
  };

  // 音符块粒子配置
  private noteBlockParticleConfig: NoteBlockParticleConfig = {
    surfaceEmission: { enabled: false, rate: 0.3, speed: 1, lifetime: 20 },
    hitExplosion: { enabled: false, count: 12, speed: 4, lifetime: 25 },
    orbiting: { enabled: false, count: 4, radius: 10, speed: 2 },
  };

  // 新粒子数组
  private surfaceParticles: SurfaceParticle[] = [];
  private orbitingParticles: OrbitingParticle[] = [];

  // Synthesia 播放状态
  private transportTime = 0; // 当前播放时间（秒）
  private isTransportPlaying = false;

  private callbacks: NoteBlockCallbacks = {};

  constructor(container: PIXI.Container) {
    this.trailGraphics = new PIXI.Graphics();
    this.hitLineGraphics = new PIXI.Graphics();
    this.graphics = new PIXI.Graphics();
    container.addChild(this.trailGraphics);
    container.addChild(this.hitLineGraphics);
    container.addChild(this.graphics);
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
    // 下落速度 = 下落距离 / 提前显示时间
    const fallDistance = this.keyboardY;
    if (this.lookAhead > 0 && fallDistance > 0) {
      this.fallSpeed = fallDistance / this.lookAhead;
    }
  }

  // ─── 模式设置 ───
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
    this.particleShape = shape;
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

  setHitLineColor(color: string) {
    this.hitLineColor = this.hexStringToNumber(color);
    this.hitLineConfig.color = color;
  }

  setHitLineGlow(glow: boolean) {
    this.hitLineConfig.glow = glow;
  }

  setHitLineConfig(config: HitLineConfig) {
    this.hitLineConfig = config;
    this.hitLineColor = this.hexStringToNumber(config.color);
  }

  setNoteBlockConfig(config: NoteBlockConfig) {
    this.noteBlockConfig = config;
  }

  setTrailParticleConfig(config: TrailParticleConfig) {
    this.trailParticleConfig = config;
  }

  setHitParticleConfig(config: HitParticleConfig) {
    this.hitParticleConfig = config;
  }

  setPhysicsConfig(config: ParticlePhysicsConfig) {
    this.physicsConfig = config;
  }

  setNoteTextureConfig(config: NoteTextureConfig) {
    this.noteTextureConfig = config;
  }

  setNoteBlockParticleConfig(config: NoteBlockParticleConfig) {
    this.noteBlockParticleConfig = config;
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
      if (x < 0) continue; // 超出键盘范围
      const color = this.resolveColor(note.midi, note.hand, null);
      const blockHeight = Math.max(8, note.duration * this.fallSpeed);
      const w = isBlackKey(note.midi) ? this.blackKeyWidth : this.keyWidth;

      const block: NoteBlock = {
        midi: note.midi,
        x: x - w / 2,
        y: 0, // 初始位置，会在 update 中计算
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

  // ─── 主更新循环 ───
  update(delta: number, deltaSeconds: number) {
    this.graphics.clear();
    this.trailGraphics.clear();
    this.hitLineGraphics.clear();

    const now = performance.now();
    const toRemove: number[] = [];

    // 绘制命中线
    this.drawHitLine();

    // 更新音符块
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];

      if (this.mode === "realtime") {
        this.updateRealtimeBlock(block, now, delta);
      } else {
        this.updateSynthesiaBlock(block, deltaSeconds);
      }

      // 移除离开屏幕的块
      if (this.shouldRemove(block)) {
        toRemove.push(i);
        continue;
      }

      // 绘制
      if (this.style === "blocks" || this.style === "hybrid") {
        this.drawBlock(block);
      }

      // 表面散发粒子
      if (this.noteBlockParticleConfig.surfaceEmission.enabled) {
        const active = block.active || (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded);
        if (active && Math.random() < this.noteBlockParticleConfig.surfaceEmission.rate) {
          this.spawnSurfaceParticle(block);
        }
      }

      // 环绕粒子生成
      if (this.noteBlockParticleConfig.orbiting.enabled) {
        const active = block.active || (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded);
        if (active && this.orbitingParticles.length < 100) {
          this.spawnOrbitingParticles(block);
        }
      }
    }

    // 移除
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.blocks.splice(toRemove[i], 1);
    }

    // 更新粒子
    this.updateTrails(delta);
    this.updateHitParticles(delta);
    this.updateSurfaceParticles(delta);
    this.updateOrbitingParticles(delta);
  }

  // ─── 实时模式更新 ───
  private updateRealtimeBlock(block: NoteBlock, now: number, delta: number) {
    if (block.active) {
      // 按住时：底部固定在键盘位置，只向上生长
      const elapsed = now - block.startTime;
      block.height = Math.max(8, elapsed * this.realtimeSpeed * 0.04);
      block.y = this.keyboardY - block.height;
    } else {
      // 松开后：停止生长，整体向上漂移离开屏幕
      block.y -= this.realtimeSpeed * delta;
    }

    // 生成拖尾粒子
    if (
      this.trailEnabled &&
      block.active &&
      Math.random() < 0.3
    ) {
      this.spawnTrailParticle(block, -1); // -1 = 向上
    }
  }

  // ─── Synthesia 模式更新 ───
  private updateSynthesiaBlock(block: NoteBlock, _deltaSeconds: number) {
    if (!this.isTransportPlaying) return;

    // 音符底边在 hitTime 到达键盘（Synthesia 标准）
    const blockY =
      this.keyboardY - (block.hitTime - this.transportTime) * this.fallSpeed;
    block.y = blockY;

    // 检查是否应该触发 noteOn（底边到达命中线）
    if (!block.hasTriggered && this.transportTime >= block.hitTime) {
      block.hasTriggered = true;
      this.callbacks.onNoteTrigger?.(block.midi, block.velocity, block.hand);
      // 命中爆炸粒子（使用增强配置）
      if (this.noteBlockParticleConfig.hitExplosion.enabled) {
        this.spawnEnhancedHitParticles(block);
      } else if (this.style === "hybrid") {
        this.spawnHitParticles(block);
      }
    }

    // 检查是否应该触发 noteOff（顶边到达命中线）
    if (!block.hasEnded && this.transportTime >= block.endTime) {
      block.hasEnded = true;
      this.callbacks.onNoteEnd?.(block.midi);
    }

    // 生成拖尾粒子
    if (
      this.trailEnabled &&
      block.y > 0 &&
      block.y < this.keyboardY &&
      Math.random() < 0.2
    ) {
      this.spawnTrailParticle(block, 1); // 1 = 向下
    }
  }

  // ─── 移除判断 ───
  private shouldRemove(block: NoteBlock): boolean {
    if (this.mode === "realtime") {
      // 实时模式：块向上移动，离开屏幕顶部时移除
      return !block.active && block.y + block.height < 0;
    } else {
      // Synthesia 模式：块向下移动，完全过键盘后移除
      return block.hasEnded && block.y > this.canvasHeight;
    }
  }

  // ─── 绘制命中线 ───
  private drawHitLine() {
    const cfg = this.hitLineConfig;
    if (!cfg.visible) return;

    const g = this.hitLineGraphics;
    const y = this.keyboardY;
    const half = cfg.thickness / 2;

    // 发光效果
    if (cfg.glow) {
      const layers = Math.max(1, Math.ceil(cfg.glowRadius / 5));
      for (let i = layers; i > 0; i--) {
        const spread = (i / layers) * cfg.glowRadius;
        const alpha = 0.08 * cfg.glowIntensity * (i / layers);
        g.rect(0, y - half - spread, this.canvasWidth, cfg.thickness + spread * 2);
        g.fill({ color: this.hitLineColor, alpha });
      }
    }

    // 主线（支持不同样式）
    if (cfg.style === "dashed") {
      const dashLen = 12;
      const gapLen = 8;
      for (let x = 0; x < this.canvasWidth; x += dashLen + gapLen) {
        g.rect(x, y - half, Math.min(dashLen, this.canvasWidth - x), cfg.thickness);
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

  // ─── 绘制音符块 ───
  private drawBlock(block: NoteBlock) {
    const g = this.graphics;
    const cfg = this.noteBlockConfig;

    // 淡入淡出动画
    let alpha = block.alpha;
    if (cfg.fadeIn && !block.hasTriggered && this.mode === "synthesia") {
      // 从顶部进入时淡入
      const enterProgress = Math.max(0, Math.min(1, block.y / (this.keyboardY * 0.3)));
      alpha *= enterProgress;
    }
    if (cfg.fadeOut && block.hasEnded && this.mode === "synthesia") {
      // 结束后淡出
      const fadeProgress = Math.max(0, 1 - (block.y - this.keyboardY) / 100);
      alpha *= fadeProgress;
    }

    // 主体
    if (cfg.gradientEnabled && block.height > 8) {
      const topColor = this.hexStringToNumber(cfg.gradientTopColor);
      const bottomColor = this.hexStringToNumber(cfg.gradientBottomColor);
      this.drawRoundedRect(g, block.x, block.y, block.width, block.height, this.cornerRadius);
      g.fill({ color: topColor, alpha });
      const bandH = Math.min(block.height * 0.3, 12);
      g.rect(block.x, block.y + block.height - bandH, block.width, bandH);
      g.fill({ color: bottomColor, alpha: alpha * 0.35 });
    } else {
      this.drawRoundedRect(g, block.x, block.y, block.width, block.height, this.cornerRadius);
      g.fill({ color: block.color, alpha });
    }

    // 程序化纹理叠加
    if (this.noteTextureConfig.preset !== "none" && block.height > 4) {
      this.drawBlockTexture(g, block, alpha);
    }

    // 发光边缘（使用描边而非独立矩形，避免出现两个视觉层）
    if (block.active || (this.mode === "synthesia" && !block.hasTriggered)) {
      this.drawRoundedRect(g, block.x, block.y, block.width, block.height, this.cornerRadius);
      g.stroke({ color: block.color, alpha: 0.4 * alpha, width: 2 });
    }

    // 顶部高光
    if (cfg.highlightEnabled && block.height > 8) {
      const highlightH = Math.min(3, block.height * 0.1);
      g.rect(block.x + 1, block.y + 1, block.width - 2, highlightH);
      g.fill({ color: 0xffffff, alpha: cfg.highlightOpacity * alpha * 0.5 });
    }

    // 自定义边框
    if (cfg.borderEnabled) {
      this.drawRoundedRect(g, block.x, block.y, block.width, block.height, this.cornerRadius);
      g.stroke({ color: this.hexStringToNumber(cfg.borderColor), alpha, width: cfg.borderWidth });
    }

    // 已触发但未结束的块（当前正在响的音符）添加边框
    if (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded) {
      this.drawRoundedRect(g, block.x, block.y, block.width, block.height, this.cornerRadius);
      g.stroke({ color: 0xffffff, alpha: 0.8 * alpha, width: 2 });
    }
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
  private drawBlockTexture(
    g: PIXI.Graphics,
    block: NoteBlock,
    alpha: number,
  ) {
    const cfg = this.noteTextureConfig;
    const intensity = cfg.intensity * alpha;
    const scale = cfg.scale;
    const x = block.x;
    const y = block.y;
    const w = block.width;
    const h = block.height;

    switch (cfg.preset) {
      case "noise": {
        // 随机噪点
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
        // 对角线条纹
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
        // 网格圆点
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
        // 中心发光带
        const bandH = Math.min(h * 0.4, 8);
        const bandY = y + (h - bandH) / 2;
        g.rect(x + 1, bandY, w - 2, bandH);
        g.fill({ color: 0xffffff, alpha: intensity * 0.25 });
        break;
      }
      case "metallic": {
        // 水平金属线
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

  // ─── 拖尾粒子 ───
  private spawnTrailParticle(block: NoteBlock, direction: number) {
    const cfg = this.trailParticleConfig;
    const count = Math.ceil(this.density * 0.15);
    const spreadRad = (cfg.spreadAngle / 180) * Math.PI;

    for (let i = 0; i < count; i++) {
      const px = block.x + Math.random() * block.width;
      const py = direction < 0 ? block.y + block.height : block.y;

      // direction < 0 = 向上（实时模式），direction > 0 = 向下（Synthesia）
      const baseAngle = direction < 0 ? -Math.PI / 2 : Math.PI / 2;
      const spread = (Math.random() - 0.5) * spreadRad;
      const speed = 0.5 + Math.random() * 1.5;

      this.trails.push({
        x: px,
        y: py,
        size: cfg.size * (0.4 + Math.random() * 0.6),
        color: block.color,
        alpha: 0.7 + Math.random() * 0.3,
        vx: Math.cos(baseAngle + spread) * speed,
        vy: Math.sin(baseAngle + spread) * speed,
        life: 0,
        maxLife: cfg.lifetime + Math.random() * cfg.lifetime * 0.5,
      });
    }
  }

  private updateTrails(delta: number) {
    const g = this.trailGraphics;
    const toRemove: number[] = [];
    const cfg = this.trailParticleConfig;
    const phys = this.physicsConfig;

    for (let i = 0; i < this.trails.length; i++) {
      const p = this.trails[i];
      p.life += delta;
      // 应用物理效果
      p.vx += (phys.windX * 0.01) * delta;
      p.vy += (phys.gravity * 0.01 + phys.windY * 0.01) * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      const lifeRatio = p.life / p.maxLife;
      // 颜色衰减
      const colorAlpha = p.alpha * (1 - lifeRatio * cfg.colorDecay);
      const alpha = p.alpha * (1 - lifeRatio);
      const size = p.size * (1 - lifeRatio * 0.5);

      if (p.life >= p.maxLife || alpha < 0.01) {
        toRemove.push(i);
        continue;
      }

      this.drawParticle(g, p.x, p.y, size, p.color, alpha * colorAlpha);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.trails.splice(toRemove[i], 1);
    }
  }

  // ─── 命中爆炸粒子 ───
  private spawnHitParticles(block: NoteBlock) {
    const cfg = this.hitParticleConfig;
    const cx = block.x + block.width / 2;
    const cy = this.keyboardY;

    for (let i = 0; i < cfg.count; i++) {
      const angle = (i / cfg.count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = cfg.speed * (0.5 + Math.random());

      this.hitParticles.push({
        x: cx,
        y: cy,
        size: this.particleSize * (0.5 + Math.random() * 0.8),
        color: block.color,
        alpha: 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: cfg.lifetime + Math.random() * cfg.lifetime * 0.5,
      });
    }
  }

  private updateHitParticles(delta: number) {
    const g = this.trailGraphics;
    const toRemove: number[] = [];
    const phys = this.physicsConfig;

    for (let i = 0; i < this.hitParticles.length; i++) {
      const p = this.hitParticles[i];
      p.life += delta;
      // 应用物理效果
      p.vx += (phys.windX * 0.01) * delta;
      p.vy += (phys.gravity * 0.01 + phys.windY * 0.01) * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 0.05 * delta;

      const lifeRatio = p.life / p.maxLife;
      const alpha = p.alpha * (1 - lifeRatio);
      const size = p.size * (1 - lifeRatio * 0.3);

      if (p.life >= p.maxLife || alpha < 0.01) {
        toRemove.push(i);
        continue;
      }

      this.drawParticle(g, p.x, p.y, size, p.color, alpha);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.hitParticles.splice(toRemove[i], 1);
    }
  }

  // ─── 增强命中爆炸粒子 ───
  private spawnEnhancedHitParticles(block: NoteBlock) {
    const cfg = this.noteBlockParticleConfig.hitExplosion;
    const cx = block.x + block.width / 2;
    const cy = this.keyboardY;

    for (let i = 0; i < cfg.count; i++) {
      const angle = (i / cfg.count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = cfg.speed * (0.5 + Math.random());

      this.hitParticles.push({
        x: cx,
        y: cy,
        size: this.particleSize * (0.5 + Math.random() * 1.2),
        color: block.color,
        alpha: 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 0,
        maxLife: cfg.lifetime + Math.random() * cfg.lifetime * 0.5,
      });
    }
  }

  // ─── 表面散发粒子 ───
  private spawnSurfaceParticle(block: NoteBlock) {
    const cfg = this.noteBlockParticleConfig.surfaceEmission;
    const side = Math.random() < 0.5 ? -1 : 1;
    const px = side < 0 ? block.x : block.x + block.width;
    const py = block.y + Math.random() * block.height;

    const speed = cfg.speed * (0.3 + Math.random() * 0.7);
    const angle = side < 0 ? Math.PI + (Math.random() - 0.5) * 0.8 : (Math.random() - 0.5) * 0.8;

    this.surfaceParticles.push({
      x: px,
      y: py,
      size: 2 + Math.random() * 3,
      color: block.color,
      alpha: 0.6 + Math.random() * 0.4,
      vx: Math.cos(angle) * speed,
      vy: (Math.random() - 0.5) * speed * 0.5,
      life: 0,
      maxLife: cfg.lifetime + Math.random() * cfg.lifetime * 0.5,
    });
  }

  private updateSurfaceParticles(delta: number) {
    const g = this.trailGraphics;
    const toRemove: number[] = [];
    const phys = this.physicsConfig;

    for (let i = 0; i < this.surfaceParticles.length; i++) {
      const p = this.surfaceParticles[i];
      p.life += delta;
      p.vx += (phys.windX * 0.01) * delta;
      p.vy += (phys.gravity * 0.01 + phys.windY * 0.01) * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      const lifeRatio = p.life / p.maxLife;
      const alpha = p.alpha * (1 - lifeRatio);
      const size = p.size * (1 - lifeRatio * 0.5);

      if (p.life >= p.maxLife || alpha < 0.01) {
        toRemove.push(i);
        continue;
      }

      this.drawParticle(g, p.x, p.y, size, p.color, alpha);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.surfaceParticles.splice(toRemove[i], 1);
    }
  }

  // ─── 环绕粒子 ───
  private spawnOrbitingParticles(block: NoteBlock) {
    const cfg = this.noteBlockParticleConfig.orbiting;
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    const existingForBlock = this.orbitingParticles.filter(
      (p) => Math.abs(p.centerX - cx) < 1 && Math.abs(p.centerY - cy) < 1,
    ).length;

    if (existingForBlock >= cfg.count) return;

    for (let i = existingForBlock; i < cfg.count; i++) {
      this.orbitingParticles.push({
        angle: (i / cfg.count) * Math.PI * 2,
        radius: cfg.radius * (0.5 + Math.random() * 0.5),
        size: 2 + Math.random() * 2,
        color: block.color,
        alpha: 0.7 + Math.random() * 0.3,
        speed: cfg.speed * (0.5 + Math.random() * 0.5),
        centerX: cx,
        centerY: cy,
        life: 0,
        maxLife: 60 + Math.random() * 30,
      });
    }
  }

  private updateOrbitingParticles(delta: number) {
    const g = this.trailGraphics;
    const toRemove: number[] = [];

    for (let i = 0; i < this.orbitingParticles.length; i++) {
      const p = this.orbitingParticles[i];
      p.life += delta;
      p.angle += p.speed * 0.02 * delta;

      const lifeRatio = p.life / p.maxLife;
      const alpha = p.alpha * (1 - lifeRatio);

      if (p.life >= p.maxLife || alpha < 0.01) {
        toRemove.push(i);
        continue;
      }

      const x = p.centerX + Math.cos(p.angle) * p.radius;
      const y = p.centerY + Math.sin(p.angle) * p.radius;
      this.drawParticle(g, x, y, p.size, p.color, alpha);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.orbitingParticles.splice(toRemove[i], 1);
    }
  }

  // ─── 根据形状绘制粒子 ───
  private drawParticle(
    g: PIXI.Graphics,
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number,
  ) {
    switch (this.particleShape) {
      case "circle":
        g.circle(x, y, size);
        g.fill({ color, alpha });
        break;
      case "square":
        g.rect(x - size, y - size, size * 2, size * 2);
        g.fill({ color, alpha });
        break;
      case "note":
        // 简化音符形状：圆 + 竖线
        g.circle(x, y, size);
        g.fill({ color, alpha });
        g.rect(x + size * 0.8, y - size * 2, 1, size * 2);
        g.fill({ color, alpha });
        break;
      case "star":
        // 简化星形：用圆代替（性能更好）
        g.circle(x, y, size);
        g.fill({ color, alpha });
        break;
    }
  }

  // ─── 清理 ───
  clear() {
    this.blocks = [];
    this.trails = [];
    this.hitParticles = [];
    this.surfaceParticles = [];
    this.orbitingParticles = [];
    this.graphics.clear();
    this.trailGraphics.clear();
    this.hitLineGraphics.clear();
  }

  clearBlocksOnly() {
    this.blocks = [];
    this.graphics.clear();
  }

  getBlockCount(): number {
    return this.blocks.length;
  }
}
