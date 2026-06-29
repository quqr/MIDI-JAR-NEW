# UI 精炼用户体验重设计 — 实施任务

> **设计哲学**：直觉优先，简洁有力，美观实用
> **覆盖**：99 个 `.vue` 文件，5 个阶段，40 个任务

---

## 阶段 1：设计基础设施（3 任务）

### Task 1: 建立色彩系统（严格遵循 DaisyUI 色彩规范）
- [ ] 确认所有颜色使用 DaisyUI 语义色 class（`bg-primary`、`text-base-content`、`border-base-300` 等）
- [ ] 禁止硬编码颜色（`#1A1A2E`、`#6366F1`、`#E8EAED` 等）
- [ ] 透明度修饰：`/10`、`/20`、`/30`、`/40`、`/60`、`/70` 用于层级区分
- [ ] 确认 DaisyUI 主题配置保留 5 个（light/dark/cupcake/synthwave/forest）
- [ ] 全局搜索替换所有硬编码颜色为 DaisyUI 语义色

### Task 2: 重置全局样式
- [ ] 从 `tailwind.css` 移除自定义 keyframes（ripple, countUp, shimmer, cardEntrance, popIn）
- [ ] 保留 `animate-pulse`（仅用于 skeleton 加载）
- [ ] 设置全局背景色 `bg-base-200`（DaisyUI 语义色，自动适配主题）
- [ ] 设置全局文字色 `text-base-content`（DaisyUI 语义色，自动适配主题）

### Task 3: 重置 App.vue 和 AppLayout.vue
- [ ] 路由过渡仅 opacity 100ms
- [ ] AppLayout 使用 `max-w-[1400px] mx-auto min-h-screen`
- [ ] 背景色使用 DaisyUI 语义色（`bg-base-200`）

---

## 阶段 2：核心组件重设计（5 任务）

### Task 4: 重写 ChordName.vue
- [ ] 根音 `font-bold text-base-content`
- [ ] 修饰符 `font-normal text-base-content/60`
- [ ] 分隔符 `/` `text-base-content/40`
- [ ] ♯ `text-warning` ♭ `text-info`
- [ ] 无动画，无背景高亮
- [ ] size prop: sm/md/lg/xl

### Task 5: 重写 PianoKeyboard.vue
- [ ] 白键 `bg-base-100 border-r border-base-300`
- [ ] 黑键 `bg-base-content`
- [ ] 高亮键 `bg-primary`
- [ ] 标签 `text-[10px] text-base-content/40` 可选
- [ ] 无涟漪动画，无指法提示

### Task 6: 重写 ModuleCard.vue
- [ ] 卡片 `bg-base-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow`
- [ ] 图标容器 `w-12 h-12 rounded-xl` 各模块不同色
- [ ] 标题 `text-base font-semibold text-base-content mt-3`
- [ ] 描述 `text-xs text-base-content/60 mt-1`
- [ ] 无 `hover:scale`、无 `group-hover`

### Task 7: 重写 ChordCardGrid.vue
- [ ] 卡片 `bg-base-100 rounded-xl border border-base-300 p-3 text-center hover:border-primary/30 hover:shadow-sm transition-all`
- [ ] 和弦名 `text-base font-bold text-base-content`
- [ ] 音程 `text-xs text-base-content/60 mt-1`
- [ ] 选中 `ring-2 ring-primary`
- [ ] 加载态 skeleton `rounded-xl bg-base-200 animate-pulse`
- [ ] 无迷你键盘预览，无音符 badge

### Task 8: 重写 ChordDetail.vue
- [ ] 和弦名 `text-2xl font-bold text-base-content`
- [ ] 音高标签 `flex gap-2` 每个音 `w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold`
- [ ] 键盘区域 `mt-4 p-3 rounded-lg bg-base-200`
- [ ] 折叠区使用 `<details>` 原生折叠

---

## 阶段 3：主页面重设计（6 任务）

