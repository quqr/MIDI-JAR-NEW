import * as PIXI from "pixi.js";
import type {
  VisualStyle,
  ColorScheme,
  ParticleShape,
  ScheduledNote,
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

export interface NoteBlockCallbacks {
  onNoteTrigger?: (midi: number, velocity: number, hand: "left" | "right" | "unknown") => void;
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

  // 命中线
  private hitLineColor = 0xffffff;
  private hitLineGlow = true;

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
  }

  setHitLineGlow(glow: boolean) {
    this.hitLineGlow = glow;
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
    const block: NoteBlock = {
      midi,
      x: x - this.keyWidth / 2,
      y: this.keyboardY,
      width: Math.max(4, this.keyWidth - 2),
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

      const block: NoteBlock = {
        midi: note.midi,
        x: x - this.keyWidth / 2,
        y: 0, // 初始位置，会在 update 中计算
        width: Math.max(4, this.keyWidth - 2),
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
    }

    // 移除
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.blocks.splice(toRemove[i], 1);
    }

    // 更新粒子
    this.updateTrails(delta);
    this.updateHitParticles(delta);
  }

  // ─── 实时模式更新 ───
  private updateRealtimeBlock(block: NoteBlock, now: number, delta: number) {
    if (block.active) {
      const elapsed = now - block.startTime;
      block.height = Math.max(8, elapsed * this.realtimeSpeed * 0.04);
    }
    // 向上移动
    block.y -= this.realtimeSpeed * delta;

    // 生成拖尾粒子
    if (
      this.trailEnabled &&
      (this.style === "particles" || this.style === "hybrid") &&
      block.active &&
      Math.random() < 0.3
    ) {
      this.spawnTrailParticle(block, -1); // -1 = 向上
    }
  }

  // ─── Synthesia 模式更新 ───
  private updateSynthesiaBlock(block: NoteBlock, _deltaSeconds: number) {
    if (!this.isTransportPlaying) return;

    const blockY = this.keyboardY - (block.endTime - this.transportTime) * this.fallSpeed;
    block.y = blockY;

    // 检查是否应该触发 noteOn（底边到达命中线）
    if (!block.hasTriggered && this.transportTime >= block.hitTime) {
      block.hasTriggered = true;
      this.callbacks.onNoteTrigger?.(block.midi, block.velocity, block.hand);
      // 命中爆炸粒子
      if (this.style === "hybrid") {
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
      (this.style === "particles" || this.style === "hybrid") &&
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
    const g = this.hitLineGraphics;
    const y = this.keyboardY;

    // 发光效果
    if (this.hitLineGlow) {
      for (let i = 3; i > 0; i--) {
        g.rect(0, y - i * 2, this.canvasWidth, i * 4);
        g.fill({ color: this.hitLineColor, alpha: 0.05 * i });
      }
    }

    // 主线
    g.rect(0, y - 1, this.canvasWidth, 2);
    g.fill({ color: this.hitLineColor, alpha: 0.6 });
  }

  // ─── 绘制音符块 ───
  private drawBlock(block: NoteBlock) {
    const g = this.graphics;

    // 活跃音符的发光
    if (block.active || (this.mode === "synthesia" && !block.hasTriggered)) {
      const glowSize = 3;
      g.rect(
        block.x - glowSize,
        block.y - glowSize,
        block.width + glowSize * 2,
        block.height + glowSize * 2,
      );
      g.fill({ color: block.color, alpha: 0.2 });
    }

    // 主体
    this.drawRoundedRect(
      g,
      block.x,
      block.y,
      block.width,
      block.height,
      this.cornerRadius,
    );
    g.fill({ color: block.color, alpha: block.alpha });

    // 顶部高光
    if (block.height > 8) {
      const highlightH = Math.min(4, block.height * 0.15);
      g.rect(block.x + 1, block.y + 1, block.width - 2, highlightH);
      g.fill({ color: 0xffffff, alpha: 0.2 });
    }

    // 已触发但未结束的块（当前正在响的音符）添加边框
    if (this.mode === "synthesia" && block.hasTriggered && !block.hasEnded) {
      this.drawRoundedRect(
        g,
        block.x,
        block.y,
        block.width,
        block.height,
        this.cornerRadius,
      );
      g.stroke({ color: 0xffffff, alpha: 0.8, width: 2 });
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

  // ─── 拖尾粒子 ───
  private spawnTrailParticle(block: NoteBlock, direction: number) {
    const count = Math.ceil(this.density * 0.15);
    for (let i = 0; i < count; i++) {
      const px = block.x + Math.random() * block.width;
      const py = direction < 0 ? block.y + block.height : block.y;

      const angle = direction < 0 ? Math.PI / 2 : -Math.PI / 2;
      const spread = (Math.random() - 0.5) * 1.2;
      const speed = 0.5 + Math.random() * 1.5;

      this.trails.push({
        x: px,
        y: py,
        size: this.particleSize * (0.4 + Math.random() * 0.6),
        color: block.color,
        alpha: 0.7 + Math.random() * 0.3,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: 0,
        maxLife: 20 + Math.random() * 30,
      });
    }
  }

  private updateTrails(delta: number) {
    const g = this.trailGraphics;
    const toRemove: number[] = [];

    for (let i = 0; i < this.trails.length; i++) {
      const p = this.trails[i];
      p.life += delta;
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
      this.trails.splice(toRemove[i], 1);
    }
  }

  // ─── 命中爆炸粒子 ───
  private spawnHitParticles(block: NoteBlock) {
    const count = 12;
    const cx = block.x + block.width / 2;
    const cy = this.keyboardY;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 1 + Math.random() * 3;

      this.hitParticles.push({
        x: cx,
        y: cy,
        size: this.particleSize * (0.5 + Math.random() * 0.8),
        color: block.color,
        alpha: 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 25 + Math.random() * 20,
      });
    }
  }

  private updateHitParticles(delta: number) {
    const g = this.trailGraphics;
    const toRemove: number[] = [];

    for (let i = 0; i < this.hitParticles.length; i++) {
      const p = this.hitParticles[i];
      p.life += delta;
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
