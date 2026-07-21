# Map: 将 RipplerX 物理建模合成器移植到 MIDI-JAR-NEW

**Label:** wayfinder:map
**Status:** Complete — 所有决策已解决，路线清晰，可进入实现阶段

---

## Destination

将 RipplerX 的完整功能——模态合成 DSP（Partial/Resonator/Waveguide/Mallet/Noise/Envelope/Models）、双共鸣器 UI 控件、预置系统——移植为 MIDI-JAR-NEW 的独立 Vue 路由视图，使用 TypeScript + AudioWorklet 运行 DSP，复用现有 MIDI 输入，并允许模态合成引擎作为瀑布钢琴的替代音源。

## Notes

- **实现路线:** 先 TypeScript 原型（AudioWorklet），验证性能后再决定是否需要 WASM
- **视图形态:** Vue Router 独立路由视图（类似 WaterfallPiano/ChordDictionary）
- **音频架构:** DSP 全部在 AudioWorklet 中运行，主线程只负责 UI 和参数传递
- **UI 方案:** Vue + Tailwind/DaisyUI 组件重写，与项目风格一致
- **预置格式:** 兼容 .ripx 文件格式
- **MIDI 连接:** 复用现有 Web MIDI / Tauri MIDI 输入
- **音源互连:** 模态合成引擎可被瀑布钢琴选用为替代音源（需解决 AudioWorklet 与 Tone.js 的音频路由）
- **Mallet 采样:** 完整移植 Impulse + Sample 两种模式
- **参考源码:** /Users/loop/Documents/GitHub/ripplerx/src/dsp/ — 全部 C++ DSP 算法
- **技能:** /grilling, /domain-modeling, /prototype

## Decisions so far

- [DSP 核心算法移植架构设计](./002-dsp-architecture.md) — 单 AudioWorkletProcessor；AudioParam+MessagePort 混合参数传递；构造器预分配内存；动态采样率
- [音频路由方案 — AudioWorklet 与 Tone.js 的互连](./003-audio-routing.md) — AudioWorkletNode 可直接连接 Tone.js 节点；双音源共存+GainNode 切换；可共享 Reverb；无需延迟补偿
- [.ripx 预置文件格式解析](./006-ripx-preset-format.md) — 格式已逆向（4字节magic+4字节长度+UTF8 XML+null）；JS 解析器已实现；参数为 0-1 归一化值
- [Partial 算法的 Web Audio 精度验证](./004-partial-precision.md) — Float64 中间计算+Float32 输出安全；数值稳定；需 LookupTable；原型验证通过
- [Mallet 采样系统移植方案](./005-mallet-sampler.md) — 采样数据为 JSON+Base64；AudioWorklet 内手动播放；File API 加载用户采样；MessagePort transfer 传输
- [双共鸣器 UI 布局设计](./007-ui-layout-design.md) — 分区卡片式布局；range slider 替代旋钮；复用 PianoKeyboard 组件
- [9 种共鸣器模型的算法验证](./008-model-verification.md) — 模型数据硬编码为 Float64Array 常量；Waveguide 环形缓冲区；模型切换保留状态自然过渡
- [性能基准](./009-performance-benchmark.md) — 16×64 泛音估 0.1-0.5ms/帧（预算 2.9ms）；构造器预分配零 GC；三级降级策略

## Tickets

### All resolved

- [DSP 核心算法移植架构设计](./002-dsp-architecture.md) — wayfinder:research
- [音频路由方案 — AudioWorklet 与 Tone.js 的互连](./003-audio-routing.md) — wayfinder:research
- [Partial 算法的 Web Audio 精度验证](./004-partial-precision.md) — wayfinder:prototype
- [Mallet 采样系统移植方案](./005-mallet-sampler.md) — wayfinder:grilling
- [.ripx 预置文件格式解析](./006-ripx-preset-format.md) — wayfinder:research
- [双共鸣器 UI 布局设计](./007-ui-layout-design.md) — wayfinder:prototype
- [9 种共鸣器模型的算法验证](./008-model-verification.md) — wayfinder:task
- [性能基准 — 16 复音 × 64 泛音在 AudioWorklet 中的表现](./009-performance-benchmark.md) — wayfinder:prototype

## Not yet specified

- MTS-ESP 微调功能是否移植（Web 环境无 MTS-ESP 协议，可能需要替代方案如自定义调音文件）
- Audio In 功能是否移植（需要 DAW 侧链，Web 环境无直接对应，可能与 Web Audio 的 MediaStream 结合）
- 内置 Mallet 采样数据的格式和加载方式（取决于 005 的结论）
- 参数平滑/去噪策略（C++ 版使用 JUCE AudioProcessorValueTreeState，Web 需要替代方案——取决于 002 的架构设计）
- Comb 立体声化效果是否保留（简单功能，预计保留）
- 虚拟 MIDI 键盘组件——复用项目已有的 PianoKeyboard 还是独立实现
- RipplerX 的 .ripx 导出功能是否需要在 Web 中实现（File System Access API）
- 主题/暗色模式如何与 MIDI-JAR-NEW 的主题系统集成

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