### Task 9: 重写 Home.vue — 极简版（参考 spec.md 示意图）
- [ ] 品牌标题 `text-3xl sm:text-4xl font-bold tracking-tight text-base-content`
- [ ] **移除副标题**（"音乐学习工具箱"）
- [ ] **移除搜索框**
- [ ] **移除最近使用区域**
- [ ] 卡片网格 `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-3xl mx-auto`
- [ ] 卡片 `bg-base-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center`
- [ ] 图标 `w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto`
- [ ] 各模块图标色 `bg-primary/10`、`bg-warning/10`、`bg-success/10`、`bg-error/10`、`bg-info/10`、`bg-base-200`
- [ ] 标题 `text-sm font-semibold text-base-content mt-3`
- [ ] **无描述文字**
- [ ] 无渐变光晕，无 staggered 动画

### Task 10: 重写 ChordDictionary.vue — 详情为中心（参考 spec.md 示意图）
- [ ] 顶部工具栏 `flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100`
- [ ] 根音选择器在工具栏内 `flex gap-1` 按钮行 `btn btn-xs` / `btn-primary`
- [ ] 左栏和弦列表（弱化视觉）`w-48 border-r border-base-300 p-3 hidden md:block`
- [ ] 列表项 `px-3 py-1.5 rounded-lg text-sm text-base-content/70 hover:bg-base-200` 选中 `bg-primary/10 text-primary font-semibold`
- [ ] 品质筛选标签 `btn btn-xs` / `btn-primary` 在左栏底部
- [ ] 右栏和弦详情（核心展示区）`flex-1 p-6 overflow-y-auto`
- [ ] 和弦名 `text-3xl font-bold text-base-content`
- [ ] 音高标签 `flex gap-2 mt-3` 每个音 `w-10 h-10 rounded-full bg-primary/10 text-primary`
- [ ] 键盘区域 `mt-6 p-4 rounded-xl bg-base-200`
- [ ] 五线谱区域 `mt-6 p-4 rounded-xl bg-base-200`
- [ ] 折叠区 `<details>` 原生折叠
- [ ] **无和弦卡片网格**（用列表替代）
- [ ] 移动端底部标签栏

### Task 11: 重写 ChordDisplay.vue — 右侧统一面板（4 项要求全实现）

#### 要求 1: 和弦名称+信息整合为统一右侧面板
- [ ] 右侧面板 `w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4 p-5 rounded-xl bg-base-100 border border-base-300 shadow-sm`
- [ ] 面板顶部：和弦名称 `text-3xl font-bold tracking-tight text-base-content`
- [ ] 面板顶部：音高标签 `flex gap-2 mt-2` 每个音 `w-10 h-10 rounded-full bg-primary/10 text-primary`
- [ ] 面板中部：音程列表 `space-y-2 pt-4 border-t border-base-300`
- [ ] 面板底部：备选和弦 `flex gap-2 flex-wrap pt-4 border-t border-base-300`
- [ ] 无 MIDI 时面板显示 "等待 MIDI 输入..." `text-2xl text-base-content/40`

#### 要求 2: 色彩遵循 DaisyUI 规范
- [ ] 所有颜色使用 DaisyUI 语义色（`bg-base-100`、`text-base-content`、`border-base-300`、`bg-primary` 等）
- [ ] 无硬编码颜色值

#### 要求 3: 左侧五线谱 + 右侧面板
- [ ] 核心内容区 `flex flex-col lg:flex-row gap-4 flex-1 min-h-0`
- [ ] 左侧五线谱 `flex-1 min-w-0 p-4 rounded-xl bg-base-100 border border-base-300 shadow-sm`
- [ ] VexFlow 谱线 `stroke-base-content/20`，音符 `fill-base-content`

