# UI 精炼用户体验重设计规范

> **设计哲学**：直觉优先，简洁有力，美观实用
> **核心原则**：每个页面只做一件事，每个操作只需一步，每个信息一目了然

---

## 设计原则

### 1. 直觉优先

- 用户无需思考就知道下一步该做什么
- 操作路径 ≤ 2 次点击到达核心功能
- 所有交互反馈在 150ms 内可见

### 2. 简洁有力

- 每个页面只有一个核心焦点
- 去除所有非必要元素，保留的每个元素都有明确目的
- 信息密度适中，留白充足

### 3. 美观实用

- 色彩：中性暖色基底 + 品牌色点缀（非纯黑白）
- 字体：清晰层级，大字号标题引导视线
- 卡片：柔和阴影 + 微圆角，有呼吸感

### 4. 渐进式呈现

- 默认显示最常用的功能
- 高级功能通过展开/点击访问
- 不 overwhelming 用户

---

## 色彩系统 — 严格遵循 DaisyUI 色彩规范

> **参考**：https://daisyui.com/docs/colors/
> **原则**：所有颜色使用 DaisyUI 语义色 class，不使用任何硬编码 hex 值

### 语义色映射

| 角色          | DaisyUI Class                    | 用途                   |
| ------------- | -------------------------------- | ---------------------- |
| 页面背景      | `bg-base-200`                    | 应用外层背景           |
| 卡片/容器背景 | `bg-base-100`                    | 内容容器、卡片         |
| 边框/分割线   | `border-base-300`                | 卡片边框、分割线       |
| 主文字        | `text-base-content`              | 标题、正文             |
| 辅助文字      | `text-base-content/60`           | 描述、标签             |
| 次要辅助      | `text-base-content/40`           | 占位符、禁用文字       |
| 品牌主色      | `bg-primary` / `text-primary`    | 主按钮、选中态、链接   |
| 品牌浅色      | `bg-primary/10` / `text-primary` | 图标容器背景、音高标签 |
| 品牌浅边框    | `border-primary/30`              | 悬停边框               |
| 成功色        | `bg-success` / `text-success`    | 正确反馈               |
| 成功浅色      | `bg-success/10`                  | 正确反馈背景           |
| 警告色        | `bg-warning` / `text-warning`    | 提示、♯ 高亮           |
| 错误色        | `bg-error` / `text-error`        | 错误反馈               |
| 错误浅色      | `bg-error/10`                    | 错误反馈背景           |
| 信息色        | `bg-info` / `text-info`          | ♭ 高亮、信息提示       |
| 中性背景      | `bg-base-200` / `bg-base-300`    | 进度条底色、标签背景   |

### 使用规则

1. **禁止硬编码颜色**：不使用 `#1A1A2E`、`#6366F1`、`#E8EAED` 等自定义色值
2. **使用 DaisyUI class**：`bg-primary`、`text-base-content`、`border-base-300` 等
3. **透明度修饰**：`/10`、`/20`、`/30`、`/40`、`/60`、`/70` 用于层级区分
4. **主题自动适配**：DaisyUI 语义色自动跟随主题切换（light/dark/cupcake/synthwave/forest）

---

## 页面 1：Home.vue — 首页仪表盘（极简版）

### 设计示意图

