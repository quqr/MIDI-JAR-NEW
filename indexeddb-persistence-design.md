# IndexedDB 持久化方案研究报告：采样器音色配置存储

> 研究时间：2026-07-21
> 研究版本：基于 smplr 1.0.0 和 IndexedDB API 规范
> 目标场景：MIDI-JAR-NEW 项目中的采样器音色配置持久化

---

## 目录

1. [数据结构设计](#1-数据结构设计)
2. [与 CacheStorage 配合](#2-与-cachestorage-配合)
3. [缓存策略](#3-缓存策略)
4. [版本管理](#4-版本管理)
5. [性能优化](#5-性能优化)
6. [错误处理](#6-错误处理)
7. [跨浏览器同步](#7-跨浏览器同步)
8. [隐私保护](#8-隐私保护)
9. [完整 TypeScript 实现](#9-完整-typescript-实现)

---

## 1. 数据结构设计

### 1.1 核心设计理念

IndexedDB 用于存储**音色配置的元数据和用户设置**，而 **CacheStorage 用于存储实际的音频采样数据**。这种分离遵循了 Web 平台的存储最佳实践：

- **IndexedDB**：结构化数据、事务支持、复杂查询
- **CacheStorage**：HTTP 请求/响应缓存、音频二进制数据

### 1.2 数据库 Schema 设计

#### 数据库命名

```
数据库名称: "midi-jar-sampler-config"
当前版本: 1
```

#### 对象存储（Object Stores）

##### Store 1: `instrumentPresets` - 音色预设配置

```typescript
interface InstrumentPreset {
  // 主键：预设唯一标识符
  id: string; // 例如: "piano-grand-steinway-v1"

  // 音色基本信息
  name: string; // 预设名称
  instrumentType: InstrumentType; // 音色类型：soundfont, drum-machine, sampler, etc.
  description?: string; // 描述

  // smplr 配置参数
  config: {
    // 音色特定配置
    instrument?: string; // Soundfont 乐器名
    kit?: string; // Soundfont 音色包
    volume: number; // 音量 0-127
    pan: number; // 声像 -1 到 1
    velocity: number; // 默认力度
    detune?: number; // 音分偏移
    decayTime?: number; // 释放时间

    // 高级配置
    lpfCutoffHz?: number; // 低通滤波器
    formats?: string[]; // 音频格式优先级

    // 采样映射（仅用于 Sampler）
    samples?: {
      baseUrl: string;
      formats: string[];
      map: Record<string, string>;
    };

    // 分组和区域（仅用于复杂音色）
    groups?: Array<{
      regions: Array<{
        sample: string;
        key: number;
        pitch: number;
        velocity?: { range: [number, number] };
      }>;
    }>;
  };

  // 元数据
  metadata: {
    createdAt: number; // 创建时间戳
    updatedAt: number; // 更新时间戳
    lastUsedAt: number; // 最后使用时间戳
    usageCount: number; // 使用次数（用于 LRU）
    isFavorite: boolean; // 是否收藏
    tags: string[]; // 标签（如 "warm", "bright"）
    author?: string; // 作者
    source?: "user" | "system" | "community"; // 来源
  };

  // 缓存状态
  cacheStatus: {
    isCached: boolean; // 是否已缓存到 CacheStorage
    cachedAt?: number; // 缓存时间
    cacheKey?: string; // CacheStorage 中的键
    sizeBytes?: number; // 数据大小（字节）
    etag?: string; // HTTP ETag（用于验证）
  };

  // 版本控制
  version: number; // 配置版本号
  checksum?: string; // 配置校验和
}
```

**索引设计**：

```typescript
// 主键索引
keyPath: "id"

// 辅助索引
indices: [
  { name: "by-type", keyPath: "instrumentType", unique: false },
  { name: "by-name", keyPath: "name", unique: false },
  { name: "by-lastUsed", keyPath: "metadata.lastUsedAt", unique: false },
  { name: "by-usage", keyPath: "metadata.usageCount", unique: false },
  { name: "by-favorite", keyPath: "metadata.isFavorite", unique: false },
  { name: "by-source", keyPath: "metadata.source", unique: false },
]
```

##### Store 2: `sampleCacheMetadata` - 采样缓存元数据

用于跟踪 CacheStorage 中的音频采样状态，实现 LRU 缓存管理。

```typescript
interface SampleCacheMetadata {
  // 主键：采样 URL 或唯一标识符
  id: string; // 例如: "https://danigb.github.io/samples/piano-c4.ogg"

  // 缓存信息
  cacheKey: string; // CacheStorage 中的键名
  cacheName: string; // CacheStorage 实例名（如 "smplr-cache-v1"）
  etag?: string; // HTTP ETag
  lastModified?: string; // HTTP Last-Modified

  // 访问统计
  lastAccessedAt: number; // 最后访问时间戳
  accessCount: number; // 访问次数
  sizeBytes: number; // 文件大小（字节）

  // 关联的预设
  associatedPresets: string[]; // 使用此采样的预设 ID 列表

  // 元数据
  cachedAt: number; // 缓存时间戳
  expiresAt?: number; // 过期时间戳（可选 TTL）
}
```

**索引设计**：

```typescript
keyPath: "id"

indices: [
  { name: "by-lastAccessed", keyPath: "lastAccessedAt", unique: false },
  { name: "by-cacheName", keyPath: "cacheName", unique: false },
  { name: "by-size", keyPath: "sizeBytes", unique: false },
]
```

##### Store 3: `userSettings` - 用户偏好设置

```typescript
interface UserSettings {
  // 主键：固定为 "user-settings"
  id: "user-settings";

  // 默认音色配置
  defaultInstrument: {
    type: InstrumentType;
    presetId?: string;
  };

  // 缓存配置
  cacheConfig: {
    maxSizeMB: number; // 最大缓存大小（MB），默认 500
    defaultTTL: number; // 默认 TTL（秒），0 表示永不过期
    autoCleanup: boolean; // 是否自动清理过期缓存
    cleanupInterval: number; // 清理间隔（秒）
  };

  // 音色库配置
  libraryConfig: {
    recentPresets: string[]; // 最近使用的预设 ID（最多 10 个）
    favoritePresets: string[]; // 收藏的预设 ID
  };

  // 元数据
  updatedAt: number;
}
```

##### Store 4: `libraryStats` - 音色库统计信息

```typescript
interface LibraryStats {
  // 主键：固定为 "library-stats"
  id: "library-stats";

  // 使用统计
  totalPresets: number; // 预设总数
  totalCachedSamples: number; // 缓存的采样总数
  totalCacheSizeBytes: number; // 缓存总大小（字节）

  // 命中率统计
  cacheHitRate: number; // 缓存命中率（0-1）
  totalRequests: number; // 总请求次数
  cacheHits: number; // 缓存命中次数

  // 元数据
  lastUpdated: number;
}
```

### 1.3 完整 Schema 定义代码

```typescript
/**
 * IndexedDB 数据库初始化和 Schema 定义
 */
import { openDB, IDBPDatabase } from "idb";

// 类型定义
export type InstrumentType =
  | "soundfont"
  | "drum-machine"
  | "sampler"
  | "splendid-grand-piano"
  | "electric-piano"
  | "mallet"
  | "mellotron"
  | "smolken"
  | "versilian";

export interface InstrumentPreset {
  id: string;
  name: string;
  instrumentType: InstrumentType;
  description?: string;
  config: {
    instrument?: string;
    kit?: string;
    volume: number;
    pan: number;
    velocity: number;
    detune?: number;
    decayTime?: number;
    lpfCutoffHz?: number;
    formats?: string[];
    samples?: {
      baseUrl: string;
      formats: string[];
      map: Record<string, string>;
    };
    groups?: Array<{
      regions: Array<{
        sample: string;
        key: number;
        pitch: number;
        velocity?: { range: [number, number] };
      }>;
    }>;
  };
  metadata: {
    createdAt: number;
    updatedAt: number;
    lastUsedAt: number;
    usageCount: number;
    isFavorite: boolean;
    tags: string[];
    author?: string;
    source?: "user" | "system" | "community";
  };
  cacheStatus: {
    isCached: boolean;
    cachedAt?: number;
    cacheKey?: string;
    sizeBytes?: number;
    etag?: string;
  };
  version: number;
  checksum?: string;
}

export interface SampleCacheMetadata {
  id: string;
  cacheKey: string;
  cacheName: string;
  etag?: string;
  lastModified?: string;
  lastAccessedAt: number;
  accessCount: number;
  sizeBytes: number;
  associatedPresets: string[];
  cachedAt: number;
  expiresAt?: number;
}

export interface UserSettings {
  id: "user-settings";
  defaultInstrument: {
    type: InstrumentType;
    presetId?: string;
  };
  cacheConfig: {
    maxSizeMB: number;
    defaultTTL: number;
    autoCleanup: boolean;
    cleanupInterval: number;
  };
  libraryConfig: {
    recentPresets: string[];
    favoritePresets: string[];
  };
  updatedAt: number;
}

export interface LibraryStats {
  id: "library-stats";
  totalPresets: number;
  totalCachedSamples: number;
  totalCacheSizeBytes: number;
  cacheHitRate: number;
  totalRequests: number;
  cacheHits: number;
  lastUpdated: number;
}

// 数据库名称和版本
const DB_NAME = "midi-jar-sampler-config";
const DB_VERSION = 1;

/**
 * 初始化数据库并创建对象存储
 */
export async function initSamplerDatabase(): Promise<IDBPDatabase> {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 版本 1：初始创建
      if (oldVersion < 1) {
        // 创建 instrumentPresets 存储
        if (!db.objectStoreNames.contains("instrumentPresets")) {
          const presetStore = db.createObjectStore("instrumentPresets", {
            keyPath: "id",
          });

          // 创建索引
          presetStore.createIndex("by-type", "instrumentType", {
            unique: false,
          });
          presetStore.createIndex("by-name", "name", { unique: false });
          presetStore.createIndex("by-lastUsed", "metadata.lastUsedAt", {
            unique: false,
          });
          presetStore.createIndex("by-usage", "metadata.usageCount", {
            unique: false,
          });
          presetStore.createIndex("by-favorite", "metadata.isFavorite", {
            unique: false,
          });
          presetStore.createIndex("by-source", "metadata.source", {
            unique: false,
          });
        }

        // 创建 sampleCacheMetadata 存储
        if (!db.objectStoreNames.contains("sampleCacheMetadata")) {
          const cacheStore = db.createObjectStore("sampleCacheMetadata", {
            keyPath: "id",
          });

          cacheStore.createIndex("by-lastAccessed", "lastAccessedAt", {
            unique: false,
          });
          cacheStore.createIndex("by-cacheName", "cacheName", {
            unique: false,
          });
          cacheStore.createIndex("by-size", "sizeBytes", { unique: false });
        }

        // 创建 userSettings 存储
        if (!db.objectStoreNames.contains("userSettings")) {
          db.createObjectStore("userSettings", { keyPath: "id" });
        }

        // 创建 libraryStats 存储
        if (!db.objectStoreNames.contains("libraryStats")) {
          db.createObjectStore("libraryStats", { keyPath: "id" });
        }
      }

      // 未来版本迁移示例：
      // if (oldVersion < 2) {
      //   const presetStore = transaction.objectStore("instrumentPresets");
      //   presetStore.createIndex("by-checksum", "checksum", { unique: false });
      // }
    },

    blocked() {
      console.warn(
        "数据库升级被阻塞，请关闭其他标签页中的旧版本应用"
      );
    },

    blocking() {
      console.warn(
        "数据库正在被其他标签页使用，当前标签页的数据库连接可能被阻塞"
      );
    },
  });

  // 初始化默认用户设置（如果不存在）
  await initializeDefaultSettings(db);

  return db;
}

/**
 * 初始化默认用户设置
 */
async function initializeDefaultSettings(db: IDBPDatabase): Promise<void> {
  const tx = db.transaction("userSettings", "readwrite");
  const store = tx.objectStore("userSettings");

  const existing = await store.get("user-settings");

  if (!existing) {
    const defaultSettings: UserSettings = {
      id: "user-settings",
      defaultInstrument: {
        type: "splendid-grand-piano",
      },
      cacheConfig: {
        maxSizeMB: 500,
        defaultTTL: 0, // 永不过期
        autoCleanup: true,
        cleanupInterval: 3600, // 1小时
      },
      libraryConfig: {
        recentPresets: [],
        favoritePresets: [],
      },
      updatedAt: Date.now(),
    };

    await store.put(defaultSettings);
  }

  // 初始化统计信息（如果不存在）
  const statsStore = db.transaction("libraryStats", "readwrite").objectStore("libraryStats");
  const existingStats = await statsStore.get("library-stats");

  if (!existingStats) {
    const defaultStats: LibraryStats = {
      id: "library-stats",
      totalPresets: 0,
      totalCachedSamples: 0,
      totalCacheSizeBytes: 0,
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      lastUpdated: Date.now(),
    };

    await statsStore.put(defaultStats);
  }
}
```

**设计说明**：

1. **对象存储分离**：将预设配置、缓存元数据、用户设置、统计信息分开存储，遵循单一职责原则。

2. **索引设计**：
   - 支持按类型、名称查询预设
   - 支持按使用频率、最后使用时间排序（用于 LRU）
   - 支持按收藏、来源筛选

3. **元数据完整**：每个对象都包含创建时间、更新时间、版本号等元数据，便于版本管理和审计。

4. **缓存状态追踪**：预设对象中包含 `cacheStatus` 字段，用于同步 IndexedDB 和 CacheStorage 的状态。

---

## 2. 与 CacheStorage 配合

### 2.1 双层缓存架构

smplr 本身支持 CacheStorage，我们需要在 IndexedDB 层面与之配合：

```
┌─────────────────────────────────────────────────────┐
│                  应用层 (smplr)                      │
│  Soundfont / DrumMachine / Sampler 实例             │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               │ 配置数据          │ 音频数据
               ▼                  ▼
      ┌─────────────────┐  ┌─────────────────────┐
      │   IndexedDB     │  │   CacheStorage      │
      │ (配置 + 元数据)  │  │ (音频采样二进制)     │
      └─────────────────┘  └─────────────────────┘
               │                  │
               └──────┬───────────┘
                      │
              元数据同步关联
```

### 2.2 同步策略

#### 策略 1：配置驱动型同步

**原理**：IndexedDB 存储音色配置，CacheStorage 存储音频数据，两者通过配置中的 URL 建立关联。

```typescript
/**
 * 音色加载协调器 - 协调 IndexedDB 和 CacheStorage
 */
export class SamplerCacheCoordinator {
  private db: IDBPDatabase;
  private cache: Cache;

  constructor(db: IDBPDatabase, cache: Cache) {
    this.db = db;
    this.cache = cache;
  }

  /**
   * 加载音色预设（协调 IndexedDB 配置 + CacheStorage 音频）
   */
  async loadPreset(presetId: string): Promise<InstrumentPreset | null> {
    // 1. 从 IndexedDB 读取预设配置
    const tx = this.db.transaction("instrumentPresets", "readonly");
    const preset = await tx.objectStore("instrumentPresets").get(presetId);

    if (!preset) {
      return null;
    }

    // 2. 检查 CacheStorage 中的音频是否已缓存
    const sampleUrls = this.extractSampleUrls(preset);

    for (const url of sampleUrls) {
      const cached = await this.cache.match(url);

      if (cached) {
        // 更新缓存元数据（访问时间）
        await this.updateCacheMetadata(url);
      }
    }

    // 3. 更新预设的使用统计
    await this.updatePresetUsage(presetId);

    return preset;
  }

  /**
   * 提取预设中的所有采样 URL
   */
  private extractSampleUrls(preset: InstrumentPreset): string[] {
    const urls: string[] = [];

    // 从 samples.map 中提取
    if (preset.config.samples?.map) {
      const baseUrl = preset.config.samples.baseUrl;
      for (const sampleId of Object.values(preset.config.samples.map)) {
        urls.push(`${baseUrl}/${sampleId}`);
      }
    }

    // 从 groups.regions 中提取
    if (preset.config.groups) {
      for (const group of preset.config.groups) {
        for (const region of group.regions) {
          // 假设 sample 是相对路径
          urls.push(region.sample);
        }
      }
    }

    return urls;
  }

  /**
   * 更新缓存元数据
   */
  private async updateCacheMetadata(url: string): Promise<void> {
    const tx = this.db.transaction("sampleCacheMetadata", "readwrite");
    const store = tx.objectStore("sampleCacheMetadata");

    const metadata = await store.get(url);

    if (metadata) {
      metadata.lastAccessedAt = Date.now();
      metadata.accessCount += 1;
      await store.put(metadata);
    }
  }

  /**
   * 更新预设使用统计
   */
  private async updatePresetUsage(presetId: string): Promise<void> {
    const tx = this.db.transaction("instrumentPresets", "readwrite");
    const store = tx.objectStore("instrumentPresets");

    const preset = await store.get(presetId);

    if (preset) {
      preset.metadata.lastUsedAt = Date.now();
      preset.metadata.usageCount += 1;
      await store.put(preset);
    }

    // 更新最近使用列表
    await this.updateRecentPresets(presetId);
  }

  /**
   * 更新最近使用的预设列表
   */
  private async updateRecentPresets(presetId: string): Promise<void> {
    const tx = this.db.transaction("userSettings", "readwrite");
    const store = tx.objectStore("userSettings");

    const settings = await store.get("user-settings");

    if (settings) {
      // 移除重复项
      const recent = settings.libraryConfig.recentPresets.filter(
        (id) => id !== presetId
      );

      // 添加到最前面
      recent.unshift(presetId);

      // 保留最近 10 个
      settings.libraryConfig.recentPresets = recent.slice(0, 10);
      settings.updatedAt = Date.now();

      await store.put(settings);
    }
  }
}
```

#### 策略 2：失效检测与同步

**问题**：IndexedDB 中的配置可能指向 CacheStorage 中已不存在的音频。

**解决方案**：在加载时验证缓存一致性。

```typescript
/**
 * 验证预设的缓存状态是否与 CacheStorage 一致
 */
export async function validatePresetCacheConsistency(
  db: IDBPDatabase,
  cache: Cache,
  presetId: string
): Promise<{
  isValid: boolean;
  missingSamples: string[];
}> {
  // 1. 从 IndexedDB 读取预设
  const tx = db.transaction("instrumentPresets", "readonly");
  const preset = await tx.objectStore("instrumentPresets").get(presetId);

  if (!preset) {
    return { isValid: false, missingSamples: [] };
  }

  // 2. 检查 CacheStorage 中的采样
  const sampleUrls = extractSampleUrls(preset);
  const missingSamples: string[] = [];

  for (const url of sampleUrls) {
    const cached = await cache.match(url);

    if (!cached) {
      missingSamples.push(url);
    }
  }

  // 3. 更新预设的缓存状态
  if (missingSamples.length > 0) {
    const updateTx = db.transaction("instrumentPresets", "readwrite");
    const store = updateTx.objectStore("instrumentPresets");

    preset.cacheStatus.isCached = false;
    preset.cacheStatus.cachedAt = undefined;

    await store.put(preset);
  }

  return {
    isValid: missingSamples.length === 0,
    missingSamples,
  };
}
```

### 2.3 同步时机

| 时机 | IndexedDB 操作 | CacheStorage 操作 | 同步动作 |
|------|----------------|-------------------|----------|
| 加载预设 | 读取配置、更新使用统计 | 检查缓存命中 | 更新缓存元数据 |
| 缓存采样 | 更新元数据（cachedAt, sizeBytes） | 存储 Response | 建立关联 |
| 清理缓存 | 更新元数据（删除记录） | 删除 Response | 同步删除 |
| 启动应用 | 读取统计信息 | 检查缓存状态 | 验证一致性 |

---

## 3. 缓存策略

### 3.1 缓存生命周期

#### 默认配置

```typescript
const DEFAULT_CACHE_CONFIG = {
  maxSizeMB: 500, // 最大 500MB
  defaultTTL: 0, // 永不过期（除非手动清理）
  autoCleanup: true, // 自动清理
  cleanupInterval: 3600, // 每小时检查一次
};
```

#### TTL 策略

用户可以为不同的音色库设置不同的 TTL：

```typescript
interface CachePolicy {
  maxSizeMB: number;
  defaultTTL: number; // 秒，0 表示永不过期
  policies: {
    [instrumentType: string]: {
      ttl: number; // 特定音色类型的 TTL
      priority: "high" | "medium" | "low"; // 清理优先级
    };
  };
}

// 示例：
const policy: CachePolicy = {
  maxSizeMB: 500,
  defaultTTL: 0,
  policies: {
    "splendid-grand-piano": { ttl: 0, priority: "high" }, // 永不过期，高优先级
    "drum-machine": { ttl: 7 * 24 * 3600, priority: "medium" }, // 1周
    "soundfont": { ttl: 30 * 24 * 3600, priority: "low" }, // 1个月
  },
};
```

### 3.2 LRU 实现

使用 IndexedDB 的索引支持 LRU 淘汰算法：

```typescript
/**
 * LRU 缓存管理器
 */
export class LRUCacheManager {
  private db: IDBPDatabase;
  private cache: Cache;
  private maxSizeBytes: number;

  constructor(db: IDBPDatabase, cache: Cache, maxSizeMB: number) {
    this.db = db;
    this.cache = cache;
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
  }

  /**
   * 检查缓存大小是否超限，若超限则执行 LRU 淘汰
   */
  async enforceSizeLimit(): Promise<void> {
    // 1. 计算当前缓存总大小
    const currentSize = await this.calculateTotalCacheSize();

    if (currentSize <= this.maxSizeBytes) {
      return; // 未超限
    }

    // 2. 执行 LRU 淘汰
    await this.evictLRU(currentSize - this.maxSizeBytes);
  }

  /**
   * 计算缓存总大小
   */
  private async calculateTotalCacheSize(): Promise<number> {
    const tx = this.db.transaction("libraryStats", "readonly");
    const stats = await tx.objectStore("libraryStats").get("library-stats");

    return stats?.totalCacheSizeBytes || 0;
  }

  /**
   * 执行 LRU 淘汰，直到释放指定大小的空间
   */
  private async evictLRU(bytesToFree: number): Promise<void> {
    let freedBytes = 0;

    // 1. 从 IndexedDB 按最后访问时间升序查询（最久未使用的在前）
    const tx = this.db.transaction("sampleCacheMetadata", "readwrite");
    const store = tx.objectStore("sampleCacheMetadata");
    const index = store.index("by-lastAccessed");

    // 打开游标，按时间升序遍历
    let cursor = await index.openCursor();

    while (cursor && freedBytes < bytesToFree) {
      const metadata = cursor.value;

      // 2. 从 CacheStorage 删除
      await this.cache.delete(metadata.cacheKey);

      // 3. 从 IndexedDB 删除元数据
      await cursor.delete();

      freedBytes += metadata.sizeBytes;

      // 移动到下一个
      cursor = await cursor.continue();
    }

    // 4. 更新统计信息
    await this.updateStatsAfterEviction(freedBytes);

    console.log(`LRU 淘汰完成，释放 ${freedBytes} 字节`);
  }

  /**
   * 更新统计信息
   */
  private async updateStatsAfterEviction(freedBytes: number): Promise<void> {
    const tx = this.db.transaction("libraryStats", "readwrite");
    const store = tx.objectStore("libraryStats");

    const stats = await store.get("library-stats");

    if (stats) {
      stats.totalCacheSizeBytes -= freedBytes;
      stats.totalCachedSamples -= 1; // 简化：假设只删除了一个
      stats.lastUpdated = Date.now();

      await store.put(stats);
    }
  }

  /**
   * 更新访问时间（在缓存命中时调用）
   */
  async updateAccessTime(sampleId: string): Promise<void> {
    const tx = this.db.transaction("sampleCacheMetadata", "readwrite");
    const store = tx.objectStore("sampleCacheMetadata");

    const metadata = await store.get(sampleId);

    if (metadata) {
      metadata.lastAccessedAt = Date.now();
      metadata.accessCount += 1;

      await store.put(metadata);
    }
  }
}
```

### 3.3 缓存大小限制实现

使用 Storage API 查询配额和已用空间：

```typescript
/**
 * 查询存储配额和已用空间
 */
export async function getStorageEstimate(): Promise<{
  quota: number;
  usage: number;
  usageDetails?: {
    caches: number;
    indexedDB: number;
  };
}> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const estimate = await navigator.storage.estimate();

    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      usageDetails: estimate.usageDetails as any,
    };
  }

  // 不支持 Storage API 时的降级方案
  return {
    quota: 0,
    usage: 0,
  };
}

/**
 * 检查是否接近配额限制
 */
export async function isStorageNearLimit(
  thresholdPercent: number = 0.9
): Promise<boolean> {
  const { quota, usage } = await getStorageEstimate();

  if (quota === 0) return false;

  return usage / quota > thresholdPercent;
}
```

### 3.4 缓存过期处理

#### 定期清理

```typescript
/**
 * 缓存清理调度器
 */
export class CacheCleanupScheduler {
  private db: IDBPDatabase;
  private cache: Cache;
  private intervalId: number | null = null;

  constructor(db: IDBPDatabase, cache: Cache) {
    this.db = db;
    this.cache = cache;
  }

  /**
   * 启动定期清理
   */
  start(intervalSeconds: number): void {
    if (this.intervalId !== null) {
      console.warn("清理调度器已在运行");
      return;
    }

    this.intervalId = window.setInterval(() => {
      this.cleanupExpired();
    }, intervalSeconds * 1000);

    console.log(`缓存清理调度器已启动，间隔 ${intervalSeconds} 秒`);
  }

  /**
   * 停止定期清理
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;

      console.log("缓存清理调度器已停止");
    }
  }

  /**
   * 清理过期的缓存项
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();

    const tx = this.db.transaction("sampleCacheMetadata", "readwrite");
    const store = tx.objectStore("sampleCacheMetadata");

    // 查询所有有过期时间的记录
    const range = IDBKeyRange.upperBound(now);

    let cursor = await store.openCursor();

    let cleanedCount = 0;

    while (cursor) {
      const metadata = cursor.value;

      // 检查是否过期
      if (metadata.expiresAt && metadata.expiresAt <= now) {
        // 从 CacheStorage 删除
        await this.cache.delete(metadata.cacheKey);

        // 从 IndexedDB 删除
        await cursor.delete();

        cleanedCount++;
      }

      cursor = await cursor.continue();
    }

    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个过期缓存项`);
    }
  }
}
```

---

## 4. 版本管理

### 4.1 版本号策略

- **数据库版本**：每次 Schema 变更时递增（1, 2, 3...）
- **配置版本**：存储在对象的 `version` 字段，用于数据迁移

### 4.2 迁移策略

#### 小版本更新（非破坏性）

示例：添加新字段、新增索引

```typescript
// 在 upgrade 回调中
if (oldVersion < 2) {
  // 添加新索引
  const store = transaction.objectStore("instrumentPresets");

  if (!store.indexNames.contains("by-checksum")) {
    store.createIndex("by-checksum", "checksum", { unique: false });
  }

  // 为现有数据填充新字段（默认值）
  const cursor = await store.openCursor();

  while (cursor) {
    const preset = cursor.value;

    // 添加 checksum 字段（默认为空）
    if (!preset.checksum) {
      preset.checksum = await calculateChecksum(preset.config);
      preset.version = 2;
      await cursor.update(preset);
    }

    await cursor.continue();
  }
}
```

#### 大版本更新（破坏性）

示例：删除对象存储、修改键路径

```typescript
if (oldVersion < 3) {
  // 删除旧的对象存储
  if (db.objectStoreNames.contains("oldStore")) {
    db.deleteObjectStore("oldStore");
  }

  // 创建新的对象存储（如果结构变更）
  if (!db.objectStoreNames.contains("newStore")) {
    db.createObjectStore("newStore", { keyPath: "newId" });
  }

  // 数据迁移（如果需要）
  // 注意：此时旧存储已被删除，需提前备份
}
```

### 4.3 数据备份与恢复

在破坏性迁移前，建议导出数据到 JSON：

```typescript
/**
 * 导出所有数据到 JSON（备份）
 */
export async function exportDatabaseToJson(
  db: IDBPDatabase
): Promise<string> {
  const exportData: any = {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {},
  };

  // 导出每个对象存储
  const storeNames = Array.from(db.objectStoreNames);

  for (const storeName of storeNames) {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const allData = await store.getAll();

    exportData.stores[storeName] = allData;
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * 从 JSON 导入数据（恢复）
 */
export async function importDatabaseFromJson(
  db: IDBPDatabase,
  jsonString: string
): Promise<void> {
  const importData = JSON.parse(jsonString);

  // 验证版本兼容性
  if (importData.version > DB_VERSION) {
    throw new Error("导入的数据版本高于当前数据库版本");
  }

  // 导入每个对象存储
  for (const [storeName, data] of Object.entries(importData.stores)) {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    // 清空现有数据
    await store.clear();

    // 导入新数据
    for (const item of data as any[]) {
      await store.put(item);
    }
  }
}
```

---

## 5. 性能优化

### 5.1 减少读写次数

#### 批量操作

使用事务批量写入，减少事务开销：

```typescript
/**
 * 批量添加预设
 */
export async function batchAddPresets(
  db: IDBPDatabase,
  presets: InstrumentPreset[]
): Promise<void> {
  // 单个事务批量写入
  const tx = db.transaction("instrumentPresets", "readwrite");
  const store = tx.objectStore("instrumentPresets");

  for (const preset of presets) {
    await store.put(preset);
  }

  // 等待事务完成
  await tx.done;
}
```

#### 延迟写入

对于频繁更新的数据（如访问时间），使用防抖：

```typescript
import { debounce } from "lodash-es";

class AccessTimeUpdater {
  private pendingUpdates = new Map<string, number>();
  private db: IDBPDatabase;

  private flush = debounce(async () => {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    const tx = this.db.transaction("sampleCacheMetadata", "readwrite");
    const store = tx.objectStore("sampleCacheMetadata");

    for (const [id, time] of updates) {
      const metadata = await store.get(id);

      if (metadata) {
        metadata.lastAccessedAt = time;
        await store.put(metadata);
      }
    }

    await tx.done;
  }, 1000); // 1秒后批量写入

  recordAccess(id: string): void {
    this.pendingUpdates.set(id, Date.now());
    this.flush();
  }
}
```

### 5.2 使用事务确保原子性

```typescript
/**
 * 更新预设并更新统计信息（原子操作）
 */
export async function updatePresetAndStats(
  db: IDBPDatabase,
  preset: InstrumentPreset
): Promise<void> {
  const tx = db.transaction(
    ["instrumentPresets", "libraryStats"],
    "readwrite"
  );

  const presetStore = tx.objectStore("instrumentPresets");
  const statsStore = tx.objectStore("libraryStats");

  // 更新预设
  await presetStore.put(preset);

  // 更新统计
  const stats = await statsStore.get("library-stats");

  if (stats) {
    stats.totalPresets += 1;
    stats.lastUpdated = Date.now();
    await statsStore.put(stats);
  }

  // 等待所有操作完成
  await tx.done;
}
```

### 5.3 避免阻塞主线程

#### 使用 Web Worker

将耗时的 IndexedDB 操作放入 Web Worker：

```typescript
// worker.ts
import { openDB } from "idb";

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === "query-presets") {
    const db = await openDB("midi-jar-sampler-config", 1);
    const presets = await db.getAll("instrumentPresets");

    self.postMessage({ type: "query-result", payload: presets });
  }

  if (type === "cleanup-cache") {
    // 执行 LRU 清理...
    self.postMessage({ type: "cleanup-complete" });
  }
};

// 主线程
const worker = new Worker(new URL("./worker.ts", import.meta.url));

worker.onmessage = (e) => {
  if (e.data.type === "query-result") {
    console.log("查询结果:", e.data.payload);
  }
};

// 发送查询请求
worker.postMessage({ type: "query-presets" });
```

#### 分页查询

对于大量数据，使用游标分页：

```typescript
/**
 * 分页查询预设
 */
export async function queryPresetsPaginated(
  db: IDBPDatabase,
  options: {
    limit: number;
    offset: number;
    sortBy?: "name" | "lastUsed" | "usageCount";
  }
): Promise<InstrumentPreset[]> {
  const tx = db.transaction("instrumentPresets", "readonly");
  const store = tx.objectStore("instrumentPresets");

  // 选择索引
  const indexName =
    options.sortBy === "lastUsed"
      ? "by-lastUsed"
      : options.sortBy === "usageCount"
      ? "by-usage"
      : undefined;

  const source = indexName ? store.index(indexName) : store;

  // 使用游标跳过 offset 条记录
  let cursor = await source.openCursor();
  let skipped = 0;

  while (cursor && skipped < options.offset) {
    cursor = await cursor.continue();
    skipped++;
  }

  // 读取 limit 条记录
  const results: InstrumentPreset[] = [];

  while (cursor && results.length < options.limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  return results;
}
```

---

## 6. 错误处理

### 6.1 降级方案

#### IndexedDB 不可用时回退到 localStorage

```typescript
/**
 * 检测 IndexedDB 是否可用
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  try {
    if (!window.indexedDB) return false;

    // 尝试打开一个测试数据库
    const testDB = await openDB("__test__", 1, {
      upgrade(db) {
        db.createObjectStore("test");
      },
    });

    // 关闭并删除测试数据库
    testDB.close();
    await indexedDB.deleteDatabase("__test__");

    return true;
  } catch (error) {
    console.warn("IndexedDB 不可用:", error);
    return false;
  }
}

/**
 * 存储适配器接口
 */
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * IndexedDB 适配器
 */
class IndexedDBAdapter implements StorageAdapter {
  private db: IDBPDatabase;

  constructor(db: IDBPDatabase) {
    this.db = db;
  }

  async get<T>(key: string): Promise<T | null> {
    const tx = this.db.transaction("userSettings", "readonly");
    const result = await tx.objectStore("userSettings").get(key);
    return result || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const tx = this.db.transaction("userSettings", "readwrite");
    await tx.objectStore("userSettings").put({ id: key, ...value });
  }

  async remove(key: string): Promise<void> {
    const tx = this.db.transaction("userSettings", "readwrite");
    await tx.objectStore("userSettings").delete(key);
  }

  async clear(): Promise<void> {
    const tx = this.db.transaction("userSettings", "readwrite");
    await tx.objectStore("userSettings").clear();
  }
}

/**
 * localStorage 适配器（降级方案）
 */
class LocalStorageAdapter implements StorageAdapter {
  private prefix = "midi-jar-";

  async get<T>(key: string): Promise<T | null> {
    const stored = localStorage.getItem(this.prefix + key);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return stored as any;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * 自动选择最佳存储后端
 */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  const isAvailable = await isIndexedDBAvailable();

  if (isAvailable) {
    try {
      const db = await initSamplerDatabase();
      return new IndexedDBAdapter(db);
    } catch (error) {
      console.error("IndexedDB 初始化失败，降级到 localStorage:", error);
      return new LocalStorageAdapter();
    }
  } else {
    console.warn("IndexedDB 不可用，使用 localStorage 降级方案");
    return new LocalStorageAdapter();
  }
}
```

### 6.2 错误恢复

```typescript
/**
 * 带重试的数据库操作
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        console.warn(
          `操作失败，${delayMs}ms 后重试 (第 ${attempt + 1}/${maxRetries} 次)`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // 指数退避
      }
    }
  }

  throw lastError;
}

/**
 * 使用示例
 */
export async function safeGetPreset(
  db: IDBPDatabase,
  presetId: string
): Promise<InstrumentPreset | null> {
  return withRetry(async () => {
    const tx = db.transaction("instrumentPresets", "readonly");
    return await tx.objectStore("instrumentPresets").get(presetId);
  });
}
```

---

## 7. 跨浏览器同步

### 7.1 同步方案概述

IndexedDB 遵循同源策略，数据仅在同一域名下可访问。跨浏览器同步需要云端服务：

```
┌──────────────┐          ┌──────────────┐
│  Chrome 浏览器 │          │  Firefox 浏览器│
│  IndexedDB   │          │  IndexedDB   │
└──────┬───────┘          └──────┬───────┘
       │                         │
       │ 同步到云端               │ 同步到云端
       ▼                         ▼
┌─────────────────────────────────────────┐
│         云端存储服务（可选）              │
│  - Firebase Realtime Database           │
│  - Supabase                             │
│  - 自建 REST API                         │
└─────────────────────────────────────────┘
```

### 7.2 本地同步（BroadcastChannel）

同一设备上不同标签页之间的同步：

```typescript
/**
 * 跨标签页同步管理器
 */
export class CrossTabSyncManager {
  private channel: BroadcastChannel;
  private db: IDBPDatabase;
  private tabId: string;

  constructor(db: IDBPDatabase) {
    this.db = db;
    this.tabId = `${Date.now()}-${Math.random()}`;
    this.channel = new BroadcastChannel("midi-jar-sync");

    this.channel.onmessage = (event) => {
      this.handleSyncMessage(event.data);
    };
  }

  /**
   * 广播数据变更
   */
  broadcastChange(
    storeName: string,
    action: "add" | "update" | "delete",
    data: any
  ): void {
    this.channel.postMessage({
      type: "data-change",
      sourceTabId: this.tabId,
      storeName,
      action,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理来自其他标签页的同步消息
   */
  private async handleSyncMessage(message: any): Promise<void> {
    // 忽略自己发送的消息
    if (message.sourceTabId === this.tabId) return;

    if (message.type === "data-change") {
      const { storeName, action, data } = message;

      // 更新本地 IndexedDB
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      if (action === "add" || action === "update") {
        await store.put(data);
      } else if (action === "delete") {
        await store.delete(data.id);
      }

      await tx.done;

      console.log(`跨标签页同步: ${action} ${storeName}`);
    }
  }

  /**
   * 关闭同步
   */
  destroy(): void {
    this.channel.close();
  }
}
```

### 7.3 云端同步（示例：Supabase）

```typescript
/**
 * 云端同步客户端（Supabase 示例）
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export class CloudSyncClient {
  private supabase: SupabaseClient;
  private db: IDBPDatabase;
  private userId: string;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    userId: string,
    db: IDBPDatabase
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.userId = userId;
    this.db = db;
  }

  /**
   * 上传预设到云端
   */
  async uploadPreset(preset: InstrumentPreset): Promise<void> {
    const { error } = await this.supabase
      .from("instrument_presets")
      .upsert({
        id: preset.id,
        user_id: this.userId,
        name: preset.name,
        config: preset.config,
        metadata: preset.metadata,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  /**
   * 从云端下载预设
   */
  async downloadPresets(): Promise<InstrumentPreset[]> {
    const { data, error } = await this.supabase
      .from("instrument_presets")
      .select("*")
      .eq("user_id", this.userId);

    if (error) throw error;

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      instrumentType: row.config.instrumentType,
      config: row.config,
      metadata: row.metadata,
      cacheStatus: { isCached: false },
      version: 1,
    }));
  }

  /**
   * 全量同步
   */
  async fullSync(): Promise<void> {
    // 1. 上传本地修改
    const localPresets = await this.getLocalModifiedPresets();

    for (const preset of localPresets) {
      await this.uploadPreset(preset);
    }

    // 2. 下载云端更新
    const remotePresets = await this.downloadPresets();

    const tx = this.db.transaction("instrumentPresets", "readwrite");
    const store = tx.objectStore("instrumentPresets");

    for (const preset of remotePresets) {
      await store.put(preset);
    }

    await tx.done;

    console.log(`同步完成，更新了 ${remotePresets.length} 个预设`);
  }

  /**
   * 获取本地修改的预设（简化示例）
   */
  private async getLocalModifiedPresets(): Promise<InstrumentPreset[]> {
    // 实际应用中应跟踪"最后同步时间"和"本地修改时间"
    const tx = this.db.transaction("instrumentPresets", "readonly");
    return await tx.objectStore("instrumentPresets").getAll();
  }
}
```

---

## 8. 隐私保护

### 8.1 数据分类

| 数据类型 | 敏感级别 | 是否加密 | 存储位置 |
|----------|----------|----------|----------|
| 音色配置 | 低 | 否 | IndexedDB |
| 用户设置 | 低 | 否 | IndexedDB |
| 用户元数据（如收藏） | 中 | 可选 | IndexedDB |
| 云端认证令牌 | 高 | **必须** | 不存储在 IndexedDB，使用安全的 Cookie |

### 8.2 敏感数据加密

对于需要加密的数据（如用户私有预设），使用 Web Crypto API：

```typescript
/**
 * 加密工具类
 */
export class DataEncryptor {
  private key: CryptoKey | null = null;

  /**
   * 生成加密密钥
   */
  async generateKey(password: string): Promise<void> {
    // 从密码派生密钥
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    this.key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("midi-jar-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * 加密数据
   */
  async encrypt(data: any): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
    if (!this.key) throw new Error("密钥未初始化");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      plaintext
    );

    return { iv, ciphertext };
  }

  /**
   * 解密数据
   */
  async decrypt<T>(
    iv: Uint8Array,
    ciphertext: ArrayBuffer
  ): Promise<T> {
    if (!this.key) throw new Error("密钥未初始化");

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext));
  }
}
```

### 8.3 GDPR 合规性

#### 用户数据导出

```typescript
/**
 * 导出用户所有数据（GDPR 数据可携带权）
 */
export async function exportUserData(db: IDBPDatabase): Promise<string> {
  const exportData: any = {
    exportedAt: new Date().toISOString(),
    data: {},
  };

  // 导出所有对象存储
  const storeNames = Array.from(db.objectStoreNames);

  for (const storeName of storeNames) {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    exportData.data[storeName] = await store.getAll();
  }

  return JSON.stringify(exportData, null, 2);
}
```

#### 用户数据删除

```typescript
/**
 * 删除用户所有数据（GDPR 删除权）
 */
export async function deleteUserData(db: IDBPDatabase): Promise<void> {
  const storeNames = Array.from(db.objectStoreNames);

  for (const storeName of storeNames) {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    await store.clear();
  }

  // 删除 CacheStorage
  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    await caches.delete(cacheName);
  }

  console.log("用户数据已全部删除");
}
```

---

## 9. 完整 TypeScript 实现

### 9.1 主类：SamplerPersistenceManager

```typescript
/**
 * 采样器持久化管理器 - 统一接口
 */
export class SamplerPersistenceManager {
  private db: IDBPDatabase;
  private cache: Cache;
  private coordinator: SamplerCacheCoordinator;
  private lruManager: LRUCacheManager;
  private cleanupScheduler: CacheCleanupScheduler;
  private crossTabSync: CrossTabSyncManager;

  private constructor(
    db: IDBPDatabase,
    cache: Cache
  ) {
    this.db = db;
    this.cache = cache;
    this.coordinator = new SamplerCacheCoordinator(db, cache);
    this.lruManager = new LRUCacheManager(db, cache, 500);
    this.cleanupScheduler = new CacheCleanupScheduler(db, cache);
    this.crossTabSync = new CrossTabSyncManager(db);
  }

  /**
   * 创建实例（工厂方法）
   */
  static async create(): Promise<SamplerPersistenceManager> {
    // 初始化 IndexedDB
    const db = await initSamplerDatabase();

    // 初始化 CacheStorage
    const cache = await caches.open("smplr-cache-v1");

    return new SamplerPersistenceManager(db, cache);
  }

  /**
   * 保存音色预设
   */
  async savePreset(preset: InstrumentPreset): Promise<void> {
    const tx = this.db.transaction("instrumentPresets", "readwrite");
    const store = tx.objectStore("instrumentPresets");

    // 设置元数据
    preset.metadata.updatedAt = Date.now();
    preset.version = 1;

    await store.put(preset);

    // 广播到其他标签页
    this.crossTabSync.broadcastChange(
      "instrumentPresets",
      "update",
      preset
    );

    // 更新统计
    await this.updateStats("totalPresets", 1);
  }

  /**
   * 加载音色预设
   */
  async loadPreset(presetId: string): Promise<InstrumentPreset | null> {
    return await this.coordinator.loadPreset(presetId);
  }

  /**
   * 删除音色预设
   */
  async deletePreset(presetId: string): Promise<void> {
    const tx = this.db.transaction("instrumentPresets", "readwrite");
    const store = tx.objectStore("instrumentPresets");

    await store.delete(presetId);

    // 广播删除
    this.crossTabSync.broadcastChange(
      "instrumentPresets",
      "delete",
      { id: presetId }
    );

    // 更新统计
    await this.updateStats("totalPresets", -1);
  }

  /**
   * 查询预设列表
   */
  async queryPresets(options?: {
    type?: InstrumentType;
    favorite?: boolean;
    limit?: number;
  }): Promise<InstrumentPreset[]> {
    const tx = this.db.transaction("instrumentPresets", "readonly");
    const store = tx.objectStore("instrumentPresets");

    let results: InstrumentPreset[];

    if (options?.favorite) {
      const index = store.index("by-favorite");
      results = await index.getAll(true);
    } else if (options?.type) {
      const index = store.index("by-type");
      results = await index.getAll(options.type);
    } else {
      results = await store.getAll();
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 启动缓存清理
   */
  startCleanup(intervalSeconds: number = 3600): void {
    this.cleanupScheduler.start(intervalSeconds);
  }

  /**
   * 停止缓存清理
   */
  stopCleanup(): void {
    this.cleanupScheduler.stop();
  }

  /**
   * 强制执行 LRU 清理
   */
  async enforceCacheLimit(): Promise<void> {
    await this.lruManager.enforceSizeLimit();
  }

  /**
   * 获取存储统计
   */
  async getStats(): Promise<LibraryStats> {
    const tx = this.db.transaction("libraryStats", "readonly");
    const stats = await tx.objectStore("libraryStats").get("library-stats");

    return stats || {
      id: "library-stats",
      totalPresets: 0,
      totalCachedSamples: 0,
      totalCacheSizeBytes: 0,
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 更新统计信息
   */
  private async updateStats(
    field: keyof LibraryStats,
    delta: number
  ): Promise<void> {
    const tx = this.db.transaction("libraryStats", "readwrite");
    const store = tx.objectStore("libraryStats");

    const stats = await store.get("library-stats");

    if (stats && typeof stats[field] === "number") {
      stats[field] += delta;
      stats.lastUpdated = Date.now();
      await store.put(stats);
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.cleanupScheduler.stop();
    this.crossTabSync.destroy();
    this.db.close();
  }
}

/**
 * 使用示例
 */
async function example() {
  // 初始化
  const manager = await SamplerPersistenceManager.create();

  // 保存预设
  const preset: InstrumentPreset = {
    id: "my-piano-v1",
    name: "My Custom Piano",
    instrumentType: "splendid-grand-piano",
    config: {
      volume: 100,
      pan: 0,
      velocity: 100,
    },
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastUsedAt: Date.now(),
      usageCount: 0,
      isFavorite: true,
      tags: ["piano", "grand"],
      source: "user",
    },
    cacheStatus: {
      isCached: false,
    },
    version: 1,
  };

  await manager.savePreset(preset);

  // 加载预设
  const loaded = await manager.loadPreset("my-piano-v1");
  console.log("加载的预设:", loaded);

  // 查询预设
  const allPresets = await manager.queryPresets();
  console.log("所有预设:", allPresets);

  // 启动自动清理
  manager.startCleanup(3600);

  // 获取统计
  const stats = await manager.getStats();
  console.log("统计信息:", stats);

  // 清理
  manager.destroy();
}
```

---

## 总结

本方案设计了一个完整的 IndexedDB 持久化系统，用于存储采样器音色配置：

### 核心设计决策

1. **数据分离**：IndexedDB 存储配置和元数据，CacheStorage 存储音频二进制数据。
2. **双层缓存**：内存缓存（应用层）+ IndexedDB（持久层）+ CacheStorage（音频层）。
3. **LRU 策略**：使用 IndexedDB 索引实现高效的最近最少使用淘汰算法。
4. **版本管理**：使用 `onupgradeneeded` 处理 Schema 迁移，支持数据备份和恢复。
5. **性能优化**：批量写入、延迟更新、分页查询、Web Worker 支持。
6. **错误降级**：自动检测 IndexedDB 可用性，降级到 localStorage。
7. **跨标签页同步**：使用 BroadcastChannel 实现同设备多标签页实时同步。
8. **隐私保护**：支持数据加密、导出和删除，符合 GDPR 要求。

### 技术栈

- **IndexedDB**：`idb` 库（Promise 封装）
- **CacheStorage**：浏览器原生 API
- **加密**：Web Crypto API
- **同步**：BroadcastChannel + 云端服务（可选）

### 参考资料

- [MDN: 使用 IndexedDB](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [IndexedDB API 规范](https://www.w3.org/TR/IndexedDB/)
- [Cache API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [smplr 研究报告](./smplr-research-report.md)

---

**研究完成时间**：2026-07-21
**smplr 版本**：1.0.0
**研究者**：AI Research Agent