import { logger } from "@/utils/logger";

export interface StorageOptions<T> {
  key: string;
  defaultValue: T;
  mergeWithDefault?: boolean;
}

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
