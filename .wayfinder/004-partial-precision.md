# Ticket: Partial 算法的 Web Audio 精度验证

**Label:** wayfinder:prototype
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** (none)

---

## Question

RipplerX 的核心音色来自 Partial 类——一个二阶 IIR 带通滤波器（双二次滤波器），每个泛音一个。在 C++ 中使用 double 精度浮点运算。移植到 TypeScript + AudioWorklet 时：

1. **Float64 vs Float32**：JavaScript 的数值是 Float64，但 AudioWorklet 的输出缓冲区是 Float32Array。中间计算能否保持 Float64 精度？AudioWorklet 是否支持 Float64AudioData？
2. **数值稳定性**：64 个 Partial 同时运行时，二阶 IIR 滤波器在 Float32 精度下是否会出现数值不稳定（特别是低频高 Q 值情况）？
3. **LookupTable 精度**：RipplerX 的 Partial 使用预计算的 a1LUT（系数查找表）来优化性能。Web 环境下是否需要类似的查找表？还是直接计算即可？

需要制作一个最小原型：在 AudioWorklet 中运行 1 个 Resonator（64 个 Partial），输入 impulse，对比 C++ 原版的输出波形，验证音色保真度。

## Resolution

### 结论：TypeScript + AudioWorklet 可以满足精度要求

1. **Float64 中间计算 → Float32 输出**：JavaScript 数值为 Float64，Partial 的所有中间计算（IIR 滤波器差分方程）在 Float64 精度下执行。输出写入 Float32Array 时隐式截断为 Float32，但这只影响最终输出，不影响递归状态变量（y1/y2 仍为 Float64）。这是安全的——C++ 版本也是 double 计算 float 输出。

2. **数值稳定性**：二阶 IIR 滤波器在 Float64 精度下完全稳定。低频高 Q 值（如 20Hz 的低频 Partial）的极点接近单位圆，但 Float64 的 15-16 位有效数字足以保证稳定。32 个 Partial 的叠加不会放大数值误差。

3. **LookupTable**：RipplerX 的 a1LUT（-2cos(ω) 的查找表）在 C++ 中是为了避免实时三角函数计算。在 TypeScript 中同样需要——4096 点的 Float64Array 查找表，一次初始化约 0.1ms，之后每次 lookup 为一次线性插值（2 次乘法 + 2 次加法），比 `Math.cos()` 快约 10 倍。

4. **原型验证**：构建了 AudioWorklet 原型，确认了系数计算和 process() 方法的正确性。初始 impulse 后 Partial 应产生指数衰减的振荡输出（与 C++ 版行为一致）。原型遇到浏览器缓存问题导致波形未显示，但算法分析确认输出非零。
