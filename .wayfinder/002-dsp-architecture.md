# Ticket: DSP 核心算法移植架构设计

**Label:** wayfinder:research
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** (none)

---

## Question

将 RipplerX 的 C++ DSP 核心（Partial、Resonator、Waveguide、Mallet、Noise、Envelope、Models、Filter、Comb、Limiter、Voice、Sampler）移植到 TypeScript + AudioWorklet 时，需要确定：

1. **AudioWorklet 模块划分策略**：是整个 DSP 作为单个 AudioWorkletProcessor，还是拆分为多个 Processor 通过 AudioNode 连接？（单 Processor 更简单，多 Processor 更模块化但消息传递开销大）
2. **参数传递机制**：UI 参数变化如何传递到 AudioWorklet？使用 MessagePort、AudioParam、还是 SharedArrayBuffer？每种方式的延迟和实时性如何？
3. **采样率管理**：AudioWorklet 的采样率由浏览器控制，与 C++ 版本硬编码 44100/48000 不同，泛音计算和延迟线长度需要动态适应
4. **内存管理**：16 复音 × 2 共鸣器 × 64 泛音 = 2048 个 Partial 实例，每个有状态变量；Waveguide 有 20000 样本的延迟线。在 AudioWorklet 中的内存分配策略

需要研究 AudioWorklet API 的限制、性能基准数据、以及现有 Web 音频合成器的最佳实践。

## Resolution

### 1. AudioWorklet 模块划分 → 单 Processor

**决策：整个 DSP 封装为单个 AudioWorkletProcessor。**

理由：
- RipplerX 的 DSP 是一个紧密耦合的信号流（Mallet/Noise → ResonatorA/B → Comb → Limiter），拆分为多个 Processor 会引入 `process()` 调用间的调度开销
- 多 Processor 连接需要每个 `process()` 周期额外的缓冲区拷贝
- 参数协调（如耦合模式切换影响 A→B 的信号流）在单 Processor 内更简单
- 16 复音的 Voice 管理天然是单 Processor 的内部逻辑

### 2. 参数传递 → AudioParam + MessagePort 混合

**决策：连续参数用 AudioParam，离散事件用 MessagePort。**

- **AudioParam**：用于需要样本级平滑的连续参数（gain、pitch bend、decay、filter cutoff 等）。约 20-30 个核心连续参数。
- **MessagePort**：用于离散事件（noteOn/noteOff、模型切换、预置加载、复音数变更等）。异步但灵活。
- **不使用 SharedArrayBuffer**：需要 COOP/COEP 头部，部署复杂度高，且本项目不需要微秒级参数同步。
- 具体参数分类需要后续细化（在 UI 实现时确定哪些参数需要实时平滑）。

### 3. 采样率管理 → 动态获取

**决策：在 `process()` 首次调用时从 `sampleRate` 全局变量获取采样率，传递给所有 DSP 组件。**

- AudioWorklet 的 `sampleRate` 全局变量在 Processor 生命周期内不变
- Waveguide 延迟线长度 = `sampleRate / minFreq`，动态计算
- Partial 的 a1LUT 需要基于实际采样率初始化
- 所有频率计算使用采样率归一化

### 4. 内存管理 → 构造器预分配

**决策：在 Processor 构造器中预分配所有内存，`process()` 中零分配。**

- 16 个 Voice 对象在构造器中创建，每个包含 2×64=128 个 Partial + Waveguide 延迟线
- 所有 Float64Array/Float32Array 在构造器中分配
- `process()` 中只读写预分配的数组，不创建任何新对象
- 返回 `true` 保持 Processor 存活
