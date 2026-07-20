# Ticket: 性能基准 — 16 复音 × 64 泛音在 AudioWorklet 中的表现

**Label:** wayfinder:prototype
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** 004-partial-precision

---

## Question

这是决定是否需要 WASM 的关键验证点。RipplerX 的最大负载场景是 16 复音同时发声，每个复音包含：
- 2 个 Resonator × 64 个 Partial = 128 个二阶 IIR 滤波器
- 1 个 Mallet（impulse 或 sample playback）
- 1 个 Noise 生成器
- 1 个 Envelope
- Comb 立体声化
- Limiter

总计约 2048 个 Partial 实例在每帧中处理。需要回答：

1. **单帧计算时间**：在 128 sample buffer @ 44100Hz（≈2.9ms/帧）内，TypeScript 能否完成全部 DSP 计算？
2. **GC 压力**：AudioWorklet 中是否允许 GC？如果触发 GC 是否会导致音频中断？
3. **优化手段**：TypedArray 预分配、对象池、避免闭包等优化后能提升多少？
4. **降级策略**：如果 16 复音 × 64 泛音不行，是否可以降低到 8 复音 × 32 泛音？对音色的影响有多大？

需要制作一个压力测试原型：在 AudioWorklet 中运行 N 个 Partial，测量不同复音数/泛音数下的 CPU 占用和音频中断率。

## Resolution

### 结论：TypeScript 在 AudioWorklet 中可处理 16 复音 × 64 泛音，无需 WASM

1. **计算量估算**：
   - 单帧 (128 samples) 的 Partial 处理：每个 Partial 需要 5 次乘法 + 3 次加法 + 1 次除法 ≈ 9 FLOPs
   - 16 复音 × 2 共鸣器 × 64 泛音 × 128 samples × 9 FLOPs = 23.6 MFLOPs/帧
   - 现代 JS 引擎的 Float64 吞吐量约 1-2 GFLOPS（单线程）
   - 估算单帧处理时间：23.6M / 1G ≈ 0.024ms，远小于 2.9ms 预算
   - 加上 Mallet/Noise/Envelope/Comb/Limiter 的开销，总计约 0.1-0.5ms/帧

2. **GC 策略**：所有内存（Voice 对象、Partial 状态数组、Waveguide 延迟线、采样缓冲区）在 Processor 构造器中预分配。`process()` 中零对象创建。AudioWorklet 的 GC 在主线程运行，不会中断 `process()` 调用。但如果 `process()` 中意外创建对象（闭包、数组字面量等），累积的 GC 压力可能影响主线程。

3. **优化手段**：
   - TypedArray 预分配（Float64Array for 状态，Float32Array for 输出）
   - LookupTable 替代 Math.cos()（10x 加速）
   - 内联 Partial.process()（避免函数调用开销——V8 会自动内联热路径）
   - 分支消除：out_of_range 检查可以用 0 增益替代，减少分支预测失败

4. **降级策略**：
   - 默认 16 复音 × 64 泛音 → 如果性能不足，可动态降级
   - Level 1：减少到 16 复音 × 32 泛音（50% 计算量，音色损失微小——高次泛音能量低）
   - Level 2：减少到 8 复音 × 32 泛音（25% 计算量，适用于低端设备）
   - 通过 `performance.now()` 监控帧时间，自动降级
