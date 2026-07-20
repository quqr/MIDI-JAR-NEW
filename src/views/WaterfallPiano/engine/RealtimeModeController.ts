import type { NoteBlock, NoteBlockPool } from "./NoteBlockPool";

/**
 * Realtime 模式控制器：管理实时按下的 MIDI 音符对应的 note block，
 * 以及跨模式共享的 triggeredSet / activeMidiCount 引用计数。
 *
 * 注意：triggeredSet 和 activeMidiCount 在 synthesia 模式下也会被
 * SynthesiaModeController 通过 addActiveMidi/removeActiveMidi 间接修改，
 * 因此本控制器同时承担"已触发音符集合"的统一管理职责。
 */
export class RealtimeModeController {
  private realtimeHeld = new Map<number, NoteBlock>();
  /** MIDI 驱动的 realtime 方块引用计数（支持同音高重叠） */
  private realtimeRefCount = new Map<number, number>();
  /** 已触发音符集合（跨模式共享，渲染层用于高亮判断） */
  private triggeredSet = new Set<number>();
  /** MIDI 音符的引用计数，用于在多个同音高音符并发时正确清理 triggeredSet */
  private activeMidiCount = new Map<number, number>();

  constructor(
    private readonly pool: NoteBlockPool,
    private readonly getActive: () => NoteBlock[],
    private readonly getHeight: () => number,
    private readonly getPixelsPerSecond: () => number,
  ) {}

  /**
   * 在 realtime 模式下为按下的 MIDI 音符创建一个从底部向上生长的 note block
   * @param midi - MIDI 音符号
   * @param velocity - 力度值
   */
  playRealtimeNote(midi: number, velocity: number): void {
    if (this.realtimeHeld.has(midi)) return;
    const pps = this.getPixelsPerSecond();
    const block = this.pool.acquire();
    block.midi = midi;
    block.velocity = velocity;
    block.hand = "unknown";
    block.trackIndex = -1;
    block.startTime = 0;
    block.duration = 0;
    block.y = this.getHeight();
    block.height = Math.max(pps * 0.05, 4); // 立即显示一个小块
    block.triggered = true;
    block.ended = false;
    block.releasing = false;
    block.fadeTime = 0;
    block.active = true;
    this.getActive().push(block);
    this.realtimeHeld.set(midi, block);
  }

  /**
   * 在 realtime 模式下标记 note block 为释放状态，方块将开始向上滑出屏幕
   * @param midi - MIDI 音符号
   */
  releaseRealtimeNote(midi: number): void {
    const block = this.realtimeHeld.get(midi);
    if (!block) return;
    block.releasing = true;
    block.fadeTime = 0;
    this.realtimeHeld.delete(midi);
  }

  /** MIDI 驱动的 realtime 方块创建（引用计数，支持同音高重叠） */
  playRealtimeNoteFromMidi(midi: number, velocity: number): void {
    const count = this.realtimeRefCount.get(midi) ?? 0;
    this.realtimeRefCount.set(midi, count + 1);
    if (count === 0) this.playRealtimeNote(midi, velocity);
  }

  /** MIDI 驱动的 realtime 方块释放（引用计数，归零时才真正释放） */
  releaseRealtimeNoteFromMidi(midi: number): void {
    const count = this.realtimeRefCount.get(midi) ?? 0;
    if (count <= 1) {
      this.realtimeRefCount.delete(midi);
      this.releaseRealtimeNote(midi);
    } else {
      this.realtimeRefCount.set(midi, count - 1);
    }
  }

  /** 引用计数：将 MIDI 音符加入 triggeredSet */
  addActiveMidi(midi: number): void {
    const count = this.activeMidiCount.get(midi) ?? 0;
    this.activeMidiCount.set(midi, count + 1);
    this.triggeredSet.add(midi);
  }

  /** 引用计数：减少 MIDI 音符计数，归零时从 triggeredSet 移除 */
  removeActiveMidi(midi: number): void {
    const count = this.activeMidiCount.get(midi) ?? 0;
    if (count <= 1) {
      this.activeMidiCount.delete(midi);
      this.triggeredSet.delete(midi);
    } else {
      this.activeMidiCount.set(midi, count - 1);
    }
  }

  /**
   * 每帧更新 realtime 方块的位置和状态：
   * - releasing 方块向上滑动并淡出
   * - 非 releasing 方块高度增长
   * - 方块完全离开屏幕顶部时回收到对象池
   */
  updateBlocks(pps: number, dt: number): void {
    const active = this.getActive();
    for (let i = active.length - 1; i >= 0; i--) {
      const b = active[i];
      if (b.releasing) {
        b.y -= pps * dt;
        b.fadeTime += dt;
      } else {
        b.height += pps * dt;
      }
      // 方块底部离开屏幕顶部时移除
      if (b.releasing && b.y < 0) {
        active.splice(i, 1);
        this.pool.release(b);
      }
    }
  }

  /** 获取 triggeredSet 引用（供 Renderer 查询高亮状态） */
  getTriggeredSet(): Set<number> {
    return this.triggeredSet;
  }

  /** 获取当前活跃（已触发但未结束）的 MIDI 音符列表 */
  getActiveMidiNotes(): number[] {
    return Array.from(this.triggeredSet);
  }

  /** 获取 activeMidiCount 大小（用于日志诊断，与 triggeredSet.size 可能不同，
   *  因为 triggerSynthesiaNote/releaseSynthesiaNote 直接修改 triggeredSet 而不经引用计数） */
  getActiveMidiCountSize(): number {
    return this.activeMidiCount.size;
  }

  /** 清空 realtime 持有的视觉状态（保留 triggeredSet/activeMidiCount） */
  clearVisualState(): void {
    this.realtimeHeld.clear();
    this.realtimeRefCount.clear();
  }

  /** 清空触发状态（triggeredSet + activeMidiCount） */
  clearTriggeredState(): void {
    this.triggeredSet.clear();
    this.activeMidiCount.clear();
  }

  /** 完整重置 realtime 控制器状态 */
  reset(): void {
    this.realtimeHeld.clear();
    this.realtimeRefCount.clear();
    this.triggeredSet.clear();
    this.activeMidiCount.clear();
  }
}
