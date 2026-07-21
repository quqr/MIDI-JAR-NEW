# Ticket: IndexedDB 持久化方案

**Label:** wayfinder:research
**Parent:** 010-map-audio-smplr
**Status:** Open
**Blocked by:** (none)

---

## Question

需要研究并设计 IndexedDB 持久化方案:

1. **数据结构**: IndexedDB 中应该存储哪些数据?(音色元数据、用户配置、用户音色库列表)数据库 schema 如何设计?
2. **与 CacheStorage 配合**: smplr 使用 CacheStorage 缓存音频数据,IndexedDB 如何与之配合?需要同步吗?
3. **缓存策略**: 用户配置的缓存生命周期是什么?如何处理缓存过期?缓存大小限制(500MB)如何实现?
4. **版本管理**: IndexedDB schema 更新时如何迁移数据?版本号如何管理?
5. **性能优化**: 如何减少 IndexedDB 的读写次数?是否需要批量操作?
6. **错误处理**: IndexedDB 操作失败时如何降级?(回退到 localStorage?)
7. **跨浏览器同步**: 用户在不同设备/浏览器如何同步音色配置?
8. **隐私保护**: 是否需要加密敏感数据?如何清除用户数据?

## Resolution

研究已完成,详细设计见 [indexeddb-persistence-design.md](../indexeddb-persistence-design.md)。

### 核心方案

**双层缓存架构**:
- **IndexedDB**: 存储音色配置、元数据、用户设置(小数据,频繁访问)
- **CacheStorage**: 存储音频采样二进制数据(大数据,smplr 自动管理)

### 数据库 Schema

```typescript
// 4 个对象存储
- instrumentPresets     // 音色预设配置
- sampleCacheMetadata   // 音频缓存元数据
- userSettings          // 用户设置
- libraryStats          // 使用统计(LRU)
```

### 关键实现

1. **SamplerPersistenceManager**: 统一封装类,提供简洁 API
2. **LRU 缓存淘汰**: 基于 libraryStats 实现自动清理
3. **版本迁移**: 支持小版本(非破坏性)和大版本(破坏性)更新
4. **性能优化**: 批量操作、延迟写入、游标分页
5. **错误降级**: 自动检测 IndexedDB,回退到 localStorage
6. **跨标签页同步**: BroadcastChannel 实现同设备同步
7. **数据加密**: Web Crypto API 加密敏感数据
8. **GDPR 合规**: 提供数据导出和删除功能

### 缓存策略

- **默认限制**: 500MB(可配置)
- **淘汰策略**: LRU + TTL(7天)
- **自动清理**: 每周检查一次,清理过期和超限数据

### TypeScript 类型

完整的类型定义和实现代码见设计文档。