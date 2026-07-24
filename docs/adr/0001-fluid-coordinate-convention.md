# 流体模拟坐标系约定：调用方 Y向上，求解器 Y向下，边界转换

流体模拟移植到 PixiJS 后，`PixiFluidSolver` 及其着色器继承 PixiJS 原生的 Y向下约定（y=0 在顶部），但 `FluidSplatManager` 沿用原版 WebGL 参考实现的 Y向上约定（y=0 在底部，键盘在底部，正 dy = 向上喷涌）。我们在 `PixiFluidSimulation.splat()` 公共 API 边界做一次性转换（`yDown = 1 - yUp`，`dyDown = -dyUp`），让调用方保持直观的 Y向上语义，求解器保持地道的 PixiJS Y向下。

## 考虑过的选项

- **A（已选）边界转换**：在 `IFluidSimulation.splat()` 接缝处转换。调用方直观，求解器原生，改动最小。
- **B SplatManager 改用 Y向下**：翻转 4 个调用点。无需转换层，但负数=向上不直观。
- **C 翻转输出精灵 + 修改 advection**：与 PixiJS 原生约定对抗，每个采样 vTextureCoord 的着色器都有出新 bug 的风险。

## 后果

- `FluidSplatManager` 继续用 Y向上（`y = keyboardHeight / height` 表示从底部算的键盘顶部，`dy = 200` 表示向上喷涌）。
- `PixiFluidSimulation.splat()` 是唯一的转换点，任何新调用方只需说 Y向上。
- 若未来直接调用 `PixiFluidSolver.splat()`，需自行传 Y向下坐标。
