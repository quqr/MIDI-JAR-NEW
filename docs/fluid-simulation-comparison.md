# 流体模拟项目对比分析

对比对象：

- **项目 A**：`F:\Codes\Fluid-Simulation`（PavelDoGreat 的 Zig 开源重写版）
- **项目 B**：本项目 `F:\Codes\MIDI-JAR-NEW` 的流体模块（移植自 WebGL-Fluid-Simulation）

> 三者同源：均来自 PavelDoGreat 的 Fluid Simulation 系列作品。项目 A 是作者用 Zig 重写的下一代版本；项目 B 的流体代码移植自作者的 WebGL-Fluid-Simulation（MIT），并深度集成进钢琴瀑布可视化。

---

## 一、总体定位

| 维度   | 项目 A：Fluid-Simulation                           | 项目 B：MIDI-JAR-NEW 流体模块                  |
| ------ | -------------------------------------------------- | ---------------------------------------------- |
| 作者   | PavelDoGreat                                       | 移植自 PavelDoGreat（MIT）                     |
| 目标   | 跨平台流体 App 下一代重写（Web/macOS/iOS/Android） | 为钢琴瀑布可视化提供流体背景特效               |
| 语言   | Zig（编译为 WASM / 原生可执行）                    | TypeScript                                     |
| 成熟度 | **早期骨架阶段**，核心 `update()`/`draw()` 为空    | **生产可用**，完整 Navier-Stokes 求解 + 后处理 |
| 许可证 | MIT                                                | 遵循上游 MIT                                   |

### 关键事实：项目 A 当前并无可用流体实现

- `src/fluid/main.zig` 中 `export fn update()` 与 `export fn draw()` 均为空函数体。
- `src/fluid/shaders/shader.metal` 仅输出固定绿色 `float4(0.0, 1.0, 0.0, 1.0)`，是占位 fragment shader。
- `src/fluid/shaders/fluid (deprecated).glsl` 是带 `yolo` uniform 的脚手架测试代码，非真实流体着色器。
- `src/fluid/materials.zig` 中 `Bloom`、`Common` 结构体字段全部注释，`init()` 为空。
- 真正的流体算法（curl/vorticity/pressure/advection）尚未在 Zig 侧落地。

因此**不能从项目 A 直接借鉴流体算法实现**；其价值在于引擎架构与跨平台思路。

---

## 二、技术栈与图形后端

| 维度         | 项目 A                                                                  | 项目 B                                                                             |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Web 运行方式 | Zig → WASM，JS 仅作加载器（`script.js` 调 `exports.start/update/draw`） | 原生 JS/TS，直接操作 WebGL                                                         |
| Web 图形 API | WebGL2（`getContext('webgl2')`）                                        | WebGL2 优先，**自动回退 WebGL1**                                                   |
| 桌面图形 API | Metal（macOS，Swift 桥接 `metal.swift`/`metal.zig`）                    | 无（仅 Web）                                                                       |
| 纹理精度     | 计划使用半浮点（代码中扩展检测被注释）                                  | 半浮点纹理 `RGBA16F/RG16F/R16F`，含格式降级逻辑                                    |
| 线性过滤     | 计划支持（被注释）                                                      | 运行时检测 `OES_texture_float_linear`，不支持时降级 `NEAREST` + `MANUAL_FILTERING` |
| 构建         | `zig build` + `xcrun metal/metallib` + `swiftc`                         | Vite + vue-tsc + vitest                                                            |

