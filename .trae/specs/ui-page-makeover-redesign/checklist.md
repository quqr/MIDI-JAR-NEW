# UI 逐页全细节重设计 — 验证清单（含示意图版）

---

## 阶段 1：基础设施

### Task 1: 全局样式
- [ ] `tailwind.css` 中无 `@keyframes ripple`
- [ ] `tailwind.css` 中无 `@keyframes countUp`
- [ ] `tailwind.css` 中无 `@keyframes shimmer`
- [ ] `tailwind.css` 中无 `@keyframes cardEntrance`
- [ ] `tailwind.css` 中无 `@keyframes popIn`
- [ ] `tailwind.css` 中无 `prefers-reduced-motion` 媒体查询
- [ ] 项目中无 `animate-ripple` 类引用
- [ ] 项目中无 `animate-countUp` 类引用
- [ ] 项目中无 `animate-shimmer` 类引用
- [ ] 项目中无 `animate-cardEntrance` 类引用
- [ ] 项目中无 `animate-popIn` 类引用
- [ ] `themes` 配置包含 `light, dark, cupcake, synthwave, forest` 5 个

### Task 2: App.vue 路由过渡
- [ ] `.page-enter-active` 仅 `opacity 0.1s ease-out`
- [ ] `.page-leave-active` 仅 `opacity 0.075s ease-in`
- [ ] `.page-enter-from` 仅 `opacity: 0`
- [ ] `.page-leave-to` 仅 `opacity: 0`
- [ ] 无 `transform: scale()` 相关样式
- [ ] `mode="out-in"` 保留

### Task 3: AppLayout.vue
- [ ] 无 `bg-gradient-to-br` 光晕
- [ ] 背景 `bg-base-100`
- [ ] `max-w-[1400px] mx-auto min-h-screen p-4 sm:p-6` 保留

---

## 阶段 2：核心组件

### Task 4: ChordName.vue
- [ ] 无 `<Transition name="chord-pop">`
- [ ] 无 `scale-90→100` 动画
- [ ] ♯ 使用 `text-warning`（纯色，无背景）
- [ ] ♭ 使用 `text-info`（纯色，无背景）
- [ ] 根音 `font-bold text-base-content`
- [ ] 修饰符 `font-normal text-base-content/70`
- [ ] 分隔符 `/` → `text-base-content/30`
- [ ] `size` prop sm/md/lg/xl 正常工作
- [ ] 无 `bg-warning/10` 背景
- [ ] 无 Vuetify 类名残留

### Task 5: ChordNameLink.vue
- [ ] 同步 ChordName 所有精简
- [ ] `cursor-pointer hover:text-primary transition-colors duration-150`

### Task 6: PianoKeyboard.vue
- [ ] 无 `animate-ripple` 引用
- [ ] 无 fingerMap prop
- [ ] 白键默认 `bg-white dark:bg-gray-700`
- [ ] 黑键默认 `bg-gray-900 dark:bg-gray-800`
- [ ] 高亮键使用 `oklch(var(--p))` 或 `ring-2 ring-primary/70`
- [ ] 标签 `text-[10px] text-base-content/40` 可选

### Task 7: 键盘子组件
- [ ] WhiteNote 无涟漪动画
- [ ] BlackNote 无涟漪动画
- [ ] classic Board 无 fingerMap
- [ ] flat Note 无涟漪动画
- [ ] flat Board 无 fingerMap

---

## 阶段 3：导航

### Task 8: AppNavbar.vue
- [ ] 容器 `flex items-center h-10 px-3 bg-base-100 border-b border-base-200 gap-2`
- [ ] 无 `backdrop-blur-md` 玻璃态
- [ ] 无 `sticky top-0 z-50`
- [ ] 关闭按钮使用 CSS 变量（非 `bg-error` 类）
- [ ] 调号按钮 `w-7 h-7 text-xs rounded` + 选中 `bg-primary text-primary-content`
- [ ] 自定义 CSS ≤ 5 行
- [ ] 无 `win-ctrl-btn--close:hover` 自定义样式

### Task 9: AppBreadcrumb.vue
- [ ] 分隔符 `/` `text-base-content/30`
- [ ] 上级页 `text-base-content/50 hover:text-base-content/80`
- [ ] 当前页 `font-semibold text-base-content`
- [ ] `text-sm` 字号

---

## 阶段 4：主页面

