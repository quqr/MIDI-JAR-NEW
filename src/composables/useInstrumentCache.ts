import { ref } from "vue";
import { createLogger } from "@/utils/logger";

const logger = createLogger("InstrumentCache");

/**
 * 音源缓存管理 composable
 *
 * 提供获取和清除单个音源缓存的功能。
 */
export function useInstrumentCache() {
  const isClearing = ref(false);

  /**
   * 获取单个音源的缓存大小（字节）
   *
   * 由于 CacheStorage 不支持按 URL 前缀直接计算大小，
   * 此函数遍历所有缓存条目，累加匹配音源 ID 的响应大小。
   *
   * @param instrumentId - 音源 ID（如 "acoustic_grand_piano"）
   * @returns 缓存大小（字节），失败时返回 0
   */
  async function getInstrumentCacheSize(instrumentId: string): Promise<number> {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const name of cacheNames) {
        if (name.includes("midi-jar-sampler")) {
          const cache = await caches.open(name);
          const requests = await cache.keys();

          for (const req of requests) {
            // 匹配包含音源 ID 的 URL
            const url = req.url;
            if (
              url.includes(instrumentId) ||
              url.includes(encodeURIComponent(instrumentId))
            ) {
              const response = await cache.match(req);
              if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
              }
            }
          }
        }
      }

      return totalSize;
    } catch (err) {
      logger.warn("getInstrumentCacheSize error: %s", err);
      return 0;
    }
  }

  /**
   * 清除单个音源的缓存
   *
   * @param instrumentId - 音源 ID
   * @returns 是否成功清除
   */
  async function clearInstrumentCache(instrumentId: string): Promise<boolean> {
    isClearing.value = true;

    try {
      const cacheNames = await caches.keys();
      let cleared = false;

      for (const name of cacheNames) {
        if (name.includes("midi-jar-sampler")) {
          const cache = await caches.open(name);
          const requests = await cache.keys();

          for (const req of requests) {
            const url = req.url;
            if (
              url.includes(instrumentId) ||
              url.includes(encodeURIComponent(instrumentId))
            ) {
              await cache.delete(req);
              cleared = true;
            }
          }
        }
      }

      if (cleared) {
        logger.info("Cleared cache for instrument: %s", instrumentId);
      }

      return cleared;
    } catch (err) {
      logger.error("clearInstrumentCache error: %s", err);
      return false;
    } finally {
      isClearing.value = false;
    }
  }

  /**
   * 获取 localStorage 大小（字节）
   */
  function getLocalStorageSize(): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          total += key.length + value.length;
        }
      }
    }
    // 估算 UTF-16 编码，每个字符 2 字节
    return total * 2;
  }

  /**
   * 获取 CacheStorage 总大小（字节）
   */
  async function getCacheStorageSize(): Promise<number> {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();

        for (const req of requests) {
          const response = await cache.match(req);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (err) {
      logger.warn("getCacheStorageSize error: %s", err);
      return 0;
    }
  }

  /**
   * 清除全部缓存（localStorage + CacheStorage）
   */
  async function clearAllCaches(): Promise<{
    localStorage: boolean;
    cacheStorage: boolean;
  }> {
    const result = { localStorage: false, cacheStorage: false };

    // 清除 localStorage（保留关键设置）
    try {
      const keysToPreserve = ["midi-jar-settings", "midi-jar-theme"];
      const preserved: Record<string, string> = {};

      for (const key of keysToPreserve) {
        const value = localStorage.getItem(key);
        if (value) {
          preserved[key] = value;
        }
      }

      localStorage.clear();

      for (const [key, value] of Object.entries(preserved)) {
        localStorage.setItem(key, value);
      }

      result.localStorage = true;
    } catch (err) {
      logger.error("Failed to clear localStorage: %s", err);
    }

    // 清除 CacheStorage
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes("midi-jar")) {
          await caches.delete(name);
        }
      }
      result.cacheStorage = true;
    } catch (err) {
      logger.error("Failed to clear CacheStorage: %s", err);
    }

    logger.info(
      "Clear all caches: localStorage=%s, cacheStorage=%s",
      result.localStorage,
      result.cacheStorage,
    );

    return result;
  }

  return {
    isClearing,
    getInstrumentCacheSize,
    clearInstrumentCache,
    getLocalStorageSize,
    getCacheStorageSize,
    clearAllCaches,
  };
}
