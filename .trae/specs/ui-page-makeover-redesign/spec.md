# UI 逐页全细节重设计规范 v3 — 含设计示意图

> **设计哲学**：「一页一世界」— 功能驱动布局，差异化视觉身份，装饰最小化，细节全覆盖
> **覆盖范围**：99 个 `.vue` 文件，每个文件独立设计，覆盖布局、色彩、排版、间距、状态、交互、响应式

---

## 总体设计语言

### 统一规则

| 属性     | 取值                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| 背景色   | `bg-base-300`（应用外层），`bg-base-100`（页面内容）                              |
| 卡片容器 | `bg-base-100 border border-base-200 rounded-lg shadow-sm`                         |
| 间距     | `gap-4` ~ `gap-6`，内边距 `p-4 sm:p-6`                                            |
| 字号     | 标题 `text-lg font-semibold`，正文 `text-sm`，辅助 `text-xs text-base-content/60` |
| 过渡     | 仅 `transition-colors duration-150`，无 transform 动画                            |
| 悬停     | `hover:bg-base-200` 或 `hover:border-primary/30`                                  |
| 选中     | `ring-2 ring-primary` 或 `bg-primary text-primary-content`                        |

### 移除清单

- ❌ `backdrop-blur` 玻璃态、`bg-gradient-to-br` 光晕
- ❌ `hover:scale` / `translate` / `shadow-2xl` 弹性效果
- ❌ `animate-pulse` / `animate-ripple` / `@keyframes` 动画
- ❌ Staggered 交错入场、弹簧弹性过渡
- ❌ 半透明叠加背景 (`bg-base-100/60`)

---

## 页面 1：Home.vue — 首页仪表盘

### 设计示意图