### Task 10: Home.vue（参考 spec.md 示意图）
- [ ] 无 `bg-gradient-to-br` 光晕
- [ ] 模块网格 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`
- [ ] 无 staggered 入场动画
- [ ] "最近使用"区域使用 v-if
- [ ] 空模块状态 `text-base-content/40 py-16`
- [ ] 搜索框 `input input-bordered w-full max-w-md`

### Task 11: ModuleCard.vue
- [ ] 无 `hover:scale-[1.02]`
- [ ] 无 `hover:-translate-y-1`
- [ ] 无 `group-hover` 效果
- [ ] 无 `hover:shadow-2xl`
- [ ] 图标容器静态（无 group-hover 变色）
- [ ] 悬停仅 `hover:shadow-md transition-shadow duration-150`
- [ ] 默认 `shadow-sm`
- [ ] `focus-visible:ring-2 focus-visible:ring-primary`

### Task 12: ChordDictionary.vue（参考 spec.md 示意图）
- [ ] 无氛围光晕
- [ ] 左栏 `w-56 lg:w-60 border-r border-base-200 p-4 hidden md:block`
- [ ] 右栏 `w-96 border-l border-base-200 p-4 hidden lg:block`
- [ ] 根音按钮 `btn btn-xs` / `btn-primary`
- [ ] 移动端底部标签栏存在

### Task 13: ChordCardGrid.vue
- [ ] 无 `@keyframes cardEntrance`
- [ ] 无 `animation-delay`
- [ ] 无 `will-change`
- [ ] 无迷你键盘预览
- [ ] 无音符 badge
- [ ] 卡片 `w-full h-28 bg-base-100 rounded-xl border border-base-200 shadow-sm`
- [ ] 选中 `ring-2 ring-primary`
- [ ] 悬停 `hover:border-primary/30`
- [ ] 加载态 skeleton
- [ ] 空结果 `text-base-content/40 py-20`

### Task 14: ChordCategoryTree.vue
- [ ] 使用 details 原生箭头
- [ ] 选中 `bg-primary/10 text-primary font-semibold`

### Task 15: ChordDictionaryToolbar.vue
- [ ] 无 `sticky top-0 z-10`
- [ ] 容器 `bg-base-100 border-b border-base-200`

### Task 16: 菜单组件
- [ ] 使用纯 flex 按钮
- [ ] 选中 `bg-primary text-primary-content`
- [ ] 无 `ring-2 ring-accent bg-accent/10`

### Task 17: ModuleProvider
- [ ] 无样式变更

### Task 18: ChordSearch / ChordSearchOption
- [ ] 下拉面板 `bg-base-100 border border-base-200 rounded-lg shadow-lg`
- [ ] 无 `bg-success text-success-content`

### Task 19: ChordDetail.vue
- [ ] 容器使用 `border border-base-200 rounded-lg`
- [ ] 折叠使用原生 `<details>`
- [ ] 无 `collapse collapse-arrow`

### Task 20: EmptyChordDetail.vue
- [ ] 无 `card bg-base-100 shadow-lg p-8`
- [ ] 纯 flex 居中

### Task 21: Detail 子组件
- [ ] ChordBasicInfo：`border-b border-base-200`
- [ ] ChordAliases：无 `border-l-[3px]`、无 `collapse`
- [ ] ChordInversions：同 Aliases
- [ ] ChordAlternatives：标准列表
- [ ] ChordRelated：`btn btn-sm rounded-full border border-base-200`

### Task 22: ChordDisplay.vue（参考 spec.md 示意图）
- [ ] 无 `bg-gradient-to-br` 光晕
- [ ] 无 `backdrop-blur` 玻璃态
- [ ] 纯垂直布局（无 splitpanes）
- [ ] 容器 `p-4 border border-base-200 rounded-lg`
- [ ] 等待状态 `text-base-content/30`

### Task 23: ChordQuiz.vue（参考 spec.md 示意图）
- [ ] 信息栏得分+进度+计时器
- [ ] 进度条 `h-1 bg-base-200 rounded-full`
- [ ] 正确 `bg-success/10 ring-2 ring-success`
- [ ] 错误 `bg-error/10 ring-2 ring-error`
- [ ] 无色盲友好 badge

### Task 24: GameList / Reaction
- [ ] GameList `p-4 border border-base-200 rounded-lg`

### Task 25: CircleOfFifths.vue（参考 spec.md 示意图）
- [ ] 无光晕环
- [ ] 无 `animate-pulse`
- [ ] SVG `max-w-2xl w-full mx-auto`
- [ ] 信息面板 `p-4 border border-base-200 rounded-lg`

### Task 26: CircleFifths 子组件
- [ ] 无 CSS 动画
- [ ] 纯色填充
- [ ] `stroke-base-content/20` 描边
- [ ] 13 个子组件均无动画

---

## 阶段 5：设置页面

### Task 27: SettingsLayout.vue（参考 spec.md 示意图）
- [ ] 无弹簧滑入动画
- [ ] 侧边导航 `w-48 border-r border-base-200 p-4`

### Task 28: GeneralSettings.vue（参考 spec.md 示意图）
- [ ] `max-w-3xl mx-auto py-6 space-y-6`
- [ ] 分组 `p-4 border border-base-200 rounded-lg`
- [ ] DaisyUI 标准控件

### Task 29-32: 各设置页面（参考 spec.md 示意图）
- [ ] ChordDictionarySettings：`border-info/20`
- [ ] ChordDisplaySettings：`border-success/20`
- [ ] ChordQuizSettings：`border-warning/20`
- [ ] CircleOfFifthsSettings：`border-secondary/20`

### Task 33: NotationSettings.vue（参考 spec.md 示意图）
- [ ] 标签页切换 `border-b border-base-200`
- [ ] 选中 `border-primary text-primary`

### Task 34: CursorSettings.vue（参考 spec.md 示意图）
- [ ] 简短开关列表

### Task 35: Routing.vue（参考 spec.md 示意图）
- [ ] `h-[calc(100vh-8rem)] bg-base-300 rounded-lg overflow-hidden`
- [ ] loading/error 状态保留

### Task 36: Debugger.vue（参考 spec.md 示意图）
- [ ] `bg-base-300 rounded-lg p-4 font-mono text-sm`

### Task 37: About.vue（参考 spec.md 示意图）
- [ ] 居中布局

### Task 38: Licenses.vue（参考 spec.md 示意图）
- [ ] 搜索框 + 标准列表

### Task 39: Routing 子组件
- [ ] InputNode/OutputNode `px-4 py-2 bg-base-100 border border-base-200 rounded-lg shadow-sm`
- [ ] MidiFlowGraph VueFlow 默认样式

---

## 阶段 6：小部件与共用组件

### Task 40: WidgetPage.vue（参考 spec.md 示意图）
- [ ] 紧凑/展开模式保留

### Task 41: WidgetTitleBar.vue
- [ ] `bg-base-200 border-b border-base-200`

### Task 42: Settings 控件
- [ ] Collapse：`border border-base-200 rounded-lg p-3` + details
- [ ] Toggle：`toggle toggle-sm`
- [ ] Select：`select select-bordered select-sm`
- [ ] Range：`range range-sm`
- [ ] RadioGroup：`radio radio-sm`
- [ ] ColorPicker：`input type="color" w-8 h-8`
- [ ] TextInput：`input input-bordered input-sm`
- [ ] Section：`p-4 border border-base-200 rounded-lg`

### Task 43: SettingsModal.vue
- [ ] `modal modal-middle modal-box`

### Task 44: Icon.vue
- [ ] `w-5 h-5 fill-current`

### Task 45: InputNote.vue
- [ ] `input input-bordered input-sm`
- [ ] 错误状态 `input-error`

### Task 46: KeyScaleSelector.vue
- [ ] 分段按钮 `border border-base-200`

### Task 47: ThemePicker/Switcher
- [ ] `dropdown dropdown-end`

### Task 48: ChordIntervals.vue
- [ ] `h-1.5 bg-base-200 rounded-full` 进度条
- [ ] 保留 `$t('unit.semitones')`

### Task 49: Notation
- [ ] `border border-base-200 rounded-lg p-2`

### Task 50: NavButton.vue
- [ ] `btn btn-ghost btn-sm`

### Task 51: DrawerOutlet.vue
- [ ] `<div class="drawer">`

### Task 52: PopOutButton.vue
- [ ] `btn btn-ghost btn-sm btn-square`

### Task 53: CustomCursor.vue
- [ ] 默认 `v-if="enabled"` false

### Task 54: SettingsButton.vue
- [ ] `btn btn-ghost btn-sm btn-square`

### Task 55: LatencyMonitor.vue
- [ ] `fixed bottom-4 right-4 w-48 bg-base-200/80 rounded-lg p-2 shadow-lg`
- [ ] `text-xs font-mono`

### Task 56: ChordDisplayAddModal/List/ModuleSettings
- [ ] AddModal：`modal modal-middle modal-box`
- [ ] List：`space-y-2` + `border border-base-200 rounded-lg`

---

## 阶段 7：验证

### 全局残留检查
- [ ] 无 `bg-gradient-to-br from-primary/5 via-transparent to-accent/5` 残留
- [ ] 无 `backdrop-blur-xl`、`backdrop-blur-md` 残留
- [ ] 无 `bg-base-100/60`、`bg-base-100/40` 半透明残留
- [ ] 无 `hover:scale-[1.02]`、`hover:-translate-y-1` 残留
- [ ] 无 `active:scale-[0.98]` 残留
- [ ] 无 `hover:shadow-2xl hover:shadow-primary/5` 残留
- [ ] 无 `animate-pulse` 残留
- [ ] 无 `animate-ripple` 残留
- [ ] 无 `@keyframes` 自定义动画残留
- [ ] 无 staggered 交错入场动画
- [ ] 无弹簧弹性过渡（`cubic-bezier(0.34,1.56,0.64,1)`）

### 功能保留检查
- [ ] 和弦词典查询功能正常
- [ ] MIDI 输入实时显示功能正常
- [ ] 和弦识别游戏功能正常
- [ ] 五度圈交互功能正常
- [ ] 设置页面即时生效正常
- [ ] 主题切换正常（5 主题）
- [ ] i18n 中文/英文切换正常
- [ ] 路由导航正常
- [ ] Widget 模式正常
- [ ] MIDI 路由功能正常

### 构建验证
- [ ] `vue-tsc --noEmit` 类型检查通过
- [ ] `npx vitest run` 单元测试通过
- [ ] `npm run build` 构建成功
- [ ] 无 `Cannot apply unknown utility class` 错误