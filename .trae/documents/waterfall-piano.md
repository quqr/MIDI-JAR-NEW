# 瀑布流交互式钢琴 — 实现计划（方案 C：功能分层 + 全屏沉浸式）

## Summary

在 MIDI-JAR 中新增「瀑布流钢琴」页面，采用**全屏沉浸式布局** + **三层渐进式架构**：

- **核心层**：全屏 Canvas 钢琴 + 基础音频 + 键盘交互
- **增强层**：粒子瀑布流 + MIDI 文件导入/播放 + 录制/回放
- **完善层**：背景自定义 + 粒子深度自定义 + 定制面板 + 无障碍 + 性能优化

钢琴键盘可选择显示/隐藏。

---

## 依赖版本

| 依赖           | 版本       | 用途                                           |
| -------------- | ---------- | ---------------------------------------------- |
| `pixi.js`      | `^8.19.0`  | 2D 渲染引擎（WebGL/WebGPU + 自动 Canvas 回退） |
| `tone`         | `^15.1.22` | Web Audio 合成音频框架                         |
| `@tonejs/midi` | `^2.0.28`  | MIDI 文件解析（Tone.js 官方 MIDI 解析库）      |

> 已有依赖：daisyui ^5.6.5、tailwindcss ^4.3.1、vue ^3.5.39、pinia ^3.0.4

---

## 布局设计

