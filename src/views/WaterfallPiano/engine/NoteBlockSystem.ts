import { Container } from "pixi.js";
import type { AuraConfig, ParticleConfig, ScheduledNote } from "../types";
import type { KeyboardRenderer } from "./KeyboardRenderer";
import { NoteBlockPool, type NoteBlock } from "./NoteBlockPool";
import { RealtimeModeController } from "./RealtimeModeController";
import { SynthesiaModeController } from "./SynthesiaModeController";
import {
  NoteBlockRenderer,
  isBlackKey,
  BLACK_KEY_WIDTH_RATIO,
} from "./NoteBlockRenderer";
import { NoteBlockStateSync } from "./NoteBlockStateSync";
import { Event } from "@/utils/delegate";

/** note block 的渲染模式：realtime 为实时下落，synthesia 为跟随传输时间线滚动 */
export type NoteBlockMode = "realtime" | "synthesia";

/**
 * 瀑布式钢琴的 note block 管理系统（Facade）
 *
 * 协调 NoteBlockPool / RealtimeModeController / SynthesiaModeController /
 * NoteBlockRenderer / NoteBlockStateSync 五个子模块，对外保持原本的公共 API
 * 不变。子模块通过构造期注入的回调获取共享状态（active 数组、settings 等），
 * Facade 负责生命周期管理与跨模块协调。
 */
export class NoteBlockSystem {
  private particleConfig: ParticleConfig | null = null;
  private auraConfig: AuraConfig | null = null;
  private keyboardRenderer: KeyboardRenderer | null = null;
  private width = 0;
  private height = 0;
  private mode: NoteBlockMode = "realtime";
  private active: NoteBlock[] = [];
  private pool = new NoteBlockPool();
  private realtime: RealtimeModeController;
  private synthesia: SynthesiaModeController;
  private renderer: NoteBlockRenderer;
  private stateSync: NoteBlockStateSync;
  readonly onNoteTrigger = new Event<{
    midi: number;
    velocity: number;
    hand?: string;
  }>();
  readonly onNoteEnd = new Event<{ midi: number }>();
  /** 预分配的 block positions 缓冲区，避免每帧 new Array + new Object */
  private _blockPosBuffer: Array<{
    midi: number;
    normX: number;
    normY: number;
    blockWidth: number;
    blockHeight: number;
  }> = [];

  constructor() {
    this.realtime = new RealtimeModeController(
      this.pool,
      () => this.active,
      () => this.height,
      () => this.pixelsPerSecond(),
    );
    this.synthesia = new SynthesiaModeController(
      this.pool,
      () => this.active,
      this.realtime,
      () => this.height,
      () => this.particleConfig,
      () => this.mode,
      this.onNoteTrigger,
      this.onNoteEnd,
      (note) => this.noteKey(note),
    );
    this.renderer = new NoteBlockRenderer(
      () => this.particleConfig,
      () => this.auraConfig,
      () => this.keyboardRenderer,
      () => this.width,
      () => this.height,
      () => this.active,
      () => this.realtime.getTriggeredSet(),
    );
    this.stateSync = new NoteBlockStateSync(
      this.pool,
      () => this.active,
      this.synthesia,
      () => this.height,
      () => this.particleConfig,
      () => this.mode,
      () => this.pixelsPerSecond(),
      (note) => this.noteKey(note),
    );
  }

  /**
   * 初始化容器和配置
   * @param container - 用于渲染 note block 的 PixiJS Container
   * @param particleConfig - 音符方块渲染配置
   * @param auraConfig - 发光效果配置
   */
  init(
    container: Container,
    particleConfig: ParticleConfig,
    auraConfig: AuraConfig,
  ): void {
    if (!container) return;
    this.particleConfig = particleConfig;
    this.auraConfig = auraConfig;
    this.renderer.init(container);
  }

  /**
   * 调整尺寸
   * @param width - 逻辑宽度
   * @param height - 逻辑高度
   * @param _dpr - 设备像素比（PixiJS 自动处理，保留参数兼容）
   * @param keyboardRenderer - 键盘渲染器，用于计算方块水平位置
   */
  resize(
    width: number,
    height: number,
    _dpr: number,
    keyboardRenderer: KeyboardRenderer,
  ): void {
    this.width = width;
    this.height = height;
    this.keyboardRenderer = keyboardRenderer;
  }

  setMode(mode: NoteBlockMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.clearNoteBlocks();
  }

  getMode(): NoteBlockMode {
    return this.mode;
  }

  clearNoteBlocks(): void {
    const active = this.active;
    for (const b of active) this.pool.release(b);
    active.length = 0;
    this.realtime.reset();
    this.synthesia.resetSequence();
    this.synthesia.clearVisualState();
    this.synthesia.clearTriggeredAndEndedKeys();
  }

  /** 清空视觉方块但保留触发/结束追踪状态（用于模式切换） */
  clearVisualBlocks(): void {
    const active = this.active;
    for (const b of active) this.pool.release(b);
    active.length = 0;
    this.realtime.clearVisualState();
    this.synthesia.clearVisualState();
    // 保留: triggeredNoteKeys / endedNoteKeys / activeMidiCount / triggeredSet / synthesiaNotes / synthesiaCursor
  }

  setParticleConfig(config: ParticleConfig): void {
    this.particleConfig = config;
  }

  setAuraConfig(config: AuraConfig): void {
    this.auraConfig = config;
  }