#### 要求 4: 钢琴键盘固定底部
- [ ] 桌面 `sticky bottom-0`
- [ ] 手机 `fixed bottom-0 left-0 right-0 z-10 bg-base-100 border-t border-base-300`
- [ ] 白键 `bg-base-100`，黑键 `bg-base-content`，高亮 `bg-primary`

#### VexFlow 渲染优化
- [ ] 实例缓存，仅 MIDI 变化时重绘
- [ ] 鼠标滚轮缩放 + 拖拽平移
- [ ] 自动适应容器宽度
- [ ] DaisyUI 语义色自动跟随主题

#### 响应式
- [ ] 桌面 ≥ 1024px：左右分栏
- [ ] 平板 768-1023px：左右分栏(60/40)
- [ ] 手机 < 768px：上下垂直，键盘 `fixed bottom-0`

### Task 12: 重写 ChordQuiz.vue（参考 spec.md 示意图）
- [ ] 顶部信息栏 `flex items-center justify-between px-4 py-3`
- [ ] 进度条 `h-1.5 rounded-full bg-base-200` 填充 `bg-primary`
- [ ] 目标和弦 `text-5xl font-bold tracking-tight text-center py-10`
- [ ] 正确反馈 `bg-success/10 border border-success/30 rounded-xl p-4`
- [ ] 错误反馈 `bg-error/10 border border-error/30 rounded-xl p-4`
- [ ] 操作按钮 `px-4 py-2 rounded-lg text-sm font-medium bg-base-200 hover:bg-base-300`

### Task 13: 重写 CircleOfFifths.vue（参考 spec.md 示意图）
- [ ] SVG 五度圈 `max-w-xl mx-auto`
- [ ] 大调扇形 `fill-primary/10` 小调扇形 `fill-warning/10`
- [ ] 选中 `stroke-primary stroke-width="2"`
- [ ] 信息面板 `mt-6 p-4 rounded-xl bg-base-100 border border-base-300 shadow-sm`
- [ ] 调名 `text-xl font-bold` 调号 `text-sm text-base-content/60`
- [ ] 音阶 `flex gap-2 mt-3` 每个音 `w-8 h-8 rounded-full bg-base-200`
- [ ] 快速切换按钮 `flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium` 选中 `bg-primary text-primary-content`

### Task 14: 重写 Settings 群组（参考 spec.md 示意图）
- [ ] 侧边导航 `w-44 border-r border-base-300 p-4 hidden md:block`
- [ ] 导航项 `px-3 py-2 rounded-lg text-sm` 选中 `bg-primary/10 text-primary`
- [ ] 内容区域 `flex-1 p-6 overflow-y-auto max-w-2xl`
- [ ] 设置分组 `mb-6` 分组标题 `text-sm font-medium text-base-content/60 mb-3`
- [ ] 分组卡片 `bg-base-100 rounded-xl border border-base-300 divide-y divide-base-300`
- [ ] 设置项 `flex items-center justify-between px-4 py-3`
- [ ] 各设置页特色色调（DaisyUI 语义色）

---

## 阶段 4：子组件与控件重设计（6 任务）

### Task 15: 重写 ChordCategoryTree.vue
- [ ] 标题 `text-xs font-medium text-base-content/60 uppercase tracking-wider mb-3`
- [ ] 分类项 `py-1.5 px-2 rounded-lg text-sm hover:bg-base-200`
- [ ] 选中 `bg-primary/10 text-primary font-medium`

### Task 16: 重写 ChordSearch.vue
- [ ] 触发按钮 `px-3 py-1.5 rounded-lg border border-base-300 text-sm text-base-content/60 hover:border-primary/30`
- [ ] 下拉面板 `bg-base-100 border border-base-300 rounded-xl shadow-lg w-72`
- [ ] 选项 `px-3 py-2 text-sm hover:bg-base-200`