![Home 极简设计](https://aka.doubaocdn.com/s/S84Q1wR096)

### 用户体验目标

- **0.5 秒内** 理解页面用途
- **1 次点击** 进入任意功能模块
- **零干扰** — 无多余文字、无搜索框、无最近使用

### 布局

```
┌──────────────────────────────────────────────┐
│                                              │
│              MIDI-JAR                         │
│                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │  🎹  │  │  🎮  │  │  ⭕  │  │  📖  │    │
│  │和弦显示│  │和弦游戏│  │五度圈 │  │和弦词典│    │
│  └──────┘  └──────┘  └──────┘  └──────┘    │
│                                              │
│  ┌──────┐  ┌──────┐                         │
│  │  🔌  │  │  ⚙️  │                         │
│  │MIDI路由│  │  设置  │                         │
│  └──────┘  └──────┘                         │
│                                              │
└──────────────────────────────────────────────┘
```

### 设计细节

**品牌区域**

- 标题：`text-3xl sm:text-4xl font-bold tracking-tight text-base-content`
- **无副标题**（移除 "音乐学习工具箱"）
- **无搜索框**（移除搜索功能，减少干扰）
- **无背景装饰**

**模块卡片（极简网格）**

- 网格：`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-3xl mx-auto`
- 卡片：`bg-base-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-center`
- 图标：`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto`
  - 每个模块不同色：🎹 `bg-primary/10` 🎮 `bg-warning/10` ⭕ `bg-success/10` 📖 `bg-error/10` 🔌 `bg-info/10` ⚙️ `bg-base-200`
- 标题：`text-sm font-semibold text-base-content mt-3`
- **无描述文字**（移除每张卡片的描述）
- **无最近使用区域**（移除）
- **无搜索框**（移除）

### 交互流程

1. 用户打开应用 → 看到品牌名 + 6 个功能卡片
2. 点击卡片 → 直接进入对应功能

### 响应式

| 断点       | 布局     |
| ---------- | -------- |
| ≥ 1024px   | 4 列卡片 |
| 768-1023px | 3 列卡片 |
| < 768px    | 2 列卡片 |

---

## 页面 2：ChordDictionary.vue — 和弦词典（详情为中心）

### 设计示意图

![ChordDictionary 详情为中心设计](https://aka.doubaocdn.com/s/BVVJ1wR09B)

### 用户体验目标

- 和弦详情是 **核心展示内容**，占据最大视觉面积
- 和弦列表仅作为 **导航辅助**，视觉权重弱化
- **1 次点击** 从列表跳转到详情
- 详情面板始终可见（桌面端）

### 布局

```
┌──────────────────────────────────────────────────────────┐
│  [🔍 搜索]    根音: [C][C#][D][D#][E]...    [设置]      │
├──────────────┬───────────────────────────────────────────┤
│ 和弦列表     │  和弦详情（核心展示区）                      │
│ (弱化视觉)   │                                           │
│              │  ┌─────────────────────────────────────┐  │
│  Cmaj7  ●   │  │  Cmaj7                               │  │
│  Cmaj9       │  │  C  E  G  B                          │  │
│  Cm          │  │                                      │  │
│  Cm7         │  │  [钢琴键盘]                           │  │
│  Cm9         │  │                                      │  │
│  C7          │  │  [五线谱]                             │  │
│  C9          │  │                                      │  │
│  Cdim        │  │  音程: Root C | Maj3 E | Per5 G | ... │  │
│  Cdim7       │  │                                      │  │
│  ...         │  │  别名 | 替代 | 转位 | 相关            │  │
│              │  └─────────────────────────────────────┘  │
│              │                                           │
├──────────────┤                                           │
│ 品质筛选     │                                           │
│ [全部][大三] │                                           │
│ [小三][属]   │                                           │
│ [减][增]     │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### 设计细节

**顶部工具栏**

- `flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100`
- 搜索按钮：`btn btn-sm btn-ghost`
- 根音选择器：`flex gap-1` 按钮行
  - 按钮：`btn btn-xs` / `btn-primary`（选中）
- 设置按钮：`btn btn-sm btn-ghost btn-square`

**左栏 — 和弦列表（弱化视觉权重）**

- `w-48 flex-shrink-0 border-r border-base-300 p-3 hidden md:block overflow-y-auto`
- 品质筛选标签：`flex gap-1 flex-wrap mb-3`
  - 标签：`btn btn-xs` / `btn-primary`（选中）
- 和弦列表项：`space-y-0.5`
  - 项：`px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors`
  - 未选中：`text-base-content/70 hover:bg-base-200`
  - 选中：`bg-primary/10 text-primary font-semibold`
- **弱化策略**：
  - 列表项使用 `text-sm`（小字号）
  - 无边框、无阴影、无卡片样式
  - 紧凑间距 `space-y-0.5`、`py-1.5`
  - 仅文字，无图标、无音程预览

**右栏 — 和弦详情（核心展示区）**

- `flex-1 p-6 overflow-y-auto`
- 和弦名：`text-3xl font-bold text-base-content`
- 音高标签：`flex gap-2 mt-3`
  - 每个音：`w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center`
- 键盘区域：`mt-6 p-4 rounded-xl bg-base-200`
- 五线谱区域：`mt-6 p-4 rounded-xl bg-base-200`
- 折叠区：`mt-6 space-y-3`
  - 使用 `<details>` 原生折叠
  - 摘要：`text-sm font-semibold text-base-content/60 uppercase tracking-wider cursor-pointer hover:text-base-content`
  - 内容：`mt-3 space-y-2`

### 交互流程

1. 用户在顶部选择根音 → 左侧列表过滤
2. 用户在左侧品质标签筛选 → 列表进一步过滤
3. 点击左侧列表项 → 右侧详情面板展示完整和弦信息
4. 搜索按钮 → 弹出搜索下拉
5. 详情面板始终可见，无需额外点击展开

### 响应式

| 断点       | 布局                                |
| ---------- | ----------------------------------- |
| ≥ 1024px   | 左右两栏（列表+详情），详情始终可见 |
| 768-1023px | 左右两栏（列表窄+详情宽）           |
| < 768px    | 单栏，列表为可收起面板，详情全屏    |

---

## 页面 3：ChordDisplay.vue — 和弦显示（右侧统一面板）

### 设计示意图

![ChordDisplay 右侧统一面板布局](https://aka.doubaocdn.com/s/LrwU1wR092)

### 用户体验目标

- 和弦名称与和弦信息 **整合为统一模块**，固定在右侧
- 左侧 **专用于五线谱**，最大化谱面展示空间
- 钢琴键盘 **始终固定在底部**
- 所有信息 **一眼可见**

### 布局

```
┌──────────────────────────────────────────────────────┐
│ ┌─────────────────────┐ ┌──────────────────────────┐ │
│ │                     │ │  Cmaj7                    │ │
│ │                     │ │  C · E · G · B            │ │
│ │                     │ │                            │ │
│ │    五线谱区域       │ │  音程列表                  │ │
│ │    (VexFlow)        │ │  Root  C  ██████░░  0     │ │
│ │                     │ │  Maj3  E  ██████░░  4     │ │
│ │    左侧全宽         │ │  Per5  G  ██████░░  7     │ │
│ │                     │ │  Maj7  B  ██████░░  11    │ │
│ │                     │ │                            │ │
│ │                     │ │  备选: [Cmaj9][Cmaj13][C6] │ │
│ │                     │ │                            │ │
│ └─────────────────────┘ └──────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │              钢琴键盘 (固定底部)                   │ │
│ │      [==C#=D#===F#=G#=A#===]                    │ │
│ │      [C D E F G A B C D E F G A B]             │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 功能区域重组

**核心变更**：和弦名称显示区域与和弦信息详情面板 **整合为一个统一模块**，固定放置在界面右侧。

1. **左侧** — 五线谱（VexFlow），占据最大面积
2. **右侧** — 统一信息面板（和弦名称 + 音程 + 备选和弦）
3. **底部** — 钢琴键盘（固定）

### 设计细节

#### 1. 左侧 — 五线谱（VexFlow）

- `flex-1 min-w-0 p-4 rounded-xl bg-base-100 border border-base-300 shadow-sm`
- 容器内居中渲染 VexFlow
- 谱线颜色：`stroke-base-content/20`，音符颜色：`text-base-content`
- 支持缩放：`overflow-auto`
- PopOut 按钮：右上角

#### 2. 右侧 — 统一信息面板（和弦名称 + 详情）

- `w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4 p-5 rounded-xl bg-base-100 border border-base-300 shadow-sm`

**和弦名称（面板顶部）**

- 名称：`text-3xl font-bold tracking-tight text-base-content`
- 音高标签：`flex gap-2 mt-2`
  - 每个音：`w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center`
- 无 MIDI 输入时：`text-2xl text-base-content/40` "等待 MIDI 输入..."

**音程列表（面板中部）**

- `space-y-2 pt-4 border-t border-base-300`
- 每行：`flex items-center gap-3 py-1.5`
- 音程名：`w-16 text-sm font-medium text-base-content/60`
- 音高：`w-8 text-sm font-semibold text-base-content text-center`
- 进度条：`flex-1 h-2 rounded-full bg-base-200 overflow-hidden`
  - 填充：`h-full rounded-full bg-primary/20`，宽度 = 半音数/12 * 100%
- 半音数：`w-12 text-xs text-base-content/40 text-right`

**备选和弦（面板底部）**

- `flex gap-2 flex-wrap pt-4 border-t border-base-300`
- 标签：`text-xs text-base-content/40` "备选和弦"
- 按钮：`px-3 py-1 rounded-full text-xs font-medium border border-base-300 text-base-content/60 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer`
- 选中：`bg-primary text-primary-content border-primary`

#### 3. 钢琴键盘（固定底部）

- `flex-shrink-0 p-3 rounded-xl bg-base-100 border border-base-300 shadow-sm`
- 桌面：`sticky bottom-0`
- 手机：`fixed bottom-0 left-0 right-0 z-10 bg-base-100 border-t border-base-300`
- 白键：`bg-base-100`，黑键：`bg-base-content`，高亮：`bg-primary`

#### 4. VexFlow 渲染优化

| 优化项   | 方案                                                    |
| -------- | ------------------------------------------------------- |
| 渲染性能 | 实例缓存，仅 MIDI 变化时重绘                            |
| 视觉表现 | 谱线 `stroke-base-content/20`，音符 `fill-base-content` |
| 交互体验 | 鼠标滚轮缩放 + 拖拽平移                                 |
| 响应式   | 根据容器宽度自动调整缩放                                |
| 主题适配 | DaisyUI 语义色自动跟随主题                              |

### 交互流程

1. 用户弹奏 MIDI 键盘 → 右侧面板和弦名称即时更新
2. 音程进度条和音高标签同步更新
3. 左侧五线谱同步渲染当前和弦
4. 底部键盘高亮对应音符
5. 点击备选和弦 → 切换显示不同 voicing

### 响应式策略

| 断点                | 布局                              | 键盘位置          |
| ------------------- | --------------------------------- | ----------------- |
| **桌面 ≥ 1024px**   | 左右分栏（五线谱左 + 统一面板右） | `sticky bottom-0` |
| **平板 768-1023px** | 左右分栏（五线谱 60% + 面板 40%） | `sticky bottom-0` |
| **手机 < 768px**    | 上下垂直（面板在上，五线谱在下）  | `fixed bottom-0`  |

---

## 页面 4：ChordQuiz.vue — 和弦识别游戏

### 设计示意图

![ChordQuiz 精炼设计](https://aka.doubaocdn.com/s/984I1wQzhw)

### 用户体验目标

- **3 秒内** 理解游戏规则
- **即时反馈** 每个答案
- **零学习成本** 开始游戏

### 布局

```
┌──────────────────────────────────────────────┐
│                                              │
│  15/20    ████████████░░░░░░    02:30        │
│                                              │
│             请弹奏:                           │
│              Cmaj7                            │
│                                              │
│       ┌──────────────────────┐               │
│       │  ✓ 正确！            │               │
│       │  继续下一题...       │               │
│       └──────────────────────┘               │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [==C#=D#===F#=G#=A#===]            │    │
│  │  [C D E F G A B C D E F G A B]     │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  提示: 根音C + 大三度E + 纯五度G + 大七度B  │
│                                              │
│  [💡 提示]  [🔄 重新开始]  [⚙️ 设置]       │
└──────────────────────────────────────────────┘
```

### 设计细节

**顶部信息栏**

- `flex items-center justify-between px-4 py-3`
- 得分：`text-xl font-bold text-base-content` "15/20"
- 进度条：`flex-1 mx-4 h-1.5 rounded-full bg-base-200 overflow-hidden`
  - 填充：`h-full rounded-full bg-primary transition-all duration-300`
- 计时器：`text-sm font-mono text-base-content/60` "02:30"

**目标和弦**

- `text-center py-10`
- 标签：`text-sm text-base-content/60 mb-2` "请弹奏："
- 和弦名：`text-5xl font-bold tracking-tight text-base-content`

**反馈区域**

- 正确：`bg-success/10 border border-success/30 rounded-xl p-4 text-center`
  - 图标 + 文字：`text-lg font-semibold text-success` "✓ 正确！"
  - 副文：`text-sm text-base-content/60` "继续下一题..."
  - 500ms 后自动推进
- 错误：`bg-error/10 border border-error/30 rounded-xl p-4 text-center`
  - 图标 + 文字：`text-lg font-semibold text-error` "✗ 再试一次"
  - 提示：`text-sm text-base-content/60 mt-1` "缺少: 大七度 B"
  - 需手动点击"下一题"

**钢琴键盘**

- `mt-4 p-3 rounded-xl bg-base-100 border border-base-300 shadow-sm`

**提示文字**

- `text-sm text-base-content/60 italic text-center mt-3`

**操作按钮**

- `flex justify-center gap-3 mt-4`
- `px-4 py-2 rounded-lg text-sm font-medium transition-colors`
  - 提示：`bg-base-200 text-base-content/60 hover:bg-base-300`
  - 重新开始：`bg-base-200 text-base-content/60 hover:bg-base-300`
  - 设置：`bg-base-200 text-base-content/60 hover:bg-base-300`

### 交互流程

1. 用户看到目标和弦 → 在键盘上弹奏
2. 弹奏正确 → 绿色反馈 → 自动下一题
3. 弹奏错误 → 红色反馈 + 提示 → 手动下一题
4. 游戏结束 → 显示统计（正确率、平均用时、最佳连击）

### 响应式

- 桌面：完整布局
- 手机：键盘压缩，字号缩小

---

## 页面 5：CircleOfFifths.vue — 五度圈

### 设计示意图

![CircleOfFifths 精炼设计](https://aka.doubaocdn.com/s/5xH41wQzhy)

### 用户体验目标

- **1 次点击** 选择调性
- **即时** 看到调号和音阶
- **直观** 理解调性关系

### 布局

```
┌──────────────────────────────────────────────┐
│                                              │
│              ┌──────────┐                    │
│             ╱   C Major  ╲                   │
│            │    Am       │                   │
│           ╱              ╲                  │
│          │    G Major     │                  │
│         ╱      Em         ╲                 │
│        │                  │                 │
│       ╱      中心         ╲                │
│      │      C Major        │                │
│       ╲    无升降号       ╱                │
│        │                  │                 │
│         ╲    F Major     ╱                  │
│          │     Dm       │                   │
│           ╲            ╱                    │
│            │   Bb Major │                   │
│             ╲   Gm    ╱                     │
│              └──────────┘                    │
│                                              │
│  ┌── C Major ────────────────────────────┐   │
│  │  调号: 无升降                          │   │
│  │  C  D  E  F  G  A  B                  │   │
│  └────────────────────────────────────────┘   │
│                                              │
│  C  G  D  A  E  B  F#  C#  F  Bb  Eb  Ab    │
└──────────────────────────────────────────────┘
```

### 设计细节

**SVG 五度圈**

- `max-w-xl mx-auto`
- 扇形：`fill-primary/10`（大调）`fill-warning/10`（小调）
- 描边：`stroke-base-300 stroke-1`
- 选中：`stroke-primary stroke-2`
- 文字：`text-xs font-medium fill-base-content`
- 中心：当前调名 + 调号

**信息面板**

- `mt-6 p-4 rounded-xl bg-base-100 border border-base-300 shadow-sm`
- 调名：`text-xl font-bold text-base-content`
- 调号：`text-sm text-base-content/60 mt-1`
- 音阶：`flex gap-2 mt-3 flex-wrap`
  - 每个音：`w-8 h-8 rounded-full bg-base-200 text-sm font-medium text-base-content flex items-center justify-center`

**快速切换**

- `flex gap-2 mt-4 overflow-x-auto pb-1`
- 按钮：`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all`
  - 未选中：`bg-base-100 text-base-content/60 border border-base-300 hover:border-primary/30`
  - 选中：`bg-primary text-primary-content shadow-sm`

### 交互流程

1. 用户点击扇形 → 选中该调，信息面板更新
2. 悬停扇形 → 显示 tooltip（调名 + 调号）
3. 底部按钮 → 快速切换调性
4. 信息面板显示音阶 → 可点击音阶音符试听

### 响应式

| 断点    | 布局                       |
| ------- | -------------------------- |
| ≥ 768px | 完整圆环                   |
| < 768px | 缩小圆环，底部按钮横向滚动 |

---

## 页面 6：Settings 群组 — 设置面板

### 设计示意图

![Settings 精炼设计](https://aka.doubaocdn.com/s/O1W61wQzhy)

### 用户体验目标

- **1 次点击** 找到任意设置项
- **即时生效** 所有设置
- **清晰分组** 快速定位

### 布局

```
┌──────────┬───────────────────────────────────┐
│ 设置     │  通用设置                          │
│          │                                    │
│  通用    │  ┌─ 语言 ──────────────────────┐  │
│  和弦词典│  │  界面语言    [中文 ▼]       │  │
│  和弦显示│  └─────────────────────────────┘  │
│  和弦游戏│                                    │
│  五度圈  │  ┌─ MIDI ──────────────────────┐  │
│  记谱    │  │  输入设备  [Device 1 ▼]     │  │
│  光标    │  │  输出设备  [MIDI Synth ▼]   │  │
│  MIDI路由│  └─────────────────────────────┘  │
│  调试器  │                                    │
│  关于    │  ┌─ 主题 ──────────────────────┐  │
│  许可证  │  │  [☀️] [🌙] [🧁] [🌃] [🌲] │  │
│          │  └─────────────────────────────┘  │
└──────────┴───────────────────────────────────┘
```

### 设计细节

**侧边导航**

- `w-44 flex-shrink-0 border-r border-base-300 p-4 hidden md:block`
- 标题：`text-xs font-medium text-base-content/60 uppercase tracking-wider mb-4` "设置"
- 导航项：`px-3 py-2 rounded-lg text-sm transition-colors`
  - 未选中：`text-base-content/60 hover:bg-base-200 hover:text-base-content`
  - 选中：`bg-primary/10 text-primary font-medium`

**内容区域**

- `flex-1 p-6 overflow-y-auto max-w-2xl`
- 页面标题：`text-xl font-bold text-base-content mb-6`

**设置分组**

- `mb-6`
- 分组标题：`text-sm font-medium text-base-content/60 mb-3`
- 分组卡片：`bg-base-100 rounded-xl border border-base-300 divide-y divide-base-300`
- 设置项：`flex items-center justify-between px-4 py-3`
  - 标签：`text-sm text-base-content`
  - 控件：DaisyUI 标准（`select-sm`、`toggle-sm`）

**各设置页特色**

| 页面                    | 视觉特征                        |
| ----------------------- | ------------------------------- |
| GeneralSettings         | 中性，标准布局                  |
| ChordDictionarySettings | 品牌色调 `bg-primary/10` 标题   |
| ChordDisplaySettings    | 成功色调 `bg-success/10` 标题   |
| ChordQuizSettings       | 警告色调 `bg-warning/10` 标题   |
| CircleOfFifthsSettings  | 次要色调 `bg-secondary/10` 标题 |
| NotationSettings        | 标签页切换                      |
| CursorSettings          | 简短开关列表                    |
| Routing                 | 中性背景 `bg-base-200`          |
| Debugger                | 终端风格 `font-mono`            |
| About                   | 居中品牌展示                    |
| Licenses                | 搜索 + 列表                     |

### 交互流程

1. 用户点击侧边导航项 → 右侧内容切换
2. 设置项即时生效（toggle/select/range）
3. 需要重启的设置项标注 "需重启" badge

### 响应式

| 断点    | 布局                     |
| ------- | ------------------------ |
| ≥ 768px | 侧边导航 + 内容          |
| < 768px | 全屏内容，导航为顶部标签 |

---

## 页面 7：WidgetPage.vue — 桌面小部件

### 布局

```
┌─────────────────────┐
│  MIDI-JAR      [−]  │
├─────────────────────┤
│  Cmaj7              │
│  C  E  G  B         │
│                     │
│  Root:  C           │
│  Maj3:  E           │
│  Per5:  G           │
│  Maj7:  B           │
└─────────────────────┘
```

### 设计细节

- 标题栏：`bg-base-200 border-b border-base-300 px-3 py-1.5 text-xs font-medium text-base-content/60`
- 和弦名：`text-lg font-bold text-base-content`
- 音高标签：`flex gap-1 mt-1`
- 音程列表：`text-xs text-base-content/60 space-y-0.5 mt-2`

---

## 页面 8：ChordName.vue — 和弦名称组件

### 设计

```
C          maj7              /         G
font-bold  font-normal       text-     font-bold
text-      text-base-        base-     text-base-
base-      content/60        content/  content
content                     40
```

- 纯文本，无动画
- 根音：`font-bold text-base-content`
- 修饰符：`font-normal text-base-content/60`
- 分隔符 `/`：`text-base-content/40`
- ♯：`text-warning`（琥珀色）
- ♭：`text-info`（蓝色）
- Size prop：sm(`text-sm`) / md(`text-base`) / lg(`text-lg`) / xl(`text-xl`)

---

## 页面 9：PianoKeyboard.vue — 钢琴键盘

### 设计

- 白键：`bg-base-100 border-r border-base-300`
- 黑键：`bg-base-content`
- 高亮键：`bg-primary`
- 标签：`text-[10px] text-base-content/40`（可选）
- 无涟漪动画，无指法提示

---

## 页面 10：ModuleCard.vue — 导航卡片

### 设计

- 卡片：`bg-base-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer`
- 图标容器：`w-12 h-12 rounded-xl flex items-center justify-center text-2xl`
- 标题：`text-base font-semibold text-base-content mt-3`
- 描述：`text-xs text-base-content/60 mt-1`
- 无 `hover:scale`、无 `group-hover`、无弹性效果

---

## 页面 11：ChordCardGrid.vue — 和弦卡片网格

### 设计

- 卡片：`bg-base-100 rounded-xl border border-base-300 p-3 text-center hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer`
- 和弦名：`text-base font-bold text-base-content`
- 音程：`text-xs text-base-content/60 mt-1`
- 选中：`ring-2 ring-primary`
- 加载态：skeleton `rounded-xl bg-base-200 animate-pulse`（仅 skeleton 保留 pulse）

---

## 页面 12：ChordDetail.vue — 和弦详情

### 设计

- 和弦名：`text-2xl font-bold text-base-content`
- 音高标签：`flex gap-2 mt-3`
- 键盘区域：`mt-4 p-3 rounded-lg bg-base-200`
- 折叠区：`mt-4 space-y-2`
  - 使用 `<details>` 原生折叠
  - 摘要：`text-sm font-medium text-base-content/60 cursor-pointer hover:text-base-content`

---

## 页面 13：ChordCategoryTree.vue — 分类树

### 设计

- 标题：`text-xs font-medium text-base-content/60 uppercase tracking-wider mb-3`
- 分类项：`py-1.5 px-2 rounded-lg text-sm hover:bg-base-200 transition-colors cursor-pointer`
- 选中：`bg-primary/10 text-primary font-medium`
- 子类型：`py-1 px-2 text-xs text-base-content/60 hover:text-base-content`

---

## 页面 14：ChordSearch.vue — 和弦搜索

### 设计

- 触发按钮：`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-base-300 text-sm text-base-content/60 hover:border-primary/30 transition-colors`
- 下拉面板：`bg-base-100 border border-base-300 rounded-xl shadow-lg w-72`
- 输入框：`w-full px-3 py-2 text-sm border-b border-base-300 outline-none focus:border-primary`
- 选项：`px-3 py-2 text-sm hover:bg-base-200 cursor-pointer transition-colors`

---

## 页面 15：ChordQuiz 子组件

### GameList.vue

- 游戏项：`p-4 rounded-xl border border-base-300 hover:border-primary/30 transition-colors cursor-pointer`
- 标题：`text-base font-semibold text-base-content`
- 描述：`text-sm text-base-content/60 mt-1`

### Reaction.vue

- 纯文字居中：`text-center p-4`
- 反应图标：`text-6xl mb-2`
- 说明：`text-sm text-base-content/60`

---

## 页面 16：CircleFifths 子组件（13 个 SVG 文件）

### 通用设计

- 纯 SVG 元素
- 大调扇形：`fill-primary/10` 选中 `fill-primary/20`
- 小调扇形：`fill-warning/10` 选中 `fill-warning/20`
- 描边：`stroke-base-300 stroke-width="1"`
- 选中描边：`stroke-primary stroke-width="2"`
- 文字：`fill-base-content font-size="12" font-weight="500"`
- 无动画

---

## 页面 17：Settings 控件组件

| 组件                | 设计                                                          |
| ------------------- | ------------------------------------------------------------- |
| SettingsToggle      | `toggle toggle-sm` DaisyUI 标准                               |
| SettingsSelect      | `select select-bordered select-sm`                            |
| SettingsRange       | `range range-sm`                                              |
| SettingsRadioGroup  | `radio radio-sm`                                              |
| SettingsColorPicker | `input type="color" w-8 h-8 rounded cursor-pointer`           |
| SettingsTextInput   | `input input-bordered input-sm`                               |
| SettingsSection     | `mb-6` + 标题 `text-sm font-medium text-base-content/60 mb-3` |
| SettingsCollapse    | `<details>` + `rounded-xl border border-base-300 p-3`         |

---

## 页面 18：其他共用组件

| 组件                 | 设计                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Icon.vue             | `w-5 h-5` 标准尺寸                                                                        |
| NavButton.vue        | `px-3 py-1.5 rounded-lg text-sm hover:bg-base-200 transition-colors`                      |
| PopOutButton.vue     | `w-8 h-8 rounded-lg hover:bg-base-200 transition-colors flex items-center justify-center` |
| SettingsButton.vue   | 同 PopOutButton                                                                           |
| SettingsModal.vue    | DaisyUI `modal modal-middle`                                                              |
| InputNote.vue        | `input input-bordered input-sm` + `input-error`                                           |
| KeyScaleSelector.vue | 分段按钮 `flex rounded-lg border border-base-300 overflow-hidden`                         |
| ThemePicker/Switcher | `dropdown dropdown-end`                                                                   |
| ChordIntervals.vue   | 进度条 `h-2 rounded-full bg-base-200` + 填充 `bg-primary/20`                              |
| Notation.vue         | `rounded-xl bg-base-200 border border-base-300 p-2`                                       |
| DrawerOutlet.vue     | `<div class="drawer"><slot /></div>`                                                      |
| CustomCursor.vue     | 默认禁用                                                                                  |
| LatencyMonitor.vue   | `fixed bottom-4 right-4 bg-base-100/90 rounded-lg p-2 shadow-lg text-xs font-mono`        |

---

## 响应式策略总表

| 页面            | 桌面 ≥ 1024px                   | 平板 768-1023px           | 手机 < 768px                    |
| --------------- | ------------------------------- | ------------------------- | ------------------------------- |
| Home            | 4 列卡片                        | 3 列卡片                  | 2 列卡片                        |
| ChordDictionary | 左右两栏（弱化列表+详情核心）   | 左右两栏（列表窄+详情宽） | 单栏，列表可收起，详情全屏      |
| ChordDisplay    | 左右分栏（五线谱+右侧统一面板） | 左右分栏(60/40)           | 上下垂直，键盘 `fixed bottom-0` |
| ChordQuiz       | 全宽                            | 全宽                      | 键盘压缩                        |
| CircleOfFifths  | 完整圆环                        | 缩放圆环                  | 小圆环+横向滚动                 |
| Settings        | 侧边导航+内容                   | 侧边导航+内容             | 全屏+顶部标签                   |

---

## 交互反馈标准

| 操作     | 反馈                           | 时间           |
| -------- | ------------------------------ | -------------- |
| 按钮悬停 | 背景色变化 `hover:bg-base-200` | 150ms          |
| 卡片悬停 | 阴影变化 `hover:shadow-md`     | 150ms          |
| 按钮点击 | 无缩放反馈                     | -              |
| 选中态   | 品牌色高亮 `bg-primary`        | 即时           |
| 正确反馈 | 成功色背景 `bg-success/10`     | 500ms 自动消失 |
| 错误反馈 | 错误色背景 `bg-error/10`       | 手动关闭       |
| 路由切换 | 仅 opacity 过渡                | 100ms          |
| 设置变更 | 即时生效                       | 即时           |

---

## 移除清单

### 移除的装饰效果

- `backdrop-blur` 玻璃态
- `bg-gradient-to-br` 渐变光晕
- `hover:scale` / `translate` 弹性
- `hover:shadow-2xl` 夸张阴影
- `group-hover` 图标变色
- `animate-ripple` 涟漪
- Staggered 入场动画
- 弹簧弹性过渡

### 保留的动画

- `transition-colors duration-150` 颜色过渡
- `transition-shadow duration-150` 阴影过渡
- `hover:shadow-md` 悬停阴影
- `animate-pulse` skeleton 加载（仅 skeleton）

### 保留的功能

- 5 个主题（light, dark, cupcake, synthwave, forest）
- 主题切换 + `prefers-color-scheme`
- 和弦数据懒加载
- 设置 500ms 防抖
- i18n 国际化
- 共享图标映射
- Tauri API 类型安全
