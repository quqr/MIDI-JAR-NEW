/**
 * 共享的 debounce 工具函数
 * 统一的实现，支持前端和 Electron 主进程使用
 */

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  immediate?: boolean,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function debouncedFn(this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    }, wait);

    if (immediate && !timeout) {
      func.apply(this, args);
    }
  };
}

export default debounce;