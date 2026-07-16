import { logger } from "@/utils/logger";

export interface StorageOptions<T> {
  key: string;
  defaultValue: T;
  mergeWithDefault?: boolean;
}

/**
 * 从 localStorage 中读取并解析 JSON 数据
 * @param options - 存储选项
 * @param options.key - 存储键名
 * @param options.defaultValue - 读取失败或无数据时的默认返回值
 * @param options.mergeWithDefault - 是否将读取的数据与默认值合并（浅合并），适用于新增字段的向前兼容
 * @returns 读取到的数据或默认值
 */
export function loadFromStorage<T>({
  key,
  defaultValue,
  mergeWithDefault = false,
}: StorageOptions<T>): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as T;
      if (
        mergeWithDefault &&
        typeof defaultValue === "object" &&
        defaultValue !== null
      ) {
        return { ...defaultValue, ...parsed } as T;
      }
      return parsed;
    }
  } catch (e) {
    logger.warn(`Failed to load from storage (key: ${key}): ${e}`);
  }
  return defaultValue;
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    logger.warn(`Failed to save to storage (key: ${key}): ${e}`);
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    logger.warn(`Failed to remove from storage (key: ${key}): ${e}`);
  }
}