![Home 首页仪表盘设计](https://aka.doubaocdn.com/s/RbUG1wQzSs)

### 布局结构

```
┌──────────────────────────────────────────────────┐
│                 MIDI-JAR                          │
│            🎵 音乐工具箱                          │
│         ┌──────────────────────┐                  │
│         │  搜索模块... (input)  │                  │
│         └──────────────────────┘                  │
│                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ 和弦显示  │  │ 和弦游戏  │  │ 五度圈   │           │
│  │  🎹      │  │  🎮      │  │  ⭕      │           │
│  └─────────┘  └─────────┘  └─────────┘           │
│                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ 和弦词典  │  │ 路由设置  │  │ 调试工具  │           │
│  └─────────┘  └─────────┘  └─────────┘           │
│                                                    │
│  最近使用: [Cmaj7] [Am] [G7]                       │
└──────────────────────────────────────────────────┘
```

### 设计细节

**Hero 区域**

- 无渐变光晕背景（移除 `from-primary/5 via-transparent to-accent/5`）
- `py-8 sm:py-12 mb-6 bg-base-100` 纯色
- 品牌标题：`font-[RocherColorGX] text-3xl sm:text-4xl lg:text-5xl tracking-wide text-base-content`
- 副标题：`text-base-content/60 text-sm sm:text-base`

**搜索框**

- `input input-bordered w-full max-w-md mx-auto`
- 聚焦：`focus:ring-2 focus:ring-primary/30`
- 300ms debounce，Enter 跳转 `/chord-dictionary/{query}`

**模块卡片网格**

- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr px-4`
- 卡片：`bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-shadow duration-150`
- 图标容器：`w-14 h-14 rounded-2xl bg-primary/10 text-primary flex-shrink-0`（静态，无 hover 变色）
- 标题：`text-lg font-semibold truncate`
- 描述：`text-sm text-base-content/70 line-clamp-2`

**最近使用区域**

- `v-if="recentModules.length"` 条件渲染
- 标题：`text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-3`
- 项目：`flex-shrink-0 px-4 py-2 bg-base-100 border border-base-200 rounded-lg text-sm cursor-pointer hover:border-primary/30 transition-colors`

**状态**

| 状态       | 表现                                    |
| ---------- | --------------------------------------- |
| 正常       | 网格展示所有模块卡片                    |
| 搜索无结果 | 空状态提示 `text-base-content/40 py-16` |
| 无最近使用 | 不渲染最近使用区域                      |

---

## 页面 2：ChordDictionary.vue — 和弦词典

### 设计示意图

![ChordDictionary 三栏布局设计](https://aka.doubaocdn.com/s/HU6B1wQzSu)

### 布局结构（桌面三栏）

```
┌──────────┬───────────────────────────┬─────────────┐
│ 分类树    │  和弦卡片网格              │  详情面板    │
│           │                           │             │
│  ── Major │  ┌─────┐ ┌─────┐ ┌─────┐ │  Cmaj7     │
│    Maj    │  │ Maj │ │ Maj7│ │maj9 │ │  C E G B   │
│    Maj7   │  └─────┘ └─────┘ └─────┘ │             │
│    maj9   │                           │  [键盘图]   │
│  ── Minor │  ┌─────┐ ┌─────┐        │             │
│    m      │  │ m   │ │ m7  │        │  [五线谱]   │
│    m7     │  └─────┘ └─────┘        │             │
│    m9     │                           │  别名/替代  │
│           │  C  C#  D  D#  E  F ...   │             │
│           │  (根音按钮行)              │             │
└──────────┴───────────────────────────┴─────────────┘
```

### 设计细节

**左栏（分类树）**

- `w-56 lg:w-60 flex-shrink-0 border-r border-base-200 p-4 hidden md:block overflow-y-auto`
- 树标题：`text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-3`
- 分类项：`py-1.5 px-2 rounded-md hover:bg-base-200 text-sm`
- 选中：`bg-primary/10 text-primary font-semibold`
- 子类型：`py-1 px-2 text-xs rounded hover:bg-base-200 text-base-content/70`
- 使用 details 原生箭头（无自定义 ▶）

**中栏（卡片网格）**

- `flex-1 p-4 overflow-y-auto`
- 根音选择器行：`flex items-center gap-2 mb-4 flex-wrap`
- 根音按钮：`btn btn-xs btn-ghost` / `btn-primary`（选中）
- 卡片网格：`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`
- 卡片：`w-full h-28 bg-base-100 rounded-xl border border-base-200 shadow-sm`
  - 内容居中：和弦名 `text-lg font-bold` + 音程 `text-xs text-base-content/50`
  - 悬停：`hover:border-primary/30`
  - 选中：`ring-2 ring-primary`
- 加载态：skeleton `h-28 rounded-xl` × 12

**右栏（详情面板）**

- `w-96 flex-shrink-0 border-l border-base-200 p-4 hidden lg:block overflow-y-auto`
- 非 fixed 抽屉，固定面板
- 容器：`p-4 border border-base-200 rounded-lg`
- 折叠面板：原生 `<details>`（非 `collapse collapse-arrow`）
- 摘要：`text-sm font-semibold text-base-content/80 uppercase tracking-wide`

**移动端**

- 底部标签栏：`md:hidden fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-200`
- 三个标签：分类 / 和弦 / 详情
- 选中：`text-primary font-semibold`

**工具栏**

- `bg-base-100 border-b border-base-200`（无 `sticky`）
- 分组下拉：`btn btn-sm btn-outline` + `bg-base-100 border border-base-200 rounded-lg shadow-lg`
- 交互模式：分段按钮 `border border-base-200 overflow-hidden`

---

## 页面 3：ChordDisplay.vue — 和弦显示

### 设计示意图

![ChordDisplay 垂直监控面板设计](https://aka.doubaocdn.com/s/dCpy1wQzSv)

### 布局结构

```
┌──────────────────────────────────────────┐
│                                          │
│            Cmaj7                         │
│         (超大字号, 居中)                  │
│                                          │
├──────────────────────────────────────────┤
│          五线谱 (VexFlow)                │
│  𝄢  𝄚  𝄞  𝄡  𝄢  𝄚  𝄞                   │
├──────────────────────────────────────────┤
│  音程列表                                │
│  Root  C   ████████████████░░░░          │
│  Maj3  E   ████████████████░░░░          │
│  Per5  G   ████████████████░░░░          │
│  Maj7  B   ████████████████░░░░          │
├──────────────────────────────────────────┤
│          钢琴键盘                         │
│  [==C#=D#===F#=G#=A#===]               │
│  [C D E F G A B C D E F G A B]        │
├──────────────────────────────────────────┤
│  备选和弦: [Cmaj9] [Cmaj13] [C6] ...     │
└──────────────────────────────────────────┘
```

### 设计细节

**纯垂直布局（无 splitpanes）**

- `flex flex-col gap-4 p-4 max-w-[1200px] mx-auto`
- 所有区域使用 `p-4 border border-base-200 rounded-lg`

**和弦名称**

- `text-4xl sm:text-5xl font-bold tracking-tight text-center py-6`
- 无 MIDI 输入时：`text-base-content/30` "等待 MIDI 输入..."

**五线谱区域**

- `p-4 border border-base-200 rounded-lg`
- VexFlow 渲染容器

**音程列表**

- 每行：`flex items-center gap-3 py-1`
- 音程名：`w-20 text-sm text-base-content/70`
- 音高：`text-sm font-mono`
- 进度条：`h-1.5 bg-base-200 rounded-full overflow-hidden` + 填充 `bg-primary/30`

**钢琴键盘**

- `p-4 border border-base-200 rounded-lg`
- 标准键盘样式（白键 `bg-white dark:bg-gray-700`，黑键 `bg-gray-900 dark:bg-gray-800`）

**备选和弦**

- 横向滚动：`flex gap-2 overflow-x-auto pb-2`
- 按钮：`flex-shrink-0 px-4 py-2 border border-base-200 rounded-lg text-sm hover:border-primary/30 transition-colors`
- 选中：`ring-2 ring-primary`

---

## 页面 4：ChordQuiz.vue — 和弦识别游戏

### 设计示意图

![ChordQuiz 游戏界面设计](https://aka.doubaocdn.com/s/q2661wQzSx)

### 布局结构

```
┌──────────────────────────────────────────┐
│  15/20   第 7/20 题        02:30         │
│  ████████████████░░░░░░░░░░ (进度条)     │
│                                          │
│           Cmaj7                          │
│         (目标和弦, 超大)                  │
│                                          │
│       ┌──────────────────────┐           │
│       │   ✓ 正确！           │           │
│       └──────────────────────┘           │
│      或                                │
│       ┌──────────────────────┐           │
│       │   ✗ 错误: 少了大七度  │           │
│       └──────────────────────┘           │
│                                          │
│        钢琴键盘                          │
│  [==C#=D#===F#=G#=A#===]               │
│  [C D E F G A B C D E F G A B]        │
│                                          │
│  提示: 根音C 大三度E 纯五度G 大七度B    │
│                                          │
│  [提示]  [重新开始]  [设置]              │
└──────────────────────────────────────────┘
```

### 设计细节

**信息栏**

- `flex justify-between items-center w-full`
- 得分：`text-2xl font-mono text-base-content`
- 进度：`text-sm text-base-content/60`
- 计时器：`text-sm font-mono text-base-content/60`

**进度条**

- `w-full h-1 bg-base-200 rounded-full overflow-hidden`
- 填充：`h-full bg-primary rounded-full transition-all duration-300`

**目标和弦**

- `text-4xl font-bold tracking-wider text-center py-8`

**反馈区域**

- 正确：`bg-success/10 ring-2 ring-success p-4 rounded-lg text-center`
  - 文字：`text-lg font-semibold text-success` "✓ 正确！"
  - 500ms 后自动下一题
- 错误：`bg-error/10 ring-2 ring-error p-4 rounded-lg text-center`
  - 文字：`text-lg font-semibold text-error` "✗ 错误"
  - 提示：`text-sm text-base-content/70 mt-1`
  - 需手动点击下一题

**提示文字**

- `text-sm text-base-content/70 italic`

**操作按钮**

- `flex gap-3`
- `btn btn-outline btn-sm` / `btn btn-ghost btn-sm`

---

## 页面 5：CircleOfFifths.vue — 五度圈

### 设计示意图

![CircleOfFifths 五度圈设计](https://aka.doubaocdn.com/s/PDWL1wQzSz)

### 布局结构

```
┌──────────────────────────────────────────┐
│                                          │
│              ┌──────────┐                │
│             ╱  C Major   ╲               │
│            │    Am       │               │
│           ╱   G Major    ╲              │
│          │      Em       │              │
│         ╱    D Major     ╲             │
│        │       Bm        │             │
│       ╱                  ╲             │
│      │      中心信息区     │             │
│       ╲                  ╱             │
│        │      F#m       │              │
│         ╲    B Major    ╱              │
│          │    G#m      │               │
│           ╲  F# Major  ╱               │
│            │   D#m    │                │
│             ╲        ╱                 │
│              └──────────┘              │
│                                          │
│  ┌── 信息面板 ────────────────────────┐  │
│  │  C Major    调号: 无升降           │  │
│  │  C  D  E  F  G  A  B              │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [C] [G] [D] [A] [E] [B] [F#] [C#] ...  │
└──────────────────────────────────────────┘
```

### 设计细节

**SVG 五度圈**

- `max-w-2xl w-full mx-auto`
- 扇形填充：纯色（`fill-primary/20` / `fill-base-200`）
- 描边：`stroke-base-content/20`
- 选中扇形：`stroke-primary stroke-2`
- 文本：`text-xs font-medium fill-base-content`
- 无光晕环、无 `animate-pulse`、无动画

**信息面板**

- `w-full max-w-2xl mx-auto mt-6 p-4 border border-base-200 rounded-lg`
- 调名：`text-xl font-bold`
- 调号：`text-sm text-base-content/70`
- 音阶标签：`px-2 py-1 bg-base-200 rounded text-sm`

**快速切换**

- `flex gap-2 overflow-x-auto mt-4 pb-2 max-w-2xl w-full`
- 按钮：`flex-shrink-0 px-3 py-1.5 text-sm border border-base-200 rounded-lg hover:border-primary/30 transition-colors`
- 选中：`bg-primary text-primary-content border-primary`

---

## 页面 6：ChordDisplayAddModal.vue — 和弦添加模态框

### 布局

```
┌──────────────────────────────────────┐
│        添加显示和弦        [关闭]     │
├──────────────────────────────────────┤
│                                      │
│  和弦名称: [___________________]     │
│                                      │
│  根音:     [C ▼]                     │
│  品质:     [maj7 ▼]                  │
│                                      │
│  预览:     Cmaj7                     │
│                                      │
│  [取消]              [添加]           │
└──────────────────────────────────────┘
```

### 设计细节

- 标准模态框：`modal modal-middle` + `modal-box`
- 标题：`font-bold text-lg`
- 表单控件：DaisyUI 标准（`select select-bordered select-sm`、`input input-bordered input-sm`）
- 预览区域：`border border-base-200 rounded-lg p-4`

---

## 页面 7：ChordDisplaySettings.vue — 和弦显示设置

### 布局

```
┌──────────────────────────────────────────┐
│  显示设置                                 │
│                                           │
│  ┌─ 启用的显示模块 ────────────────────┐  │
│  │                                      │  │
│  │  和弦名称        [●]  [编辑] [删除]  │  │
│  │  钢琴键盘        [●]  [编辑] [删除]  │  │
│  │  五线谱          [○]  [编辑] [删除]  │  │
│  │  音程列表        [●]  [编辑] [删除]  │  │
│  │                                      │  │
│  │  [+ 添加显示模块]                    │  │
│  └──────────────────────────────────────┘  │
│                                           │
│  ┌─ 外观设置 ──────────────────────────┐  │
│  │                                      │  │
│  │  键盘起始键    [C ▼]                │  │
│  │  八度范围      [−] 2 [+]             │  │
│  │  显示标签      [●]                   │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- 绿色调暗示：`border-success/20` 边框装饰
- 列表项：`flex items-center justify-between p-3 border border-base-200 rounded-lg`

---

## 页面 8：ChordDictionarySettings.vue — 和弦词典设置

### 布局

```
┌──────────────────────────────────────────┐
│  和弦词典设置                             │
│                                           │
│  ┌─ 显示选项 ─────────────────────────┐  │
│  │                                      │  │
│  │  默认分组方式  [按品质 ▼]           │  │
│  │  默认根音      [C ▼]                │  │
│  │  显示音程      [●]                   │  │
│  │  交互模式      [检测] [弹奏]        │  │
│  └──────────────────────────────────────┘  │
│                                           │
│  ┌─ 预览 ──────────────────────────────┐  │
│  │                                      │  │
│  │  [和弦卡片预览区域]                  │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- 蓝色调暗示：`border-info/20`
- 分段按钮选择器

---

## 页面 9：ChordQuizSettings.vue — 和弦游戏设置

### 布局

```
┌──────────────────────────────────────────┐
│  游戏设置                                 │
│                                           │
│  ┌─ 难度设置 ─────────────────────────┐  │
│  │                                      │  │
│  │  难度         [简单] [中等] [困难]  │  │
│  │  题目数量     [−] 20 [+]             │  │
│  │  时间限制     [−] 120s [+]           │  │
│  └──────────────────────────────────────┘  │
│                                           │
│  ┌─ 内容设置 ─────────────────────────┐  │
│  │                                      │  │
│  │  包含转位      [●]                   │  │
│  │  包含七和弦    [●]                   │  │
│  │  包含九和弦    [○]                   │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- 橙色调暗示：`border-warning/20`

---

## 页面 10：CircleOfFifthsSettings.vue — 五度圈设置

### 布局

```
┌──────────────────────────────────────────┐
│  五度圈设置                               │
│                                           │
│  ┌─ 显示选项 ─────────────────────────┐  │
│  │                                      │  │
│  │  显示小调      [●]                   │  │
│  │  显示调式      [●]                   │  │
│  │  显示升降号    [●]                   │  │
│  └──────────────────────────────────────┘  │
│                                           │
│  ┌─ 颜色配置 ─────────────────────────┐  │
│  │                                      │  │
│  │  大调颜色      [■ #4A90D9]          │  │
│  │  小调颜色      [■ #E67E22]          │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- 紫色调暗示：`border-secondary/20`

---

## 页面 11：GeneralSettings.vue — 通用设置

### 布局

```
┌──────────────────────────────────────────┐
│  通用设置                                 │
│                                           │
│  ┌─ 语言和区域 ───────────────────────┐  │
│  │                                      │  │
│  │  语言          [中文 ▼]             │  │
│  └──────────────────────────────────────┘  │
│                                           │
│  ┌─ MIDI 设置 ────────────────────────┐  │
│  │                                      │  │
│  │  输入设备     [Device 1 ▼]          │  │
│  │  输出设备     [MIDI Synth ▼]        │  │
│  └──────────────────────────────────────┘  │
│                                           │
│  ┌─ 主题设置 ─────────────────────────┐  │
│  │                                      │  │
│  │  主题         [🌙] [☀️] [🧁] ...    │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- `max-w-3xl mx-auto py-6 space-y-6`
- 分组：`p-4 border border-base-200 rounded-lg`
- 分组标题：`text-base font-semibold mb-4`
- 标签：`w-32 text-sm text-base-content/70 flex-shrink-0`
- 控件：DaisyUI 标准（`select select-bordered select-sm flex-1`）

---

## 页面 12：NotationSettings.vue — 记谱设置

### 布局

```
┌──────────────────────────────────────────┐
│  记谱设置                                 │
│                                           │
│  [布局]  [样式]   ← 标签页               │
│                                           │
│  ┌─ 布局设置 (选中标签页) ────────────┐  │
│  │                                      │  │
│  │  每行小节数  [−] 4 [+]              │  │
│  │  谱号        [高音谱号 ▼]           │  │
│  │  显示调号    [●]                     │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- 标签页：`flex border-b border-base-200`
- 选中：`border-primary text-primary font-semibold`
- 未选中：`border-transparent text-base-content/60 hover:text-base-content`

---

## 页面 13：CursorSettings.vue — 光标设置

### 布局

```
┌──────────────────────────────────────────┐
│  光标设置                                 │
│                                           │
│  启用自定义光标              [●]          │
│  跟随 MIDI 输入时显示        [●]          │
└──────────────────────────────────────────┘
```

### 设计细节

- 简短的两项开关列表
- 每项：`flex items-center justify-between p-4 border border-base-200 rounded-lg`

---

## 页面 14：Routing.vue — MIDI 路由

### 布局

```
┌──────────────────────────────────────────┐
│                                          │
│    [输入节点] ───→ [处理节点] ───→ [输出] │
│                                          │
│     ┌──────┐       ┌──────┐              │
│     │MIDI  │       │Chord │              │
│     │Input │       │Detect│              │
│     └──────┘       └──────┘              │
│         │              │                  │
│         ▼              ▼                  │
│     ┌──────┐       ┌──────┐              │
│     │MIDI  │       │Display│              │
│     │Thru  │       │      │              │
│     └──────┘       └──────┘              │
│                                          │
└──────────────────────────────────────────┘
```

### 设计细节

- `h-[calc(100vh-8rem)] bg-base-300 rounded-lg overflow-hidden`
- VueFlow 图形界面
- 节点：`px-4 py-2 bg-base-100 border border-base-200 rounded-lg shadow-sm text-sm`

---

## 页面 15：Debugger.vue — 调试器

### 布局

```
┌──────────────────────────────────────────┐
│                                          │
│  > MIDI-JAR Debug Console                │
│  > [2024-01-01 12:00:00] MIDI 连接成功   │
│  > [2024-01-01 12:00:01] 收到 NoteOn C4 │
│  > [2024-01-01 12:00:02] 和弦识别: Cmaj7│
│  > [2024-01-01 12:00:03] 渲染完成       │
│  > _                                      │
│                                          │
└──────────────────────────────────────────┘
```

### 设计细节

- `bg-base-300 rounded-lg p-4 font-mono text-sm` 终端风格
- 等宽字体，绿色高亮第一行

---

## 页面 16：About.vue — 关于

### 布局

```
┌──────────────────────────────────────────┐
│                                          │
│             MIDI-JAR                     │
│              v2.0.0                      │
│                                          │
│     MIDI-JAR 是一款桌面 MIDI 工具        │
│     帮助你学习和理解音乐理论             │
│                                          │
│     基于 Tauri + Vue 3 构建              │
│     使用 @tonaljs 音乐理论库             │
│                                          │
│     © 2024 MIDI-JAR Team                 │
│                                          │
└──────────────────────────────────────────┘
```

### 设计细节

- 居中布局：`flex flex-col items-center justify-center py-16`
- 品牌字体：`font-[RocherColorGX] text-4xl mb-4`
- 版本号：`text-base-content/70 text-sm`

---

## 页面 17：Licenses.vue — 许可证

### 布局

```
┌──────────────────────────────────────────┐
│  许可证                                   │
│                                           │
│  [搜索许可证... (input)]                  │
│                                           │
│  ┌─ @tonaljs ─────────────────────────┐  │
│  │  MIT License                       │  │
│  │  Copyright (c) 2024 ...            │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─ VexFlow ──────────────────────────┐  │
│  │  MIT License                       │  │
│  └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 设计细节

- 搜索框：`input input-bordered input-sm w-full mb-4`
- 项目：`p-3 border border-base-200 rounded-lg text-sm`

---

## SettingsLayout.vue — 设置布局

### 布局

```
┌──────────┬───────────────────────────────┐
│ 设置导航  │                               │
│           │   设置内容区域                 │
│  通用设置  │                               │
│  和弦词典  │    (RouterView)              │
│  和弦显示  │                               │
│  和弦游戏  │                               │
│  五度圈    │                               │
│  记谱设置  │                               │
│  光标设置  │                               │
│  MIDI路由  │                               │
│  调试器    │                               │
│  关于      │                               │
│  许可证    │                               │
└──────────┴───────────────────────────────┘
```

### 设计细节

- 侧边导航：`w-48 border-r border-base-200 p-4 hidden md:block`
- 导航项：`block px-3 py-2 text-sm rounded-md transition-colors duration-150`
- 选中：`bg-primary/10 text-primary font-semibold`
- 未选中：`hover:bg-base-200 text-base-content/70`

---

## WidgetPage.vue / WidgetTitleBar.vue — 桌面小部件

### 布局（紧凑模式）

```
┌─────────────────────┐
│  MIDI-JAR      [−]  │  ← 标题栏
├─────────────────────┤
│  Cmaj7              │
│  Root: C            │
│  Maj3: E            │
│  Per5: G            │
│  Maj7: B            │
└─────────────────────┘
```

### 布局（展开模式）

```
┌─────────────────────────┐
│  MIDI-JAR          [+]  │
├─────────────────────────┤
│  Cmaj7                  │
│  Root: C   Maj3: E     │
│  Per5: G   Maj7: B     │
└─────────────────────────┘
```

### 设计细节

- 标题栏：`bg-base-200 border-b border-base-200 px-2 py-1`
- 切换按钮：`btn btn-ghost btn-xs btn-square`

---

## ChordName.vue — 和弦名称组件

### 视觉结构

```
        C            maj7          /         G
    ──────────  ────────────   ──   ──────────
    font-bold   text-base-   text-   font-bold
                content/70   base-   text-base-
                             content content/30
```

### 设计细节

- 纯文本组件，无动画
- 根音：`font-bold text-base-content`
- 修饰符：`font-normal text-base-content/70`
- 分隔符 `/`：`text-base-content/30`
- ♯ 高亮：`text-warning`（纯文字）
- ♭ 高亮：`text-info`（纯文字）
- Size prop：sm(`text-sm`) / md(`text-base`) / lg(`text-lg`) / xl(`text-xl`)

---

## PianoKeyboard.vue — 钢琴键盘

### 视觉结构

```
白键:  bg-white dark:bg-gray-700      border-gray-300
      ┌────┬────┬────┬────┬────┬────┐
      │    │    │    │    │    │    │
      │ C  │ D  │ E  │ F  │ G  │ A  │
      │    │    │    │    │    │    │
      └────┴────┴────┴────┴────┴────┘
           █     █         █     █
黑键:      C#    D#        F#    G#
      bg-gray-900 dark:bg-gray-800
```

### 设计细节

- 无涟漪/波纹动画
- 无 fingerMap 指法提示
- 高亮键：`oklch(var(--p))` 或 `ring-2 ring-primary/70`
- 标签：`text-[10px] text-base-content/40`（可选）

---

## 组件库规格一览

| 组件                 | 核心样式                                                 | 备注                 |
| -------------------- | -------------------------------------------------------- | -------------------- |
| Icon.vue             | `w-5 h-5 fill-current`                                   | `aria-hidden="true"` |
| NavButton.vue        | `btn btn-ghost btn-sm`                                   | 通用导航按钮         |
| PopOutButton.vue     | `btn btn-ghost btn-sm btn-square`                        | 弹出窗口             |
| SettingsButton.vue   | `btn btn-ghost btn-sm btn-square`                        | 设置入口             |
| SettingsModal.vue    | `modal modal-middle modal-box`                           | DaisyUI 标准         |
| InputNote.vue        | `input input-bordered input-sm`                          | + `input-error` 状态 |
| KeyScaleSelector.vue | `flex rounded-lg border border-base-200 overflow-hidden` | 分段按钮             |
| ThemePicker/Switcher | `dropdown dropdown-end`                                  | DaisyUI 标准         |
| ChordIntervals.vue   | `h-1.5 bg-base-200 rounded-full` 进度条                  | 保留 i18n            |
| Notation.vue         | `border border-base-200 rounded-lg p-2`                  | VexFlow 容器         |
| DrawerOutlet.vue     | `<div class="drawer"><slot /></div>`                     | 极简                 |
| CustomCursor.vue     | 默认 `v-if="enabled"` false                              | 禁用状态             |

---

## Settings 控件组件规格

| 组件                | 核心样式                                              |
| ------------------- | ----------------------------------------------------- |
| SettingsCollapse    | `border border-base-200 rounded-lg p-3` + `<details>` |
| SettingsToggle      | `toggle toggle-sm`                                    |
| SettingsSelect      | `select select-bordered select-sm`                    |
| SettingsRange       | `range range-sm`                                      |
| SettingsRadioGroup  | `radio radio-sm`                                      |
| SettingsColorPicker | `input type="color" w-8 h-8`                          |
| SettingsTextInput   | `input input-bordered input-sm`                       |
| SettingsSection     | `p-4 border border-base-200 rounded-lg`               |

---

## CircleFifths 子组件（13 个 SVG 文件）

| 文件         | 描述       | SVG 样式                                     |
| ------------ | ---------- | -------------------------------------------- |
| Alteration   | 升降号标记 | `fill-warning` / `fill-info`                 |
| Arrow        | 方向箭头   | `stroke-base-content/40`                     |
| DegreeLabel  | 音级名称   | `fill-base-content text-xs`                  |
| DegreeLabels | 音级标签组 | 同 DegreeLabel                               |
| Degrees      | 音级数字   | `fill-base-content/60 text-[10px]`           |
| Diminished   | 减和弦扇区 | `fill-base-200` + `stroke-base-content/20`   |
| Dominants    | 属和弦扇区 | `fill-primary/10` + `stroke-base-content/20` |
| Label        | 通用标签   | `fill-base-content text-xs font-medium`      |
| Major        | 大调扇区   | `fill-primary/20` + `stroke-base-content/20` |
| Minor        | 小调扇区   | `fill-info/20` + `stroke-base-content/20`    |
| Modes        | 调式标签   | `fill-base-content/60 text-[10px]`           |
| SusLabel     | 挂留标签   | `fill-warning/60 text-[10px]`                |
| Suspended    | 挂留扇区   | `fill-warning/10` + `stroke-base-content/20` |

**通用规则**：

- 纯 SVG 元素，无 HTML
- 纯色填充，无渐变
- `stroke-base-content/20` 描边
- 无 CSS 动画（`animate-spin`、`<animate>` 等）
- 无硬编码颜色，使用 DaisyUI CSS 变量

---

## 移动端响应式策略

| 断点 | 宽度       | 行为                         |
| ---- | ---------- | ---------------------------- |
| 桌面 | ≥ 1024px   | 完整多栏布局，完整键盘       |
| 平板 | 768-1023px | 两栏，部分面板折叠           |
| 手机 | < 768px    | 单栏，底部标签导航，键盘缩放 |

### 各页面响应式行为

| 页面            | 桌面          | 平板          | 手机               |
| --------------- | ------------- | ------------- | ------------------ |
| Home            | 3 列卡片      | 2 列卡片      | 1 列卡片           |
| ChordDictionary | 三栏          | 两栏（左+中） | 单栏+底部标签      |
| ChordDisplay    | 垂直单列      | 垂直单列      | 垂直单列           |
| ChordQuiz       | 全宽布局      | 全宽布局      | 键盘压缩           |
| CircleOfFifths  | 完整圆环      | 缩放圆环      | 小圆环+横向滚动    |
| Settings        | 侧边导航+内容 | 侧边导航+内容 | 无侧边（全屏内容） |

---

## 移除清单（自检用）

### CSS 动画

- `@keyframes ripple`
- `@keyframes countUp`
- `@keyframes shimmer`
- `@keyframes cardEntrance`
- `@keyframes popIn`
- `prefers-reduced-motion` 媒体查询

### 交互效果

- `hover:scale-[1.02]` / `hover:-translate-y-1`
- `active:scale-[0.98]`
- `hover:shadow-2xl hover:shadow-primary/5`
- `group-hover:bg-primary group-hover:text-primary-content`
- `bg-gradient-to-br from-primary/5 via-transparent to-accent/5`
- `backdrop-blur-xl` / `backdrop-blur-md` / `bg-base-100/60`
- `animate-pulse` / `animate-ripple`
- Staggered 交错入场
- 弹簧弹性 `cubic-bezier(0.34,1.56,0.64,1)`

### 保留功能

- ✅ 5 个主题（light, dark, cupcake, synthwave, forest）
- ✅ 主题切换 + `prefers-color-scheme` 检测
- ✅ 和弦数据懒加载
- ✅ 设置 500ms 防抖
- ✅ i18n 国际化
- ✅ 共享图标映射 `mapMdiToIcon()`
- ✅ Tauri API 类型安全封装
