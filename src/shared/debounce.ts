/**
 * 共享的 debounce 工具函数
 * 统一的实现，支持前端和 Electron 主进程使用
 */

export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  immediate?: boolean,
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = function debouncedFn(
    this: unknown,
    ...args: Parameters<T>
  ) {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    }, wait);

    if (immediate && !timeout) {
      func.apply(this, args);
    }
  } as DebouncedFunction<T>;

  debouncedFn.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debouncedFn;
}

export default debounce;
