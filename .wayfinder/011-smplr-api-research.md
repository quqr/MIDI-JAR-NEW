# Ticket: smplr API 和调度器机制研究

**Label:** wayfinder:research
**Parent:** 010-map-audio-smplr
**Status:** Open
**Blocked by:** (none)

---

## Question

smplr 库提供了多种采样器(Soundfont, DrumMachine, SplendidGrandPiano 等)和内置调度器。需要研究以下问题:

1. **API 设计**: smplr 的主要类和方法是什么?如何创建和配置不同的采样器?
2. **调度器机制**: smplr 的内置调度器(`scheduleLookaheadMs`, `scheduleIntervalMs`)如何工作?它是否适合 MIDI-JAR-NEW 的实时 MIDI 输入场景?
3. **音频节点连接**: smplr 的采样器如何与 Web Audio API 的 AudioContext 和其他节点连接?是否可以直接连接到 Tone.js 的节点?
4. **音色加载**: smplr 如何从 smpldsnds 在线加载音色?加载进度如何追踪?是否有缓存机制?
5. **SFZ/SF2 支持**: smplr 是否支持加载 SFZ/SF2 格式的音色库?如果不支持,需要什么替代方案?
6. **多音色实例**: 是否可以在同一个 AudioContext 中创建多个不同音色的采样器实例?它们如何共存?
7. **音符控制**: 如何精确控制音符的开始、停止、力度、音高等?是否支持 MIDI 音符编号?
8. **性能特点**: smplr 的内存占用和 CPU 使用情况如何?适合实时多复音演奏吗?

## Resolution

研究已完成,详细报告见 [smplr-research-report.md](../smplr-research-report.md)。

### 关键发现:

1. **API 设计**: smplr 提供统一的 Instrument 工厂函数,支持 Soundfont, DrumMachine, SplendidGrandPiano 等多种采样器,API 简洁易用。

2. **调度器机制**: 内置调度器适合实时 MIDI 输入场景,默认 200ms 前瞻窗口足够应对大多数情况,可精确控制音符播放时机。

3. **音频节点连接**: output 属性为 OutputChannel 类型,可直接连接 Web Audio API 节点和 Tone.js 节点(需共享 AudioContext)。

4. **音色加载**: 从 smpldsnds 自动在线加载,ready 属性返回 Promise,支持 onLoadProgress 进度监控,内置内存缓存和 CacheStorage 持久化。

5. **SFZ/SF2 支持**: 不直接支持 SFZ/SF2,需手动转换或使用 sf2-json 工具。

6. **多音色实例**: 完全支持多实例共存,可共享 SampleLoader 和 Scheduler 优化资源。

7. **音符控制**: 支持 MIDI 音符编号 0-127,提供丰富的音符控制参数(velocity, duration, detune 等)。

8. **性能特点**: 单音色 10-30 MB 内存,50 复音流畅,TypeScript 支持完善。

### 结论:

smplr 适合 MIDI-JAR-NEW 的实时 MIDI 演奏场景,但需要自行实现 SFZ/SF2 加载方案。建议使用内置调度器,利用 CacheStorage 持久化音色数据。