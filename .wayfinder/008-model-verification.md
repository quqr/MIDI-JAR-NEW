# Ticket: 9 种共鸣器模型的算法验证

**Label:** wayfinder:task
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** 004-partial-precision

---

## Question

RipplerX 的 Models 类定义了 9 种共鸣器模型的泛音频率比和增益：
- String, Beam, Squared, Membrane, Drumhead, Plate, Marimba, OpenTube, ClosedTube
- 加上 Marimba2, Bell, Djembe（共 12 种模型）

其中 String/Marimba/Marimba2 是谐波系列（整数倍频），其他模型有非谐波泛音。OpenTube 和 ClosedTube 使用 Waveguide（延迟线）而非 Partial。

需要验证：
1. **Models.cpp 的模型数据**：每个模型的 64 个泛音频率比是否可以直接硬编码到 TypeScript？还是需要动态计算（如 Membrane/Plate 受 Ratio 参数影响）？
2. **Waveguide 模型**：延迟线算法（环形缓冲区 + 线性插值读取）在 TypeScript 中的实现是否与 C++ 行为一致？
3. **模型切换实时性**：在演奏中切换模型时，是否需要平滑过渡？C++ 版如何处理？

需要逐个翻译 Models.cpp 中的模型数据，并在原型中验证每种模型的音色正确性。

## Resolution

1. **模型数据硬编码**：所有 12 种模型的 64 个泛音频率比可以直接硬编码为 Float64Array 常量。其中：
   - String, Marimba, Marimba2：纯谐波系列（整数倍频），ratio = [1, 2, 3, ..., 64] 或子集
   - Beam, Squared：ratio_k = k^2 / 1^2（平方关系）
   - Membrane, Drumhead, Plate：ratio 受 Ratio 参数影响，需要动态计算（2D/3D 模态频率公式）
   - Bell, Djembe：非谐波泛音，硬编码特定频率比
   - OpenTube, ClosedTube：使用 Waveguide 而非 Partial，不涉及频率比

2. **Waveguide 实现**：延迟线算法使用环形缓冲区（Float64Array）+ 线性插值读取。C++ 版本使用 `juce::AbstractFifo` 风格的读写指针，TypeScript 翻译为简单的模运算环形索引。在 AudioWorklet 中预分配缓冲区，每帧只读写，无内存分配。

3. **模型切换**：C++ 版在切换模型时直接更新所有 Partial 的参数（不清除状态），产生瞬态过渡。TypeScript 版本同样处理——切换时调用 `resonator.update()` 更新系数，保留 y1/y2 状态，允许自然过渡。
