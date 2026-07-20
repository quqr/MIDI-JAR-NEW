/**
 * 通用音符事件游标调度器
 *
 * 将 MidiFilePlayer / Recorder 中重复的 O(n) 全量扫描 tick() 逻辑
 * 收敛为 O(1) 摊还/帧的游标推进，并统一 seek / reset 语义。
 */

/** 可调度音符的最小接口，EventScheduler 不关心具体字段 */
export interface SchedulableNote {
  time: number;
  duration: number;
}

/** 游标调度回调 */
export interface SchedulerCallbacks<N extends SchedulableNote> {
  onTrigger: (note: N, index: number) => void;
  onRelease: (note: N, index: number) => void;
}

/**
 * 按结束时间排序的辅助条目，用于 noteOff 游标
 */
interface EndEntry {
  end: number;
  noteIndex: number;
}

/**
 * 游标调度器
 *
 * 设计要点：
 * - notes 按 time 升序（由调用方保证）
 * - byEnd 按 end=time+duration 升序（构造时排序）
 * - tick() 用两个 while 循环推进游标，O(1) 摊还
 * - seek() 用二分定位游标，O(log n)
 */
export class EventScheduler<N extends SchedulableNote> {
  private notes: N[] = [];
  private byEnd: EndEntry[] = [];
  private noteOnCursor = 0;
  private noteOffCursor = 0;
  private callbacks: SchedulerCallbacks<N>;

  constructor(callbacks: SchedulerCallbacks<N>) {
    this.callbacks = callbacks;
  }

  /** 设置/替换音符列表，重置游标 */
  setNotes(notes: N[]): void {
    this.notes = notes;
    this.byEnd = notes
      .map((n, i) => ({ end: n.time + n.duration, noteIndex: i }))
      .sort((a, b) => a.end - b.end);
    this.noteOnCursor = 0;
    this.noteOffCursor = 0;
  }

  /** 每帧调用，推进游标并触发回调 */
  tick(current: number): void {
    // noteOn：按 time 升序推进
    while (
      this.noteOnCursor < this.notes.length &&
      this.notes[this.noteOnCursor].time <= current
    ) {
      const idx = this.noteOnCursor++;
      this.callbacks.onTrigger(this.notes[idx], idx);
    }
    // noteOff：按 end 升序推进
    while (
      this.noteOffCursor < this.byEnd.length &&
      this.byEnd[this.noteOffCursor].end <= current
    ) {
      const entry = this.byEnd[this.noteOffCursor++];
      this.callbacks.onRelease(this.notes[entry.noteIndex], entry.noteIndex);
    }
  }

  /** seek/变速后二分定位游标 */
  seek(current: number): void {
    this.noteOnCursor = lowerBound(this.notes, current, (n) => n.time);
    this.noteOffCursor = lowerBound(this.byEnd, current, (e) => e.end);
  }

  /** 重置游标到起始 */
  reset(): void {
    this.noteOnCursor = 0;
    this.noteOffCursor = 0;
  }

  /** 当前 noteOn 游标位置（用于调试） */
  get onCursor(): number {
    return this.noteOnCursor;
  }

  /** 当前 noteOff 游标位置（用于调试） */
  get offCursor(): number {
    return this.noteOffCursor;
  }
}

/**
 * 二分查找下界：返回第一个使 getter(arr[i]) > target 的索引
 * 即所有 <= target 的元素数量
 */
function lowerBound<T>(
  arr: T[],
  target: number,
  getter: (item: T) => number,
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (getter(arr[mid]) <= target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