项目 B 的 [GLContext.ts](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/fluid/GLContext.ts) 实现了完整的格式探测与递归降级（[L138-L165](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/fluid/GLContext.ts#L138-L165)），这是项目 A 尚未实现的能力。

---

## 三、架构对比

### 项目 A：分层引擎 + 流体模块（未完成）

```
src/
├── engine/              跨平台引擎层
│   ├── application.zig  平台抽象
│   ├── graphics.zig     图形抽象（Material/RenderTarget，多为 stub）
│   ├── native.zig       原生入口
│   ├── math.zig / memory.zig / files.zig / debug.zig
│   └── darwin/          macOS Metal + Swift 桥接
│       ├── metal.zig / metal.swift
│       └── cocoa_osx.swift
├── fluid/               流体模块（核心为空）
│   ├── main.zig         start/update/draw（空）
│   ├── materials.zig    材质定义（全注释）
│   ├── library/resources.zig  仅加载 shader.metallib
│   └── shaders/
│       ├── shader.metal             绿色占位
│       └── fluid (deprecated).glsl  yolo 脚手架
└── your_project_goes_here/  用户项目模板
```

特点：模块互相 import（`importModulesToEachOtherAndToRoot`），强调"引擎与业务分离"。

### 项目 B：Pass 化模块架构（完整）

```
src/views/WaterfallPiano/engine/fluid/
├── FluidSimulation.ts     入口：渲染循环 + splat 注入 + 资源生命周期
├── FluidSolver.ts         Navier-Stokes 求解（8 步 pass 串联）
├── FramebufferManager.ts  FBO / DoubleFBO ping-pong 管理
├── GLContext.ts           WebGL 上下文 + 扩展检测 + 格式降级
├── GLUtils.ts             shader 编译 / Program / Material / blit
├── BloomPass.ts           Bloom 后处理（prefilter → blur → final）
├── SunraysPass.ts         Sunrays 后处理（mask → blur → composite）
├── DisplayPass.ts         最终显示（着色 + dithering + bloom/sunrays 合成）
├── FluidConfig.ts         配置 + 质量预设 + 风格预设 + 用户语义映射
├── index.ts               统一导出
└── shaders/               18 个着色器模块
    ├── baseVertex / blurVertex
    ├── advection / splat / pressure / curl / vorticity
    ├── divergence / gradientSubtract / clear / copy / color
    ├── display / checkerboard
    ├── bloomPrefilter / bloomBlur / bloomFinal
    └── sunraysMask / sunrays / blur
```

特点：每个后处理/求解步骤封装为独立 `Pass` 类，由 `FluidSimulation` 统一编排。`FluidSolver.step()`（[FluidSolver.ts#L182](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/fluid/FluidSolver.ts#L182)）严格按以下顺序执行：

1. `curl` — 计算涡度场
2. `vorticity` — 涡度 confinement 增强细节
3. `divergence` — 计算速度场散度
4. `clear` — 压力场衰减
5. `pressure` — Jacobi 迭代（`PRESSURE_ITERATIONS` 次）求解压力
6. `gradientSubtract` — 梯度减除使速度场无散
7. `advection`（velocity）— 速度场自平流
8. `advection`（dye）— 染料场平流

这是经典的 **Stable Fluids**（Jos Stam）算法，与 WebGL-Fluid-Simulation 一致。

---

## 四、着色器对比

| 着色器类别       | 项目 A                                   | 项目 B                                                                                  |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| 顶点着色器       | 无（metal 中硬编码 4 顶点全屏三角形）    | `baseVertex` / `blurVertex`                                                             |
| 流体求解（8 个） | **无**                                   | curl / vorticity / divergence / pressure / gradientSubtract / advection / splat / clear |
| 拷贝/颜色        | 无                                       | copy / color / checkerboard                                                             |
| 显示             | 无                                       | display（含 SHADING 关键字变体）                                                        |
| Bloom（3 个）    | 无（materials.zig 注释中提到 prefilter） | bloomPrefilter / bloomBlur / bloomFinal                                                 |
| Sunrays（2 个）  | 无                                       | sunraysMask / sunrays                                                                   |
| 模糊             | 无                                       | blur（7-tap 双向）                                                                      |

项目 B 的 [shaders/index.ts](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/fluid/shaders/index.ts) 统一导出 18 个着色器，`displayShaderSource` 使用 `Material` 类支持 `SHADING`/`BLOOM`/`SUNRAYS` 等 keyword 编译多变体。

项目 A 的 `shader.metal` 仅是验证 Metal 管线可通的占位，无任何流体计算逻辑。

---

## 五、集成模型对比

### 项目 A：独立流体应用

- 纯流体可视化，无外部数据源驱动。
- 输入仅来自鼠标/触摸（计划中，当前未实现）。
- 单 canvas 全屏渲染。

### 项目 B：嵌入钢琴可视化的流体背景

这是项目 B 最显著的差异点。流体不再是主角，而是**由 MIDI 事件驱动**的背景特效。

#### 4 层渲染架构（来自项目约束）

| 层                 | z-index | 内容                            |
| ------------------ | ------- | ------------------------------- |
| background div     | 0       | 纯色/渐变背景                   |
| fluid WebGL canvas | 1       | 流体模拟输出（透明合成）        |
| main canvas 2D     | 2       | 钢琴音符块（不透明 + 垂直渐变） |
| keyboard canvas 2D | 3       | 键盘 + 命中线（y=0 本地坐标）   |
| UI overlay         | 4       | 控件                            |

#### MIDI → 流体 splat 映射

[WaterfallEngine.ts](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/WaterfallEngine.ts) 实现两种发射模式：

1. **命中爆炸 `triggerHitExplosion`**（[L355-L380](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/WaterfallEngine.ts#L355-L380)）
   - 触发时机：音符命中命中线
   - 位置：`(midi-21)/87` 横向 + 命中线 y（**y 轴翻转** `1.0 - keyboardY/canvasHeight`）
   - 力：velocity 映射到 `dy`，随机 `dx`

2. **块体覆盖 `emitBlockCoverage`**（[L383-L430](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/WaterfallEngine.ts#L383-L430)）
   - 每帧遍历活跃块，**限流 MAX_PER_FRAME=8**（随机起点轮询避免偏置）
   - active 阶段强度 1.0，释放后降至 0.3 直至离屏
   - 块中心 + 随机扰动 → splat 坐标

#### 坐标系对齐（项目特有约束）

- WebGL 流体坐标 y 轴向上，Canvas 2D 钢琴坐标 y 轴向下。
- 所有 splat 注入处使用 `1.0 - cy/canvasHeight` 翻转 y，确保流体出现在键盘附近而非屏幕顶部。

#### 颜色映射

- `resolveSplatHue`（[L432-L436](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/WaterfallEngine.ts#L432-L436)）：用户可设 `splatColorHue` 统一色相，否则按 MIDI 音高映射 `(midi-21)/87`。

---

## 六、配置体系对比

### 项目 A

无任何运行时可配置参数暴露。`materials.zig` 中 Bloom/prefilter 字段全注释。

### 项目 B

[FluidConfig.ts](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/fluid/FluidConfig.ts) 提供三层配置：

#### 1. 底层 `FluidSimulationConfig`（24 个字段）

涵盖 SIM/DYE 分辨率、扩散率、压力迭代、涡度、splat 半径/力、Bloom、Sunrays 全套参数。

#### 2. 质量预设 `QUALITY_PRESETS`（low/medium/high）

按 GPU 能力分级 DYE/SIM 分辨率与后处理开关：

- low：DYE 256 / SIM 64，关闭 Bloom 与 Sunrays
- high：DYE 1024 / SIM 128，全开 Bloom + Sunrays

#### 3. 风格预设 `STYLE_PRESETS`（gentle/standard/turbulent）

通过 DENSITY/VELOCITY_DISSIPATION 与 CURL 控制视觉风格。

#### 4. 用户友好语义映射 `resolveConfig`

将 `FluidAdvancedParams`（camelCase 用户语义）映射到底层求解器参数：

| 用户旋钮                   | 底层映射                                       |
| -------------------------- | ---------------------------------------------- |
| `splatRadius`              | `SPLAT_RADIUS`（0.00001-0.01，步进 0.00001）   |
| `trailLength` (0-1)        | `DENSITY_DISSIPATION = (1-trailLength)*4`      |
| `flowPersistence` (0-1)    | `VELOCITY_DISSIPATION = (1-flowPersistence)*4` |
| `bloom` / `bloomIntensity` | 直接映射                                       |

此映射遵循项目约束：**不向用户暴露原始求解器变量名**（如 PRESSURE_ITERATIONS、CURL），避免混淆。

---

## 七、相同点

1. **同源算法**：均基于 Stable Fluids（Navier-Stokes + 半隐式平流 + Jacobi 压力求解 + 涡度 confinement），源自同一作者的实现哲学。
2. **GPU ping-pong 架构**：速度场与染料场均使用双缓冲 FBO 交替读写。
3. **半浮点精度**：依赖 `RGBA16F/RG16F/R16F` 半浮点纹理保证数值精度。
4. **Splat 输入模型**：通过在 (x,y) 注入 (dx,dy) 速度扰动 + 颜色染料驱动流体。
5. **后处理链**：Bloom（prefilter → 多级 blur → final 合成）+ Sunrays（mask → blur → 合成）。
6. **Web 目标**：都面向浏览器（项目 A 经 WASM，项目 B 经 JS）。
7. **DPR 缩放**：两者均按 `devicePixelRatio` 缩放 canvas 后备存储。

---

## 八、关键差异总结

| 差异点         | 项目 A                          | 项目 B                      |
| -------------- | ------------------------------- | --------------------------- |
| **实现完整度** | 空壳，无流体算法                | 完整可用                    |
| **语言范式**   | Zig（系统级，手动内存）         | TypeScript（GC）            |
| **图形后端数** | 2（Metal + WebGL2/WASM）        | 1（WebGL2，含 WebGL1 回退） |
| **跨平台**     | Web + macOS（计划 iOS/Android） | 仅 Web                      |
| **代码组织**   | 引擎/业务分层（Zig 模块互引）   | Pass 化（每步独立类）       |
| **数据驱动**   | 独立应用，鼠标输入              | MIDI 事件驱动，集成钢琴     |
| **配置暴露**   | 无                              | 三层（底层/预设/用户语义）  |
| **资源管理**   | Zig arena/GPA 分配              | WebGL context lose 释放     |
| **工程约束**   | 追求小体积/低功耗/快编译        | 追求 45fps+ 与自动降级      |

---

## 九、可借鉴之处

尽管项目 A 无可用流体实现，其架构思路对项目 B 仍有参考价值：

1. **Pass 抽象的方向正确**：项目 B 已将 Bloom/Sunrays/Display 拆为独立类，与项目 A 计划中的 `Material` + library group 思路一致，可继续巩固。
2. **跨后端抽象**：项目 A 的 `graphics.zig` 用 `comptime` 分派 Metal/WebGL，提示项目 B 若未来需支持 WebGPU，可借鉴同样的后端抽象层。
3. **资源生命周期**：项目 A 用 Zig allocator 显式管理；项目 B 目前依赖 `WEBGL_lose_context`，若需更精细的纹理/FBO 回收可参考其 arena 思路。
4. **不要重蹈暴露内部变量的覆辙**：项目 A 的 `materials.zig` 注释中曾想暴露 prefilter/downsample 等，项目 B 已通过 `FluidAdvancedParams` 用户语义层规避此问题（见项目 Lessons Learned）。

---

## 十、结论

- **项目 A 是"未来"的实验性骨架**，代表作者用 Zig 重写流体引擎的长期方向，但当前无可运行流体代码。
- **项目 B 是"现在"的生产实现**，完整移植并增强了 WebGL-Fluid-Simulation，且创新性地将其作为 MIDI 可视化的背景层，配以用户友好的配置体系与坐标系对齐方案。
- 两者不应被视为可互换的替代品：项目 B 的价值在于**与钢琴可视化的深度集成**，项目 A 的价值在于**跨平台引擎架构的探索**。若未来项目 B 需要原生端（如 Tauri 桌面端）更高性能，可参考项目 A 的 Metal 后端思路，但流体核心算法仍应沿用项目 B 当前已验证的实现。
