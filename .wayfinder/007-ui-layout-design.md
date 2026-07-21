# Ticket: 双共鸣器 UI 布局设计

**Label:** wayfinder:prototype
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** 006-ripx-preset-format

---

## Question

RipplerX 的 UI 布局包含：

- 顶部栏：Logo、主题切换、复音数、力度映射、预置选择、设置
- Noise 区域：滤波器类型、Mix、Res、Freq、Q、ADSR 包络（含 Tension）
- Mallet 区域：Mix、Resonance、Stiffness、Pitch、Filter、Key Tracking
- Resonator A/B：各自有 Model 选择、Partials 数、Decay、Damp、Tone、Hit、Release、Inharmonicity、Ratio、Cut、Radius
- Coupling：串/并联、Mix、Split
- Pitch：A/B Pitch、Bend
- Gain + VU Meter
- 虚拟 MIDI 键盘

在 Vue + Tailwind/DaisyUI 环境中如何设计这个布局？需要考虑：

1. **响应式设计**：RipplerX 原版是固定宽度桌面插件，Web 需要响应式
2. **旋钮组件**：DaisyUI 没有旋钮组件，是否需要自定义？还是用 range slider 替代？
3. **Tension 控制**：RipplerX 有自定义的 TensionCtrl（控制 ADSR 包络曲线形状），Web 版如何实现？
4. **虚拟键盘**：复用项目已有的 PianoKeyboard 组件还是重新实现？

需要产出 UI 布局的线框图或 HTML 原型。

## Resolution

1. **布局方案**：采用分区卡片式布局，从上到下依次为：
   - 顶部工具栏：Logo、预置选择器、复音数、力度映射开关
   - 主体区域（左右分栏或垂直堆叠）：
     - Noise 区：水平排列的滑块组（Filter Type 下拉、Mix/Res/Freq/Q 滑块、ADSR 4 段滑块 + Tension 滑块）
     - Mallet 区：Mix/Resonance/Stiffness/Pitch/Filter/KeyTracking 滑块
     - Resonator A/B 区：双面板设计，各自包含 Model 下拉、Partials 滑块、Decay/Damp/Tone/Hit/Release 滑块、Inharm/Ratio/Cut/Radius 滑块
     - Coupling 区：Serial/Parallel 切换、Mix/Split 滑块
   - 底部：Pitch A/B + Bend 滑块、Gain 滑块 + VU Meter、虚拟 MIDI 键盘

2. **旋钮组件**：使用 range slider（type="range"）配合 CSS 美化替代旋钮。自定义旋钮组件开发量大且 DaisyUI 不提供，range slider 功能等价且可访问性更好。后期可考虑用 Canvas 绘制旋钮。

3. **Tension 控制**：实现为 range slider，范围 [0, 1]，默认 0.5（线性）。0 = 指数衰减，1 = 对数衰减，0.5 = 线性。在 ADSR 包络中用于插值曲线形状。

4. **虚拟键盘**：复用项目已有的 PianoKeyboard 组件（`src/components/PianoKeyboard/`），通过 MIDI 事件接口与模态合成引擎连接。