### Task 17: 重写 Settings 控件组件
- [ ] SettingsToggle: `toggle toggle-sm`
- [ ] SettingsSelect: `select select-bordered select-sm`
- [ ] SettingsRange: `range range-sm`
- [ ] SettingsRadioGroup: `radio radio-sm`
- [ ] SettingsColorPicker: `input type="color" w-8 h-8 rounded`
- [ ] SettingsTextInput: `input input-bordered input-sm`
- [ ] SettingsSection: `mb-6` + 标题 `text-sm font-medium text-base-content/60 mb-3`
- [ ] SettingsCollapse: `<details>` + `rounded-xl border border-base-300 p-3`

### Task 18: 重写 WidgetPage.vue
- [ ] 标题栏 `bg-base-200 border-b border-base-300 px-3 py-1.5`
- [ ] 和弦名 `text-lg font-bold text-base-content`
- [ ] 音程列表 `text-xs text-base-content/60`

### Task 19: 重写 CircleFifths 子组件（13 个 SVG 文件）
- [ ] 大调扇形 `fill-primary/10` 选中 `fill-primary/20`
- [ ] 小调扇形 `fill-warning/10` 选中 `fill-warning/20`
- [ ] 描边 `stroke-base-300 stroke-width="1"`
- [ ] 选中描边 `stroke-primary stroke-width="2"`
- [ ] 文字 `fill-base-content font-size="12" font-weight="500"`
- [ ] 无动画

### Task 20: 重写其他共用组件
- [ ] Icon.vue: `w-5 h-5`
- [ ] NavButton.vue: `px-3 py-1.5 rounded-lg text-sm hover:bg-base-200`
- [ ] PopOutButton.vue: `w-8 h-8 rounded-lg hover:bg-base-200`
- [ ] SettingsButton.vue: 同 PopOutButton
- [ ] SettingsModal.vue: DaisyUI `modal modal-middle`
- [ ] InputNote.vue: `input input-bordered input-sm` + `input-error`
- [ ] KeyScaleSelector.vue: 分段按钮 `border border-base-300`
- [ ] ThemePicker/Switcher: `dropdown dropdown-end`
- [ ] ChordIntervals.vue: 进度条 `h-2 rounded-full bg-base-200` 填充 `bg-primary/20`
- [ ] Notation.vue: `rounded-xl bg-base-200 border border-base-300 p-2`
- [ ] LatencyMonitor.vue: `fixed bottom-4 right-4 bg-base-100/90 rounded-lg p-2 shadow-lg text-xs font-mono`

---

## 阶段 5：验证与测试（5 任务）

### Task 21: 视觉一致性检查
- [ ] 所有页面背景色统一
- [ ] 所有卡片使用相同圆角和阴影
- [ ] 所有按钮使用相同悬停效果
- [ ] 所有文字颜色层级一致
- [ ] 所有间距节奏一致

### Task 22: 用户体验检查
- [ ] 首页 0.5 秒内可理解
- [ ] 核心功能 1 次点击可达
- [ ] 所有交互反馈 ≤ 150ms
- [ ] 无 confusing 的布局或交互
- [ ] 移动端所有功能可用

### Task 23: 功能保留检查
- [ ] 和弦词典查询功能正常
- [ ] MIDI 输入实时显示正常
- [ ] 和弦识别游戏正常
- [ ] 五度圈交互正常
- [ ] 设置即时生效正常
- [ ] 主题切换正常
- [ ] i18n 切换正常
- [ ] 路由导航正常
- [ ] Widget 模式正常
- [ ] MIDI 路由正常

### Task 24: 残留检查
- [ ] 无 `backdrop-blur` 残留
- [ ] 无 `bg-gradient-to-br` 残留
- [ ] 无 `hover:scale` 残留
- [ ] 无 `group-hover` 变色残留
- [ ] 无 `animate-ripple` 残留
- [ ] 无自定义 keyframes 残留
- [ ] 无弹簧弹性过渡残留

### Task 25: 构建验证
- [ ] `vue-tsc --noEmit` 通过
- [ ] `npx vitest run` 通过
- [ ] `npm run build` 成功