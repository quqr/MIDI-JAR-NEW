# UI 逐页全细节重设计 — 实施任务

> **覆盖**：99 个 `.vue` 文件，7 个阶段，60 个任务
> **依赖**：阶段 1 → 阶段 2 → 阶段 3 → 阶段 4~6（可并行）→ 阶段 7

---

## 阶段 1：基础设施与样式重置（3 任务）

### Task 1: 重置全局样式系统

- [ ] 从 `tailwind.css` 移除自定义 keyframes：
  - `ripple`、`countUp`、`shimmer`、`cardEntrance`、`popIn`
- [ ] 从 `tailwind.css` 移除 `prefers-reduced-motion` 媒体查询
- [ ] 移除所有 `animate-ripple`、`animate-countUp` 等工具类引用
- [ ] 确认 `themes: light, dark, cupcake, synthwave, forest` 5 主题保留
- [ ] 确认所有 `@keyframes` 已从 CSS bundle 中移除

### Task 2: 重置 App.vue 路由过渡

- [ ] 将 `<Transition name="page">` 从复合动画改为仅 `opacity` 过渡
- [ ] **CSS 改为**：
  ```css
  .page-enter-active {
    transition: opacity 0.1s ease-out;
  }
  .page-leave-active {
    transition: opacity 0.075s ease-in;
  }
  .page-enter-from {
    opacity: 0;
  }
  .page-leave-to {
    opacity: 0;
  }
  ```
- [ ] 删除 `transform: scale(0.95)` 相关代码
- [ ] 确认 mode="out-in" 保留

### Task 3: 重置 AppLayout.vue 容器

- [ ] 移除 `bg-gradient-to-br from-primary/5 via-transparent to-accent/5` 氛围光晕
- [ ] 使用 `bg-base-100` 作为背景
- [ ] 确认 `max-w-[1400px] mx-auto min-h-screen p-4 sm:p-6` 保留

---

## 阶段 2：核心组件精简（4 任务）

### Task 4: 精简 ChordName.vue

- [ ] 移除 `<Transition name="chord-pop">` 入场动画及其 CSS
- [ ] 移除 `scale-90→100`、`opacity 0→1` 动画样式
- [ ] `highlightAlterations` 改为纯文字颜色：
  - ♯ → `text-warning`（移除 `bg-warning/10` 背景）
  - ♭ → `text-info`（移除 `bg-info/10` 背景）
- [ ] 根音 `font-bold text-base-content`
- [ ] 修饰符 `font-normal text-base-content/70`
- [ ] 分隔符 `/` → `text-base-content/30`
- [ ] 保留 `size` prop：sm(`text-sm`)、md(`text-base`)、lg(`text-lg`)、xl(`text-xl`)
- [ ] 移除所有 Vuetify 类名残留

### Task 5: 精简 ChordNameLink.vue

- [ ] 同步 Task 4 所有精简
- [ ] `cursor-pointer hover:text-primary transition-colors duration-150`

### Task 6: 重置 PianoKeyboard.vue

- [ ] 移除 `animate-ripple` 波纹动画
- [ ] 移除 `animate-[ripple_0.5s_ease-out]` 引用
- [ ] 移除 fingerMap 指法提示相关 prop 和逻辑
- [ ] 白键默认 `bg-white dark:bg-gray-700`
- [ ] 黑键默认 `bg-gray-900 dark:bg-gray-800`
- [ ] 高亮键 `background-color: oklch(var(--p))` 或 `ring-2 ring-primary/70`
- [ ] 标签 `text-[10px] text-base-content/40` 可选显示
- [ ] 确认 aria-label 保留（但简化）

### Task 7: 重置键盘子组件

- [ ] `classic/WhiteNote.vue`：移除涟漪动画、简化 aria-label
- [ ] `classic/BlackNote.vue`：移除涟漪动画、简化 aria-label
- [ ] `classic/Board.vue`：移除 fingerMap 传递
- [ ] `classic/Labels.vue`：保持或简化
- [ ] `flat/Note.vue`：移除涟漪动画、简化 aria-label
- [ ] `flat/Board.vue`：移除 fingerMap 传递
- [ ] `flat/Labels.vue`：保持或简化

---

## 阶段 3：导航与布局重设计（2 任务）

