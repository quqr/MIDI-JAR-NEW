# Map: 集成 smplr 采样器到 MIDI-JAR-NEW

**Label:** wayfinder:map
**Status:** Complete — 所有决策已解决,路线清晰,可进入实现阶段

---

## Destination

将 danigb/smplr 采样器库集成到 MIDI-JAR-NEW 作为全局音源服务,创建 `/sampler` 独立路由视图,支持 smpldsnds 内置音色库、用户自定义 SFZ/SF2 音色库加载,使用 IndexedDB 持久化音色数据,为瀑布钢琴、RipplerX 等模块提供可切换的采样器音源。

## Notes

- **实现路线:** 先研究 smplr API 和调度器机制,再设计全局音源服务架构
- **视图形态:** Vue Router 独立路由 `/sampler`,类似 RipplerX 的功能模块
- **音频架构:** 全局单例音源服务,所有视图共用一个 smplr 实例
- **音色管理:** 完整的音色管理系统(状态指示器、浏览/选择UI、切换功能、缓存管理、持久化、加载进度)
- **持久化方案:** 使用 IndexedDB 存储已加载的音色缓存和用户音色库配置
- **用户采样:** 支持 SFZ/SF2 文件格式加载和用户音色库管理
- **技能:** /grilling, /domain-modeling, /prototype, /research

## Decisions so far

- [smplr API 和调度器机制研究](./011-smplr-api-research.md) — smplr 适合实时 MIDI 演奏,支持 128 个 GM 音色,内置调度器和缓存机制,但不支持 SFZ/SF2 格式
- [全局音源服务架构设计](./012-sampler-architecture-design.md) — 混合方案(Pinia store + composable),提供完整 API,使用 CacheStorage + IndexedDB 持久化,支持音源切换
- [音色管理 UI 设计](./013-sampler-ui-design.md) — 混合方案(卡片网格 + 侧边详情面板),响应式设计,完整的交互流程和原型验证
- [IndexedDB 持久化方案](./014-indexeddb-persistence.md) — 双层缓存架构(IndexedDB + CacheStorage),LRU 缓存淘汰,版本迁移,性能优化和错误降级

## Not yet specified

<!-- 所有核心决策已解决,可进入实现阶段 -->

后续实现中可能需要明确的细节:
- 具体的音色图标和颜色方案(可复用项目现有设计)
- 音色预览音频的实现方式(是否需要?)
- 用户音色库的导入/导出格式(JSON?)
- 音色元数据的同步频率(每次切换?定期?)

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->