```
┌──────────────────────────────────────────┐
│                            [设置⚙] [⛶]  │  ← 右上角浮动按钮
│                                          │
│            全屏 PixiJS Canvas             │  ← 粒子 + 键盘共用
│         ┌──────────────────────┐         │
│         │  ~~~ particles ~~~   │         │  ← 粒子区域（键盘隐藏时占100%）
│         │                      │         │
│         ├──────────────────────┤         │  ← 可选拖拽调整分界线
│         │  ═══ keyboard ═══    │         │  ← 键盘区域（默认底部30%）
│         └──────────────────────┘         │
│  ┌────────────────────────────────────┐  │
│  │ ◀ ■ ▶  │ ♪ Grand Piano │ ⬆ MIDI │  │  ← 底部浮动控制条
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**布局特点**：

- Canvas 占满整个页面（减去导航栏高度），沉浸感最强
- 粒子在 Canvas 上半部分流动，键盘在底部
- 键盘区域可通过设置隐藏，隐藏后粒子占满整个 Canvas
- 控制条悬浮底部，毛玻璃半透明效果（`backdrop-blur`）
- 设置按钮打开 SettingsModal（复用现有 `SettingsModal` + `SettingsCollapse` 组件体系）

---

## 可定制化清单

### 1. 粒子效果自定义

| 参数       | 类型           | 可选值                                    | 说明                   |
| ---------- | -------------- | ----------------------------------------- | ---------------------- |
| 形状       | select         | circle / square / note / star             | 粒子外形               |
| 颜色方案   | select         | warm / cool / rainbow / neon / custom     | 音高→颜色映射          |
| 自定义颜色 | colorpicker ×3 | 低/中/高音区颜色                          | custom 方案时生效      |
| 速度       | range          | 0.5-5                                     | 粒子流动速度           |
| 大小       | range          | 2-30px                                    | 粒子基础大小           |
| 透明度     | range          | 0.1-1                                     | 粒子初始透明度         |
| 密度       | range          | 1-10                                      | 同时存在的粒子数量倍数 |
| 物理行为   | select         | linear / wave / spiral / random           | 粒子运动轨迹           |
| 重力       | range          | -2 到 2                                   | 正值向下拉，负值向上飘 |
| 拖尾效果   | toggle         | on/off                                    | 粒子留下渐隐轨迹       |
| 淡出曲线   | select         | linear / ease-in / ease-out / ease-in-out | 透明度衰减方式         |

### 2. 背景自定义

| 参数       | 类型           | 可选值                                       | 说明          |
| ---------- | -------------- | -------------------------------------------- | ------------- |
| 背景类型   | select         | solid / gradient / preset / image            | 背景来源      |
| 纯色       | colorpicker    | 任意颜色                                     | solid 类型    |
| 渐变方向   | select         | linear-vertical / linear-horizontal / radial | gradient 类型 |
| 渐变起止色 | colorpicker ×2 | 任意颜色                                     | gradient 类型 |
| 预设主题   | select         | night-sky / ocean / sunset / aurora / forest | 内置视觉主题  |
| 自定义图片 | file-input     | PNG/JPG/WEBP                                 | image 类型    |
| 图片模糊   | range          | 0-20px                                       | 背景模糊程度  |
| 图片暗化   | range          | 0-1                                          | 背景变暗程度  |

### 3. 键盘自定义

| 参数       | 类型        | 可选值                            | 说明                   |
| ---------- | ----------- | --------------------------------- | ---------------------- |
| 显示键盘   | toggle      | on/off                            | 是否显示钢琴键盘       |
| 键盘范围   | select      | 88键 / 61键 / 49键 / 自定义       | 键位数量               |
| 自定义范围 | input ×2    | 音名（如 C3, B5）                 | custom 时生效          |
| 按键标签   | select      | none / note / pitchClass / octave | 键上显示的文字         |
| 白键颜色   | colorpicker | 任意颜色                          |                        |
| 黑键颜色   | colorpicker | 任意颜色                          |                        |
| 按下颜色   | colorpicker | 任意颜色                          | 按键高亮色             |
| 键盘位置   | select      | bottom / top                      | 键盘在 Canvas 中的位置 |

### 4. 音频自定义

| 参数     | 类型   | 可选值  | 说明             |
| -------- | ------ | ------- | ---------------- |
| 音色预设 | select | 6种预设 | 见下方预设表     |
| 音量     | range  | 0-100   | 主音量           |
| 混响量   | range  | 0-100   | 混响湿信号比例   |
| 混响衰减 | range  | 0.5-5s  | 混响尾音长度     |
| 延音     | toggle | on/off  | 松键后音符持续   |
| 力度响应 | toggle | on/off  | 按键力度影响音量 |

### 5. MIDI 文件自定义

| 参数       | 类型           | 可选值              | 说明                |
| ---------- | -------------- | ------------------- | ------------------- |
| 播放速度   | range          | 0.25-4x             | 回放速度倍率        |
| 音轨选择   | multi-select   | MIDI 文件中的各音轨 | 选择显示/播放的音轨 |
| 音轨颜色   | colorpicker ×N | 每个音轨独立颜色    |                     |
| 循环播放   | toggle         | on/off              | 循环播放 MIDI       |
| 显示音符名 | toggle         | on/off              | 粒子上显示音名      |

---

## 音色预设

| 预设名         | Tone.js 实现                                                  | 说明          |
| -------------- | ------------------------------------------------------------- | ------------- |
| Grand Piano    | `PolySynth(Synth)` + ADSR(0.01, 0.3, 0.4, 1.0)                | 经典钢琴      |
| Electric Piano | `PolySynth(FMSynth)`                                          | FM 合成电钢琴 |
| Bright Piano   | `PolySynth(Synth)` + 高频 envelope                            | 明亮钢琴      |
| Mellow Piano   | `PolySynth(AMSynth)`                                          | 柔和钢琴      |
| Organ          | `PolySynth(Synth, {oscillator: {type: 'square'}})`            | 风琴          |
| Synth Pad      | `PolySynth(Synth, {oscillator: {type: 'sine'}})` + 长 release | 合成铺底      |

---

## 目录结构

```
src/views/WaterfallPiano/
├── WaterfallPiano.vue              # 主页面容器
├── types.ts                        # 所有类型定义
├── constants.ts                    # 默认值、预设、颜色方案
├── stores/
│   └── waterfallPiano.ts           # Pinia store（设置 + 录制数据持久化）
├── engine/
│   ├── WaterfallEngine.ts          # 主引擎：协调渲染与音频
│   ├── KeyboardRenderer.ts         # PixiJS 键盘渲染器
│   ├── ParticleSystem.ts           # 粒子系统（对象池 + 发射/更新/拖尾）
│   ├── BackgroundRenderer.ts       # 背景渲染（纯色/渐变/预设/图片）
│   ├── ObjectPool.ts               # 泛型对象池
│   └── NoteColorMapper.ts          # 音高→颜色映射（5种方案）
├── audio/
│   ├── AudioEngine.ts              # Tone.js 音频引擎
│   ├── PresetManager.ts            # 6种音色预设管理
│   └── Recorder.ts                 # 录制/回放
├── midi/
│   └── MidiFilePlayer.ts           # MIDI 文件解析 + 瀑布流播放
└── components/
    ├── WaterfallCanvas.vue         # PixiJS Canvas 容器 + ResizeObserver
    ├── ControlBar.vue              # 底部浮动控制条（录制/播放/导入MIDI）
    └── SettingsPanel.vue           # 设置面板（复用 Settings 组件体系）