### Task 8: 重写 AppNavbar.vue

- [ ] 容器改为 `flex items-center h-10 px-3 bg-base-100 border-b border-base-200 gap-2`
- [ ] 移除 `bg-base-100/40 backdrop-blur-md sticky top-0 z-50`
- [ ] 关闭按钮使用 `bg-[var(--fallback-er,oklch(var(--er)))]` CSS 变量（非 `bg-error`）
- [ ] macOS 拖拽区域 `w-[78px]` `-webkit-app-region: drag`
- [ ] 调号按钮 `w-7 h-7 text-xs rounded hover:bg-base-200`，选中 `bg-primary text-primary-content`
- [ ] 自定义 CSS 仅保留 `.app-navbar-mac-spacer` 相关，不超过 5 行
- [ ] 移除 `win-ctrl-btn--close:hover` 自定义样式

### Task 9: 重写 AppBreadcrumb.vue

- [ ] 使用 `/` 分隔符（非 `›` 符号）
- [ ] 分隔符样式 `text-base-content/30 mx-0.5`
- [ ] 上级页 `text-base-content/50 hover:text-base-content/80 transition-colors`
- [ ] 当前页 `font-semibold text-base-content`
- [ ] `text-sm` 字号，`gap-1` 间距

---

## 阶段 4：主页面逐一重设计（17 任务）

### Task 10: 重写 Home.vue

