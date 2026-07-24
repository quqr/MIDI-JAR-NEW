# 流体对比测试页面：双侧对称诊断与公平对比架构

添加 `/fluid-compare` 页面，左侧渲染原始 WebGL 流体模拟（`FluidSimulation`），右侧渲染 PixiJS 移植版（`PixiFluidSimulation`），两侧共享同一份 `FluidSimulationConfig`。页面内置深度诊断面板，用于定位 PixiJS 版异常。

## 考虑过的选项

### 页面实现方式
- **A（已选）项目内 FluidSimulation 实例化**：两侧均从项目引擎层实例化，共享 `FluidConfig`，对比公平。
- **B iframe 嵌入原始项目**：无需移植，但跨域通信复杂，配置无法实时同步，无法做深度诊断。

### 渲染循环驱动
- **A（已选）手动 requestAnimationFrame**：两侧均用 rAF 驱动，`autoStart: false`，FPS 对比公平。
- **B PixiJS Ticker**：更符合 PixiJS 惯例，但 Ticker 有自己的时间步进和 maxFPS 机制，与 rAF 的 FPS 不完全对齐。

### 深度诊断策略
- **A（已选）双侧对称插桩 + 采样节流**：在两侧 solver 的 8 个子步骤加 `performance.now()` 计时；每 30 帧 readPixels 采样 dye 纹理中心 1 像素；记录 splat 参数链路（含 Y 翻转转换）；记录后处理 pass 状态。
- **B 仅表层指标**：只记录 FPS/dt/splatCount，无法定位 shader/纹理管线问题。
- **C 每帧采样**：readPixels 每帧执行，数据最完整但 GPU→CPU 回读会 stall 管线，影响 FPS 对比公平性。

### Y 坐标约定
两侧面板均使用 Y向上约定（y=0 在底部，正 dy=向上）。`PixiFluidSimulation.splat()` 内部做 Y向上→Y向下 转换（`yDown = 1 - yUp`，`dyDown = -dyUp`），见 ADR-0001。诊断 log 中记录的 splat 参数以「用户输入空间」（Y向上）为准，PixiJS 侧额外记录转换后的值。

## 后果

- 引擎层新增 `getDiagnostics()` 方法和 step 计时字段，不改变现有公共 API 签名。
- 诊断采样每 30 帧执行一次 readPixels，对 FPS 影响可忽略（<0.5ms）。
- 两侧渲染驱动方式完全相同（手动 rAF），FPS 差异仅反映引擎本身性能。
- 日志面板三栏 tab（帧指标/Solver 耗时/诊断）实时显示最新对比数据，同时输出到浏览器控制台。
