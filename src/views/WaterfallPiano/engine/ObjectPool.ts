/**
 * Generic object pool to avoid frequent GC
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxCapacity: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize = 50,
    maxCapacity = 500,
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxCapacity = maxCapacity;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    const obj = this.pool.pop();
    return obj ?? this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    // 防止池无界增长：超过最大容量时丢弃对象，让 GC 回收
    if (this.pool.length < this.maxCapacity) {
      this.pool.push(obj);
    }
  }

  get available(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
  }
}
