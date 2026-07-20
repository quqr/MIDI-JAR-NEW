# Ticket: Mallet 采样系统移植方案

**Label:** wayfinder:grilling
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** (none)

---

## Question

RipplerX 的 Mallet 有两种模式：
- **Impulse**：简单的单位脉冲通过带通滤波器（已明确移植方案）
- **Sample**：基于采样的锤击声，支持 10 个内置采样 + 1 个用户自定义文件

Sample 模式的移植需要决定：

1. **内置采样数据来源**：RipplerX 的内置采样是 JUCE 二进制资源（编译时嵌入）。Web 环境下如何存储和加载这些采样数据？Base64 编码的 JSON？单独的音频文件？
2. **采样播放引擎**：RipplerX 的 Sampler 类使用线性/三次插值播放原始 PCM 数据。Web Audio 的 AudioBufferSourceNode 不支持变速播放 + 自定义插值。是否需要在 AudioWorklet 中手动实现采样播放？
3. **用户自定义采样**：如何让用户加载音频文件？使用 File API + AudioContext.decodeAudioData() 解码后传输到 AudioWorklet？
4. **采样数据传输**：从主线程将采样 PCM 数据传到 AudioWorklet 的最佳方式？通过 MessagePort 的 ArrayBuffer transfer？还是 SharedArrayBuffer？

## Resolution

1. **内置采样数据**：将 RipplerX 的内置采样数据（10 个）提取为独立的 JSON 文件（Float64Array 的 Base64 编码），放在 `src/audio/modal-dsp/samples/` 目录下。运行时加载 JSON，解码为 Float64Array，通过 MessagePort 传到 AudioWorklet。

2. **采样播放引擎**：在 AudioWorklet 中手动实现采样播放（线性插值读取），不复用 Web Audio 的 AudioBufferSourceNode。RipplerX 的 Sampler 类使用简单的位置指针 + 线性插值，翻译为 TypeScript 约 20 行代码。支持循环播放和变速播放（通过改变增量步长）。

3. **用户自定义采样**：使用 File API 让用户选择文件 → AudioContext.decodeAudioData() 解码 → 提取 Float32Array PCM 数据 → 通过 MessagePort transfer ArrayBuffer 传到 AudioWorklet。AudioWorklet 内部将 Float32 上采样为 Float64（RipplerX 使用 double 精度的采样数据）。

4. **采样数据传输**：使用 MessagePort + ArrayBuffer transfer（零拷贝传输）。不使用 SharedArrayBuffer（需要 COOP/COEP 头部）。对于单次传输的采样数据（通常 < 1MB），MessagePort transfer 的性能完全足够。