```

---

## 三层实现详情

### ━━━ 第一层：核心层（Sprint 1-3）━━━

**目标**：全屏 Canvas 钢琴可弹奏 + 基础音频 + 键盘可显示/隐藏。

#### Sprint 1：基础骨架

1. 安装依赖：`npm install pixi.js@^8.19.0 tone@^15.1.22 @tonejs/midi@^2.0.28`
2. 创建目录结构、`types.ts`、`constants.ts`
3. Pinia store（`stores/waterfallPiano.ts`）— 复用 `src/helpers/storage.ts`
4. 路由（`src/router/index.ts`）+ i18n 键
5. `WaterfallPiano.vue` 主页面骨架

#### Sprint 2：音频引擎 + 键盘渲染

6. `AudioEngine.ts` — Tone.js 封装（`PolySynth` + `Reverb` + `Volume`）
7. `KeyboardRenderer.ts` — PixiJS `Graphics` 绘制白键/黑键
   - 键盘区域：Canvas 底部（可配置高度比例，默认 30%）
   - `getNoteX(midi)` → 琴键中心 X（粒子发射用）
   - `getNoteAtPoint(x, y)` → 点击检测
8. `WaterfallCanvas.vue` — PixiJS `Application` 初始化 + `ResizeObserver`
9. 键盘点击 → 音频播放
10. 电脑键盘输入 → 对应音符（A-K = C4-C5，Z/X 切换八度）

#### Sprint 3：设置面板 + 键盘开关

11. `SettingsPanel.vue` — 复用 `SettingsCollapse`、`SettingsToggle`、`SettingsRange`、`SettingsColorPicker`、`SettingsSelect`
12. 键盘显示/隐藏开关
13. 键盘范围、颜色、标签设置
14. 音色预设切换、音量、混响

> **核心层交付物**：全屏 Canvas 钢琴，可弹奏，有基础音色，键盘可显示/隐藏，有设置面板。

---

### ━━━ 第二层：增强层（Sprint 4-6）━━━

**目标**：粒子瀑布流 + MIDI 文件播放 + 录制/回放。

#### Sprint 4：粒子系统

15. `ObjectPool.ts` — 泛型对象池
16. `NoteColorMapper.ts` — 5 种颜色方案（warm/cool/rainbow/neon/custom）
17. `ParticleSystem.ts` — 粒子发射/更新/回收
    - 使用 PixiJS `Container` + `Graphics`
    - 对象池管理生命周期
    - 演奏模式：粒子从键盘向上流动
    - 支持圆形/方形/音符/星形
18. 物理行为：linear（直线）/ wave（波浪）/ spiral（螺旋）/ random（随机）

#### Sprint 5：MIDI 文件导入/播放

19. `MidiFilePlayer.ts`
    - 使用 `@tonejs/midi` 解析 .mid 文件
    - 提取音轨列表、音符事件、时间信息
    - 使用 `Tone.Transport.schedule` 精确调度回放
    - 每个音符触发时发射粒子（direction: 'down' 从顶部向下）
    - 支持音轨选择、播放速度调节、循环播放
20. `ControlBar.vue` 更新：
    - MIDI 导入按钮（文件选择）
    - 播放/暂停/停止
    - 播放速度滑块
    - 进度条

#### Sprint 6：录制/回放

21. `Recorder.ts`
    - 记录 noteOn/noteOff + 时间戳
    - 回放时粒子从顶部向下流动
    - 使用 `Tone.Transport.schedule` 精确调度
22. ControlBar 录制按钮（●REC / ■STOP）
23. 录制状态 badge（呼吸动画）

> **增强层交付物**：粒子随弹奏向上流动，可导入 MIDI 文件自动播放，可录制/回放。

---

### ━━━ 第三层：完善层（Sprint 7-9）━━━

**目标**：背景自定义 + 粒子深度自定义 + 无障碍 + 性能优化。

#### Sprint 7：背景自定义

24. `BackgroundRenderer.ts`
    - 纯色：`Graphics.rect` + `fill`
    - 渐变：`Graphics` + gradient fill（PixiJS 8 支持 `FillGradient`）
    - 预设主题：night-sky（深蓝+星点）、ocean（深蓝渐变）、sunset（橙紫渐变）、aurora（绿紫渐变）、forest（深绿）
    - 自定义图片：`Sprite.from(file)` + blur filter + darkening overlay
25. 设置面板背景标签页

#### Sprint 8：粒子深度自定义 + 拖尾

26. 粒子形状扩展：音符形状（自定义 Graphics path）、星形
27. 物理行为扩展：spiral（螺旋运动）、wave（正弦波轨迹）
28. 拖尾效果：每个粒子每帧复制一个半透明副本（或使用 PixiJS `Trail` 效果）
29. 淡出曲线：linear / ease-in / ease-out / ease-in-out
30. 设置面板粒子标签页

#### Sprint 9：无障碍 + 性能 + 视觉打磨

31. 无障碍 (WCAG 2.1 AAA)
    - `aria-label` / `aria-description` 所有交互元素
    - `aria-live="polite"` 播报当前音符/状态
    - 颜色对比度 ≥ 7:1
    - `prefers-reduced-motion`：禁用粒子，用静态色块
    - 高对比度模式
32. 性能优化
    - 对象池预分配（初始 100 粒子）
    - 质量档位：low(100) / medium(500) / high(1000+)
    - FPS 监控：低于 30fps 自动降级
    - `devicePixelRatio` 适配高分屏
33. 视觉打磨
    - 控制条毛玻璃效果（`backdrop-blur-md bg-base-100/60`）
    - 按钮 hover/active 状态
    - 面板展开/折叠：`<Transition>` + CSS transform
    - Canvas 背景与粒子的视觉层次感

---

## 主页面组件结构

```vue
<!-- WaterfallPiano.vue -->
<template>
  <div class="relative w-full h-full overflow-hidden">
    <!-- 全屏 Canvas -->
    <WaterfallCanvas ref="canvasRef" class="absolute inset-0" />

    <!-- 右上角浮动按钮 -->
    <div class="absolute top-4 right-4 z-10 flex gap-2">
      <button
        class="btn btn-circle btn-sm btn-ghost backdrop-blur-sm bg-base-100/30"
        @click="settingsOpen = true"
      >
        ⚙
      </button>
      <button
        class="btn btn-circle btn-sm btn-ghost backdrop-blur-sm bg-base-100/30"
        @click="toggleFullscreen"
      >
        ⛶
      </button>
    </div>

    <!-- 底部浮动控制条 -->
    <ControlBar class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10" />

    <!-- 设置模态框 -->
    <SettingsModal v-model="settingsOpen" :title="t('waterfallPiano.settings')">
      <SettingsPanel />
    </SettingsModal>
  </div>
