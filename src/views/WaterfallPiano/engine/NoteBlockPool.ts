/** note block 的内部数据结构 */
export interface NoteBlock {
  midi: number;
  velocity: number;
  hand: "left" | "right" | "unknown";
  trackIndex: number;
  startTime: number;
  duration: number;
  y: number;
  height: number;
  triggered: boolean;
  ended: boolean;
  releasing: boolean;
  fadeTime: number;
  active: boolean;
}

const POOL_MAX = 512;

/**
 * Note block 对象池：复用方块对象以减少 GC 压力
 */
export class NoteBlockPool {
  private pool: NoteBlock[] = [];

  /** 从对象池中获取一个 note block，池为空时创建新实例 */
  acquire(): NoteBlock {
    const pooled = this.pool.pop();
    if (pooled) {
      pooled.active = true;
      return pooled;
    }
    return {
      midi: 0,
      velocity: 0,
      hand: "unknown",
      trackIndex: -1,
      startTime: 0,
      duration: 0,
      y: 0,
      height: 0,
      triggered: false,
      ended: false,
      releasing: false,
      fadeTime: 0,
      active: false,
    };
  }

  /** 将 note block 回收到对象池，池满时丢弃 */
  release(b: NoteBlock): void {
    b.active = false;
    if (this.pool.length < POOL_MAX) {
      this.pool.push(b);
    }
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  /** 清空对象池（dispose 时调用） */
  clear(): void {
    this.pool = [];
  }
}
