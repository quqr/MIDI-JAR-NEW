# 流体颜色管线：完全对齐原版 HDR

PixiJS 移植版在 display 着色器中加入了 ACES 色调映射、LDR clamp、sunrays 加法、bloom 无 gamma，与原版 PavelDoGreat WebGL 流体模拟的 HDR 过曝发光风格严重偏离。我们决定完全对齐原版：移除色调映射，输出 `rgba16float`，bloom 加 `linearToGamma`，sunrays 改回乘法，着色不 clamp，输入颜色提升到 ~1.5 HDR 量级。

## 考虑过的选项

- **A（已选）完全对齐原版 HDR**：移除 `acdTonemap`，输出 `rgba16float`，bloom 加 `linearToGamma`，sunrays 改回 `c *= sunrays`，着色移除 `clamp(0,1)`，`colorMul` 提升到 ~1.5。重现原版标志性的过曝发光外观。
- **B 保留色调映射但修正其他项**：保留 `acdTonemap`（现代柔和观感），修正 sunrays/bloom/着色/输入颜色。输出保持 `rgba8unorm`。

## 后果

- 染料场输入颜色为 HDR（~1.5），亮值在 display 阶段自然裁剪到白，产生"发光"感。
- 输出 RT 为 `rgba16float`，Sprite 显示时 PixiJS 的 alpha 混合会将 >1 的值截断到 1。
- 深色背景下效果最佳；若未来 UI 背景变亮，可能需要重新评估。
- `FluidSplatManager` 的 `colorMul` 需要从 0.3-0.7 提升到 ~1.5 量级。