</template>
```

**daisyUI 组件选型**：

| 元素          | 组件                                                                                               | 说明           |
| ------------- | -------------------------------------------------------------------------------------------------- | -------------- |
| 浮动按钮      | `btn btn-circle btn-sm btn-ghost` + `backdrop-blur`                                                | 设置/全屏按钮  |
| 控制条容器    | `card bg-base-100/60 backdrop-blur-md shadow-lg`                                                   | 毛玻璃悬浮条   |
| 录制/播放按钮 | `btn btn-circle`                                                                                   | 圆形图标按钮   |
| 录制状态      | `badge badge-error animate-pulse`                                                                  | 呼吸动画       |
| MIDI 导入     | `btn btn-ghost btn-sm` + hidden `<input type="file">`                                              | 文件选择       |
| 设置面板      | `SettingsCollapse` / `SettingsToggle` / `SettingsRange` / `SettingsSelect` / `SettingsColorPicker` | 复用现有组件   |
| 标签页        | `tabs tabs-bordered`                                                                               | 设置面板内分组 |
| 播放速度      | `range range-sm`                                                                                   | 滑块           |
| 进度条        | `progress`                                                                                         | MIDI 播放进度  |

---

## 键盘快捷键

| 按键            | 功能                |
| --------------- | ------------------- |
| A S D F G H J K | 白键 C4-C5          |
| W E T Y U       | 黑键 C#4-A#4        |
| Z / X           | 八度下移/上移       |
| Space           | 开始/停止录制       |
| Enter           | 播放/停止 MIDI 回放 |
| Escape          | 关闭设置面板        |
| O               | 切换键盘显示/隐藏   |
| ↑ / ↓           | 播放速度 +/-        |

---

## 文件清单

| 操作 | 文件路径                                                  | 层级 |
| ---- | --------------------------------------------------------- | ---- |
| 修改 | `src/router/index.ts`                                     | 核心 |
| 修改 | `src/locales/en.json`                                     | 核心 |
| 修改 | `src/locales/zh.json`                                     | 核心 |
| 修改 | `package.json`                                            | 核心 |
| 新增 | `src/views/WaterfallPiano/types.ts`                       | 核心 |
| 新增 | `src/views/WaterfallPiano/constants.ts`                   | 核心 |
| 新增 | `src/views/WaterfallPiano/stores/waterfallPiano.ts`       | 核心 |
| 新增 | `src/views/WaterfallPiano/WaterfallPiano.vue`             | 核心 |
| 新增 | `src/views/WaterfallPiano/components/WaterfallCanvas.vue` | 核心 |
| 新增 | `src/views/WaterfallPiano/engine/WaterfallEngine.ts`      | 核心 |
| 新增 | `src/views/WaterfallPiano/engine/KeyboardRenderer.ts`     | 核心 |
| 新增 | `src/views/WaterfallPiano/audio/AudioEngine.ts`           | 核心 |
| 新增 | `src/views/WaterfallPiano/components/SettingsPanel.vue`   | 核心 |
| 新增 | `src/views/WaterfallPiano/engine/ObjectPool.ts`           | 增强 |
| 新增 | `src/views/WaterfallPiano/engine/NoteColorMapper.ts`      | 增强 |
| 新增 | `src/views/WaterfallPiano/engine/ParticleSystem.ts`       | 增强 |
| 新增 | `src/views/WaterfallPiano/audio/PresetManager.ts`         | 增强 |
| 新增 | `src/views/WaterfallPiano/audio/Recorder.ts`              | 增强 |
| 新增 | `src/views/WaterfallPiano/midi/MidiFilePlayer.ts`         | 增强 |
| 新增 | `src/views/WaterfallPiano/components/ControlBar.vue`      | 增强 |
| 新增 | `src/views/WaterfallPiano/engine/BackgroundRenderer.ts`   | 完善 |

---

## 决策记录

| 决策      | 选择                              | 理由                                                      |
| --------- | --------------------------------- | --------------------------------------------------------- |
| 布局      | 全屏沉浸式                        | Canvas 占满页面，沉浸感最强；设置用 Modal 复用现有组件    |
| 粒子渲染  | PixiJS Container + Graphics       | ParticleContainer 不支持独立颜色/大小                     |
| 音频引擎  | Tone.js 15.1.22                   | PolySynth + Reverb + Transport                            |
| MIDI 解析 | @tonejs/midi 2.0.28               | Tone.js 官方 MIDI 解析库，与 Transport 无缝集成           |
| 设置面板  | SettingsModal + Settings 组件体系 | 复用现有 SettingsCollapse/Toggle/Range/Select/ColorPicker |
| 控制条    | 底部浮动毛玻璃                    | 不遮挡 Canvas，视觉层次感强                               |
| 键盘开关  | toggle in settings                | 用户可选择隐藏键盘，最大化粒子展示区                      |
| 构建策略  | 功能分层                          | 每层独立可交付，降低集成风险                              |

---

## Verification

### 核心层

- [ ] Canvas 占满页面（减去导航栏）
- [ ] 钢琴键盘正确渲染（白键/黑键比例）
- [ ] 鼠标点击 → 音频播放 + 键盘高亮
- [ ] 电脑键盘 → 对应音符
- [ ] 键盘显示/隐藏开关生效
- [ ] 设置面板可打开/关闭，选项即时生效

### 增强层

- [ ] 弹奏时粒子从键盘向上流动
- [ ] 导入 .mid 文件 → 解析成功 → 瀑布流播放
- [ ] MIDI 播放时粒子从顶部向下流动
- [ ] 音轨选择、播放速度调节生效
- [ ] 录制 → 回放正常
- [ ] 控制条所有按钮功能正常

### 完善层

- [ ] 5 种背景类型均可选择
- [ ] 粒子形状/颜色/物理行为可自定义
- [ ] 拖尾效果可开启/关闭
- [ ] Lighthouse Accessibility ≥ 95
- [ ] 60fps 流畅运行
- [ ] 1280px / 768px / 320px 布局正确