  /** 载入 synthesia 模式待播放的音符序列，并重置内部状态 */
  scheduleSynthesiaNotes(notes: ScheduledNote[]): void {
    this.synthesia.scheduleSynthesiaNotes(notes);
  }

  setTransportTime(t: number): void {
    this.synthesia.setTransportTime(t);
  }

  setTransportPlaying(playing: boolean): void {
    this.synthesia.setTransportPlaying(playing);
  }

  /** 清空所有活跃的 synthesia 方块并重置内部状态（用于停止播放） */
  clearBlocks(): void {
    const active = this.active;
    for (let i = active.length - 1; i >= 0; i--) {
      this.pool.release(active[i]);
    }
    active.length = 0;
    this.synthesia.clearVisualState();
    this.synthesia.clearTriggeredAndEndedKeys();
    this.synthesia.clearTransportState();
  }

  /** 在 synthesia 模式下标记某个 MIDI 音符已被按下 */
  triggerSynthesiaNote(midi: number, _velocity: number): void {
    this.synthesia.triggerSynthesiaNote(midi, _velocity);
  }

  /** 在 synthesia 模式下取消某个 MIDI 音符的按下标记 */
  releaseSynthesiaNote(midi: number): void {
    this.synthesia.releaseSynthesiaNote(midi);
  }

  /** 获取当前活跃（已触发但未结束）的 MIDI 音符列表 */
  getActiveMidiNotes(): number[] {
    return this.realtime.getActiveMidiNotes();
  }

  /** 获取活跃音符块的中心位置（归一化坐标），用于方块覆盖流体发射。
   *  复用内部缓冲区，调用方读取后不应持有引用（下一帧会覆写）。 */
  getActiveBlockPositions(
    keyboardRenderer: KeyboardRenderer,
    totalHeight: number,
  ): ReadonlyArray<{
    midi: number;
    normX: number;
    normY: number;
    blockWidth: number;
    blockHeight: number;
  }> {
    const result = this._blockPosBuffer;
    result.length = 0; // 复用数组，清空但保留容量
    const whiteKeyWidth = keyboardRenderer.getWhiteKeyWidth();
    const blackKeyWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    for (const b of this.active) {
      if (!b.triggered || b.ended) continue;
      const isBlack = isBlackKey(b.midi);
      const blockWidth = isBlack ? blackKeyWidth * 0.9 : whiteKeyWidth * 0.85;
      const blockHeight = b.height <= 0 ? blockWidth : b.height;
      const normX = keyboardRenderer.midiToX(b.midi) / this.width;
      const normY = 1 - b.y / totalHeight;
      result.push({
        midi: b.midi,
        normX,
        normY: Math.max(0, Math.min(1, normY)),
        blockWidth,
        blockHeight,
      });
    }
    return result;
  }

  /** 在 realtime 模式下为按下的 MIDI 音符创建一个从底部向上生长的 note block */
  playRealtimeNote(midi: number, velocity: number): void {
    this.realtime.playRealtimeNote(midi, velocity);
  }

  /** 在 realtime 模式下标记 note block 为释放状态，方块将开始向上滑出屏幕 */
  releaseRealtimeNote(midi: number): void {
    this.realtime.releaseRealtimeNote(midi);
  }

  /** MIDI 驱动的 realtime 方块创建（引用计数，支持同音高重叠） */
  playRealtimeNoteFromMidi(midi: number, velocity: number): void {
    this.realtime.playRealtimeNoteFromMidi(midi, velocity);
  }

  /** MIDI 驱动的 realtime 方块释放（引用计数，归零时才真正释放） */
  releaseRealtimeNoteFromMidi(midi: number): void {
    this.realtime.releaseRealtimeNoteFromMidi(midi);
  }

  /**
   * 每帧更新所有活跃 note block 的位置和状态
   * @param deltaTime - 距上一帧的时间间隔（秒）
   */
  update(deltaTime: number): void {
    if (!this.particleConfig) return;
    const pps = this.pixelsPerSecond();
    const dt = Math.min(deltaTime, 0.1);

    if (this.synthesia.isTransportPlaying()) {
      this.synthesia.update(pps);
    }

    if (this.mode === "realtime") {
      this.realtime.updateBlocks(pps, dt);
    }
  }

  render(): void {
    this.renderer.render();
  }

  /** 渲染 FPS 叠加层 */
  renderFPS(fps: number): void {
    this.renderer.renderFPS(fps);
  }

  getActiveBlockCount(): number {
    return this.active.length;
  }

  getPoolSize(): number {
    return this.pool.getPoolSize();
  }

  /**
   * 完整状态同步：根据给定时间重建所有方块的 Y 坐标、触发状态、结束状态和活跃状态
   * 用于暂停恢复后确保方块显示与当前播放进度一致，避免视觉撕裂
   * @param time - 当前播放时间（秒）
   */
  syncToTime(time: number): void {
    this.stateSync.syncToTime(time);
  }

  dispose(): void {
    this.clearNoteBlocks();
    this.pool.clear();
    this.renderer.dispose();
  }

  /** 根据配置中的速度参数计算每秒下落像素数 */
  private pixelsPerSecond(): number {
    if (!this.particleConfig) return 200;
    return this.particleConfig.speed * 100;
  }

  /** 根据音符的轨道、MIDI 编号和起始时间生成唯一标识键（优先使用预计算缓存） */
  private noteKey(note: {
    trackIndex: number;
    midi: number;
    time: number;
    key?: string;
  }): string {
    return note.key ?? `${note.trackIndex}-${note.midi}-${note.time}`;
  }
}
