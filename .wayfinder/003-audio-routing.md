# Ticket: 音频路由方案 — AudioWorklet 与 Tone.js 的互连

**Label:** wayfinder:research
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** (none)

---

## Question

当模态合成引擎需要被瀑布钢琴视图使用时，AudioWorklet 的输出如何与 Tone.js 的音频图（FMSynth → Reverb → Destination）互连？具体需要研究：

1. **AudioWorkletNode → Tone.js 节点**：Tone.js 内部使用 Web Audio API 的 AudioContext，AudioWorkletNode 的输出能否直接 connect() 到 Tone.js 的 ToneAudioNode？还是需要通过 MediaStreamDestination 等中间环节？
2. **双音源切换策略**：用户在 FMSynth 和模态合成之间切换时，是创建/销毁 AudioWorkletNode，还是保持两个音源同时存在只切换输入？
3. **混响共享**：模态合成引擎是否可以接入 Tone.js 的 Reverb 节点？还是需要自己实现混响？
4. **延迟对齐**：AudioWorklet 和 Tone.js 的音频路径延迟不同，是否需要补偿？

这是"可互连"决策落地的关键技术点。

## Resolution

### 1. AudioWorkletNode → Tone.js → 可以直接连接

**结论：AudioWorkletNode 继承自 AudioNode，可以与 Tone.js 节点互连。**

Tone.js 的 `connect()` 方法最终会递归展开 ToneAudioNode 到原生 AudioNode，然后调用原生 `AudioNode.connect()`。AudioWorkletNode 作为 AudioNode 子类，天然兼容。

连接方式：
```typescript
// 获取 Tone.js 使用的原生 AudioContext
const rawCtx = Tone.getContext().rawContext;

// 创建 AudioWorkletNode（必须在同一 AudioContext 中）
const workletNode = new AudioWorkletNode(rawCtx, 'modal-synth');

// 连接到 Tone.js 的 Reverb 节点
workletNode.connect(toneReverb.input);
```

关键点：必须使用 `Tone.getContext().rawContext` 创建 AudioWorkletNode，确保在同一 AudioContext 中。

### 2. 双音源切换 → 保持两个音源同时存在

**决策：FMSynth 和模态合成引擎同时存在，通过路由切换。**

- 两个音源都连接到一个切换节点（GainNode 或自定义 Router）
- 切换时：当前音源 gain → 0，新音源 gain → 1，用 `linearRampToValueAtTime` 平滑过渡
- 避免创建/销毁 AudioWorkletNode（会引入延迟和可能的点击声）
- 切换延迟约 10-20ms（足够平滑且不突兀）

### 3. 混响共享 → 可以共享

**结论：模态合成引擎可以接入 Tone.js 的 Reverb 节点。**

```typescript
const workletNode = new AudioWorkletNode(rawCtx, 'modal-synth');
const dryGain = rawCtx.createGain();
const wetGain = rawCtx.createGain();

// dry path
workletNode.connect(dryGain);
dryGain.connect(rawCtx.destination);

// wet path (through Tone.js Reverb)
workletNode.connect(toneReverb.input);
```

但注意：模态合成引擎自带 Limiter，需要在 Reverb 之前或之后处理信号流。

### 4. 延迟对齐 → 无需特殊补偿

**结论：AudioWorklet 和 Tone.js 在同一 AudioContext 中运行，调度由浏览器统一管理，延迟差异可忽略。**

AudioWorklet 的 `process()` 回调与 Tone.js 的内部调度器在同一个渲染线程中顺序执行。两者共享同一个 AudioContext 的时钟，不存在需要补偿的延迟差异。