- [ ] 移除 `bg-gradient-to-br from-primary/5 via-transparent to-accent/5` 光晕背景
- [ ] Hero 区域简化：`py-8 sm:py-12 mb-6 bg-base-100`
- [ ] 模块网格 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr px-4 pb-8`
- [ ] 移除 staggered 入场动画
- [ ] 移除搜索卡片的磁吸悬停效果
- [ ] 添加"最近使用"区域（v-if 控制）
- [ ] 最近使用项 `flex-shrink-0 px-4 py-2 bg-base-100 border border-base-200 rounded-lg`
- [ ] 空模块状态：`col-span-full text-center py-16 text-base-content/40`
- [ ] 搜索框 `input input-bordered w-full max-w-md`，`debounce 300ms`

### Task 11: 重写 ModuleCard.vue

- [ ] 移除 `hover:scale-[1.02]`、`hover:-translate-y-1`、`active:scale-[0.98]`
- [ ] 移除 `group` 相关样式和 `group-hover` 效果
- [ ] 移除 `hover:shadow-2xl hover:shadow-primary/5`
- [ ] 图标容器静态：`w-14 h-14 rounded-2xl bg-primary/10 text-primary`（无 group-hover 变色）
- [ ] 悬停仅 `hover:shadow-md transition-shadow duration-150`
- [ ] 默认阴影 `shadow-sm`
- [ ] `focus-visible:ring-2 focus-visible:ring-primary`

### Task 12: 重写 ChordDictionary.vue

- [ ] 移除氛围光晕背景
- [ ] 左栏 `w-56 lg:w-60 border-r border-base-200 p-4 hidden md:block overflow-y-auto`
- [ ] 中栏 `flex-1 p-4 overflow-y-auto`
- [ ] 右栏 `w-96 border-l border-base-200 p-4 hidden lg:block overflow-y-auto`（固定面板，非抽屉）
- [ ] 根音选择器行内 `flex items-center gap-2 mb-4 flex-wrap`
- [ ] 根音按钮 `btn btn-xs` / `btn-primary`（选中）
- [ ] 移动端底部标签栏 `bg-base-100 border-t border-base-200`

### Task 13: 重写 ChordCardGrid.vue

- [ ] 移除 `@keyframes cardEntrance` 和 `animation: cardEntrance`
- [ ] 移除 `animation-delay: index * 30ms`
- [ ] 移除 `will-change: [transform,opacity]`
- [ ] 移除迷你钢琴键盘预览（`pianoKeysFor` 函数及 SVG）
- [ ] 移除音符 `badge` 标签
- [ ] 卡片样式 `w-full h-28 bg-base-100 rounded-xl border border-base-200 shadow-sm`
- [ ] 卡片内容居中显示和弦名称 `text-lg font-bold` + 音程 `text-xs text-base-content/50 mt-1`
- [ ] 选中 `ring-2 ring-primary`
- [ ] 悬停 `hover:border-primary/30 transition-colors duration-150`
- [ ] 加载态 skeleton `h-28 rounded-xl`
- [ ] 空结果 `text-center text-base-content/40 py-20`

### Task 14: 重写 ChordCategoryTree.vue

- [ ] 移除自定义 ▶ 符号，使用 details 原生箭头
- [ ] 选中分类 `bg-primary/10 text-primary font-semibold`
- [ ] 子类型 `py-1 px-2 text-xs rounded hover:bg-base-200`

### Task 15: 重写 ChordDictionaryToolbar.vue

- [ ] 移除 `sticky top-0 z-10`
- [ ] 容器 `bg-base-100 border-b border-base-200`
- [ ] 下拉菜单 `bg-base-100 border border-base-200 rounded-lg shadow-lg`
- [ ] 交互模式切换改为分段按钮样式

### Task 16: 重写 ChordDictionaryChromaMenu.vue / ChordDictionaryChordMenu.vue / ChordMenuGroup.vue / ChordMenuItem.vue

- [ ] 使用纯 flex 按钮替代 `menu bg-base-100` DaisyUI 样式
- [ ] 选中 `bg-primary text-primary-content`
- [ ] 移除 `ring-2 ring-accent bg-accent/10` 样式

### Task 17: 重写 ChordDictionaryModuleProvider.vue

- [ ] 无样式变更（纯逻辑组件）

### Task 18: 重写 ChordSearch.vue / ChordSearchOption.vue

- [ ] 下拉面板 `bg-base-100 border border-base-200 rounded-lg shadow-lg`
- [ ] 移除 `card bg-base-100 shadow-xl` 等装饰
- [ ] ChordSearchOption 移除 `bg-success text-success-content` 样式

### Task 19: 重写 ChordDetail.vue

- [ ] 所有容器使用 `border border-base-200 rounded-lg` 替代 `bg-base-200/50 rounded-lg`
- [ ] 所有折叠面板使用原生 `<details>` 替代 `collapse collapse-arrow`
- [ ] 键盘区域、五线谱区域使用标准边框容器

### Task 20: 重写 EmptyChordDetail.vue

- [ ] 移除 `card bg-base-100 shadow-lg p-8`
- [ ] 纯 flex 居中布局
- [ ] 标准提示文字

### Task 21: 重写 ChordBasicInfo.vue / ChordAliases.vue / ChordInversions.vue / ChordAlternatives.vue / ChordRelated.vue

- [ ] ChordBasicInfo：`border-b border-base-200` 替代 `border-b-2 border-base-content/12`
- [ ] ChordAliases：移除 `flex-basis-[320px]`、`border-l-[3px]`、`collapse` 装饰
- [ ] ChordInversions：同 ChordAliases
- [ ] ChordAlternatives：标准列表样式
- [ ] ChordRelated：按钮使用 `btn btn-sm rounded-full border border-base-200`

### Task 22: 重写 ChordDisplay.vue

- [ ] 移除 `bg-gradient-to-br` 光晕、`backdrop-blur` 玻璃态
- [ ] 纯垂直布局（无 `splitpanes`）
- [ ] 所有容器 `p-4 border border-base-200 rounded-lg`
- [ ] 和弦名称 `text-4xl sm:text-5xl font-bold tracking-tight`
- [ ] 等待状态 `text-base-content/30`
- [ ] 备选和弦底部横向滚动 `flex gap-2 overflow-x-auto`

### Task 23: 重写 ChordQuiz.vue

- [ ] 信息栏 `flex justify-between items-center w-full`（得分+进度+计时器）
- [ ] 进度条 `h-1 bg-base-200 rounded-full`、填充 `bg-primary`
- [ ] 目标和弦 `text-4xl font-bold tracking-wider`
- [ ] 正确反馈 `bg-success/10 ring-2 ring-success p-4 rounded-lg`
- [ ] 错误反馈 `bg-error/10 ring-2 ring-error p-4 rounded-lg`
- [ ] 提示 `text-sm text-base-content/70 italic`
- [ ] 移除色盲友好 badge 装饰

### Task 24: 重写 GameList.vue / Reaction.vue

- [ ] GameList：`p-4 border border-base-200 rounded-lg` 游戏项
- [ ] Reaction：纯文字居中

### Task 25: 重写 CircleOfFifths.vue

- [ ] 移除光晕环、`animate-pulse` 脉动效果
- [ ] SVG 居中 `max-w-2xl w-full mx-auto`
- [ ] 信息面板 `p-4 border border-base-200 rounded-lg`
- [ ] 快速切换按钮 `flex-shrink-0 px-3 py-1.5 text-sm border border-base-200 rounded-lg`

### Task 26: 重置 CircleFifths.vue 及 13 个子组件

- [ ] 移除所有 CSS 动画（`animate-spin`、`<animate>` 等）
- [ ] 纯色填充 + `stroke-base-content/20` 描边
- [ ] 文本使用 `fill-base-content`、`text-xs font-medium`
- [ ] 子组件全清单：Alteration, Arrow, DegreeLabel, DegreeLabels, Degrees, Diminished, Dominants, Label, Major, Minor, Modes, SusLabel, Suspended

---

## 阶段 5：设置页面群组（13 任务）

### Task 27: 重写 SettingsLayout.vue

- [ ] 移除抽屉弹簧滑入动画（`slide-right` Transition）
- [ ] 使用仅 `opacity` 过渡 100ms
- [ ] 侧边导航 `w-48 border-r border-base-200 p-4`

### Task 28: 重写 GeneralSettings.vue

- [ ] `max-w-3xl mx-auto py-6 space-y-6`
- [ ] 设置分组 `p-4 border border-base-200 rounded-lg`
- [ ] 分组标题 `text-base font-semibold mb-4`
- [ ] DaisyUI 标准表单控件

### Task 29: 重写 ChordDictionarySettings.vue

- [ ] 蓝色调暗示：`border-info/20` 边框、`bg-info/5` 标题背景

### Task 30: 重写 ChordDisplaySettings.vue

- [ ] 绿色调暗示：`border-success/20` 边框

### Task 31: 重写 ChordQuizSettings.vue

- [ ] 橙色调暗示：`border-warning/20` 边框

### Task 32: 重写 CircleOfFifthsSettings.vue

- [ ] 紫色调暗示：`border-secondary/20` 边框

### Task 33: 重写 NotationSettings.vue

- [ ] 标签页切换 `border-b border-base-200`，选中 `border-primary text-primary`

### Task 34: 重写 CursorSettings.vue

- [ ] 简短开关列表

### Task 35: 重写 Routing.vue

- [ ] `h-[calc(100vh-8rem)] bg-base-300 rounded-lg overflow-hidden`
- [ ] 保留 loading/error 状态

### Task 36: 重写 Debugger.vue

- [ ] `bg-base-300 rounded-lg p-4 font-mono text-sm` 终端风格

### Task 37: 重写 About.vue

- [ ] 居中布局 `flex flex-col items-center justify-center py-16`

### Task 38: 重写 Licenses.vue

- [ ] 搜索框 `input input-bordered input-sm` + 标准列表

### Task 39: 重写 Routing 子组件（InputNode / OutputNode / MidiFlowGraph / Wire）

- [ ] InputNode：`px-4 py-2 bg-base-100 border border-base-200 rounded-lg shadow-sm`
- [ ] OutputNode：同上
- [ ] MidiFlowGraph：VueFlow 默认样式
- [ ] Wire：VueFlow 默认边样式

---

## 阶段 6：小部件与共用组件（18 任务）

### Task 40: 重写 WidgetPage.vue

- [ ] 紧凑/展开模式逻辑保留
- [ ] 移除装饰效果

### Task 41: 重写 WidgetTitleBar.vue

- [ ] `bg-base-200 border-b border-base-200`
- [ ] `btn btn-ghost btn-xs btn-square` 切换按钮

### Task 42: 重置 Settings 控件组件

- [ ] SettingsCollapse：`border border-base-200 rounded-lg p-3` + 原生 details
- [ ] SettingsToggle：`toggle toggle-sm` DaisyUI 标准
- [ ] SettingsSelect：`select select-bordered select-sm`
- [ ] SettingsRange：`range range-sm`
- [ ] SettingsRadioGroup：`radio radio-sm`
- [ ] SettingsColorPicker：`input type="color" w-8 h-8 border border-base-200`
- [ ] SettingsThemeColorPicker：同 ColorPicker
- [ ] SettingsTextInput：`input input-bordered input-sm`
- [ ] SettingsSection：`p-4 border border-base-200 rounded-lg`

### Task 43: 重置 SettingsModal.vue

- [ ] 使用 `modal modal-middle` / `modal-box` DaisyUI 标准

### Task 44: 重置 Icon.vue

- [ ] `w-5 h-5 fill-current` 标准尺寸

### Task 45: 重置 InputNote.vue

- [ ] `input input-bordered input-sm` + 错误状态 `input-error`

### Task 46: 重置 KeyScaleSelector.vue

- [ ] 分段按钮 `flex rounded-lg border border-base-200 overflow-hidden`

### Task 47: 重置 ThemePicker.vue / ThemeSwitcher.vue

- [ ] `dropdown dropdown-end` + `dropdown-content menu`

### Task 48: 重置 ChordIntervals.vue

- [ ] 标准列表 `space-y-1` + 进度条 `h-1.5 bg-base-200 rounded-full`
- [ ] 保留 `$t('unit.semitones')` i18n

### Task 49: 重置 Notation.vue / NotationLayoutSettings.vue / NotationStyleSettings.vue

- [ ] Notation：`border border-base-200 rounded-lg p-2`
- [ ] LayoutSettings/StyleSettings：标准 SettingsSection

### Task 50: 重置 NavButton.vue

- [ ] `btn btn-ghost btn-sm`

### Task 51: 重置 DrawerOutlet.vue

- [ ] `<div class="drawer"><slot /></div>`

### Task 52: 重置 PopOutButton.vue

- [ ] `btn btn-ghost btn-sm btn-square`

### Task 53: 重置 CustomCursor.vue

- [ ] 默认 `v-if="enabled"` 为 false

### Task 54: 重置 SettingsButton.vue

- [ ] `btn btn-ghost btn-sm btn-square`

### Task 55: 重置 LatencyMonitor.vue

- [ ] `fixed bottom-4 right-4 w-48 bg-base-200/80 rounded-lg p-2 shadow-lg`
- [ ] `text-xs font-mono`
- [ ] 仅开发环境显示

### Task 56: 重置 ChordDisplayAddModal.vue / ChordDisplayList.vue / ChordDisplayModuleSettings.vue

- [ ] AddModal：`modal modal-middle modal-box`
- [ ] List：`space-y-2` + `flex items-center justify-between p-3 border border-base-200 rounded-lg`
- [ ] ModuleSettings：同 GeneralSettings

### Task 57: 重置 ModuleCard.vue（已在 Task 11 中覆盖，确认完成）

---

## 阶段 7：验证与测试（3 任务）

### Task 58: 运行类型检查

- [ ] `vue-tsc --noEmit` 通过
- [ ] 修复所有新产生的类型错误
- [ ] 确认无新增 `any` 类型

### Task 59: 运行单元测试

- [ ] `npx vitest run` 全部通过
- [ ] 确保 23 个测试用例均通过

### Task 60: 运行构建

- [ ] `npm run build` 成功
- [ ] `npm run tauri:dev` 无编译错误
- [ ] 确认无 `Cannot apply unknown utility class` 类错误

---

## 任务依赖关系图

```
阶段 1: 基础设施（Task 1-3）
   ↓
阶段 2: 核心组件（Task 4-7）
   ↓
阶段 3: 导航（Task 8-9）
   ↓
阶段 4: 主页面（Task 10-26）──┬── 阶段 5: 设置页（Task 27-39）──┬── 阶段 6: 组件（Task 40-57）
   ↓                              ↓                              ↓
   └──────────────────────────────┴──────────────────────────────┘
                                    ↓
                              阶段 7: 验证（Task 58-60）
```

- Task 1-3 是所有后续任务的前提
- Task 4-5（ChordName）被多个页面引用，需优先完成
- Task 6-7（PianoKeyboard）被 ChordDisplay/ChordDetail/ChordQuiz 引用
- Task 8-9（导航）影响所有页面的全局体验
- Task 10-26（主页面）可并行实施
- Task 27-39（设置页）可并行实施
- Task 40-57（组件）可并行实施
- Task 58-60 在所有实施任务完成后执行
