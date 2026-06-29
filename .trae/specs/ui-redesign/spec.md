# UI 激进重新设计 Spec

## Why
MIDI-JAR 当前 UI 为功能导向的工程界面——缺乏视觉魅力、无品牌个性、交互生硬。五个核心页面风格割裂，间距/色彩/排版无统一标准，核心组件 ChordName 使用无效 Vuetify 类名导致显示错误，导航栏 44 行自定义 CSS 含 20+ 硬编码像素值。本次激进重设计旨在将 MIDI-JAR 从"能用"升级为"想用"，在保留所有现有功能的前提下，注入现代设计语言、精致的视觉细节和流畅的动态交互。

## 设计理念
**「音乐可视化」**——将音乐的秩序感与创造力融入界面设计。采用以下设计语言：
- **玻璃态深度 (Glassmorphism Depth)**：半透明卡片叠加，`backdrop-blur` + 微妙渐变营造空间层次
- **有机微交互 (Organic Micro-interactions)**：弹性反馈 (spring-based)、磁吸悬停 (magnetic hover)、交错入场动画 (staggered entrance)
- **渐变装饰 (Gradient Accents)**：主题色渐变光晕作为页面氛围装饰，避免平面单调感
- **极简排版 (Minimal Typography)**：大字号标题 + 充裕留白 + RockerColorGX 品牌字体
- **响应式杂志布局 (Magazine Grid)**：非对称卡片布局，打破传统对称网格

## What Changes

### 1. 激进视觉布局
- 首页采用 **hero banner** + **杂志风格网格**，打破对称四列网格，引入 `col-span-2` 宽卡片
- 每个页面顶部引入 **渐变光晕背景**（`bg-gradient-to-br from-primary/5 via-transparent to-accent/5`）
- 内容区块使用 **玻璃态容器**：`bg-base-100/60 backdrop-blur-xl border border-base-300/20 rounded-2xl shadow-2xl`
- ChordDisplay 侧边备选和弦使用 **浮动面板**：`fixed` 定位 + 毛玻璃 + 拖拽把手
- ChordDictionary 详情面板使用 **滑入式抽屉**（slide-in drawer）替代固定右侧面板
- CircleOfFifths 五度圈外围增加 **旋转光晕环**，有 MIDI 输入时脉动发光

### 2. 色彩方案升级
- 主色渐变：按钮和关键元素使用 `from-primary to-accent` 渐变背景
- 功能性发光：MIDI 连接状态使用呼吸灯效果（`animate-pulse` + `drop-shadow`）
- 和弦正确/错误反馈使用渐变 badge：`bg-gradient-to-r from-success to-success/80`
- 暗色主题增强：`drop-shadow-[0_0_15px_rgba(var(--p),0.3)]` 类发光效果
- 5 个精选主题覆盖：`light, dark, cupcake, synthwave, forest`

### 3. 动态过渡系统
- 路由切换：`<Transition name="page">` 含缩放+淡入淡出（`scale-95 → scale-100` + `opacity 0→1`）
- 和弦卡片入场：staggered 交错动画，每个卡片延迟 `n × 30ms`
- 弹性悬停：`hover:scale-[1.02] transition-[transform,shadow] duration-300 ease-spring`
- 设置面板：`<Transition name="slide-right">` 40px 滑入 + 弹簧回弹
- MIDI 活动指示器：音符按下时键盘波纹扩散动画（`animate-ripple` 自定义 keyframe）
- 游戏得分弹出：数字跳动计数器动画（`@keyframes countUp`）

### 4. 导航体验重构
- AppNavbar 改为 **极简浮动栏**：`bg-base-100/40 backdrop-blur-md` 半透明悬浮
- 面包屑使用 **胶囊式标签**（`badge` 样式），当前页 `badge-primary` 高亮
- 首页导航：**大型图标网格** + **快捷搜索卡片**（输入和弦名直接跳转词典）
- 移动端：**底部导航栏**（Bottom Navigation Bar）5 图标，类似 iOS Tab Bar
- 调号选择器：**旋转刻度盘**样式（circular picker）或至少为分段控制器代替下拉

### 5. 操作流程创新
- ChordDictionary "快速预览"：悬浮和弦卡片时弹出迷你详情气泡（tooltip card）
- ChordQuiz "连续挑战模式"：无需点击下一题，弹奏正确自动推进
- PianoKeyboard "指法提示"：演奏时在键盘上方显示手指位置标注
- 设置页各模块使用 **全屏沉浸式面板**（full-screen sheet），带大标题和透明导航
- Widget 窗口提供 **紧凑/展开** 两种布局模式，一键切换

### 6. 性能与渐进增强
- CSS 主题从 35 减至 5 个（减少约 80% 体积）
- 和弦数据懒加载（已实现）
- 骨架加载器（skeleton）覆盖 ChordDictionary 列表、ChordDetail 详情、Home 模块卡片
- 动画仅使用 `transform` + `opacity`（GPU 加速），禁用 `width`/`height` 过渡
- 所有过渡 ≤ 300ms，微交互 ≤ 150ms，确保交互响应 < 100ms

### 7. 响应式与全平台一致
- 桌面端三栏 → 平板两栏 + 浮动详情抽屉 → 移动端单栏 + 底部 TabBar
- iPad 横屏：ChordDisplay 使用 `splitpanes` 实现拖拽分割面板
- AppNavbar 移动端：收起为底部导航栏（5 图标），桌面端恢复顶部栏
- 移动端底部安全区域：`pb-[env(safe-area-inset-bottom)]`
- Widget 窗口自动检测大小并切换紧凑/展开模式

## Impact
- Affected specs: `comprehensive-optimization`（已完成）
- Affected pages: **ChordDictionary**、**ChordDisplay**、**ChordQuiz**、**CircleOfFifths**、**Layout**（Home/Navbar/Settings）
- Affected code: `src/views/`（全部 5 个核心页面）、`src/views/Layout/`（AppNavbar/AppLayout/AppBreadcrumb）、`src/components/ChordName/`、`src/components/PianoKeyboard/`、`src/styles/tailwind.css`、`src/stores/theme.ts`、`src/locales/`、`src/helpers/icon-map.ts`（新建）

---

## ADDED Requirements

---

### Requirement 1: 激进视觉布局系统
系统 SHALL 采用玻璃态深度 + 渐变装饰 + 杂志网格的现代视觉布局。

#### 1.1 页面基础容器
- **WHEN** 用户在任意核心页面
- **THEN** 页面顶部有 `bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none` 氛围光晕层
- **AND** 内容区域使用 `mx-auto max-w-[1400px] p-4 sm:p-6` 居中约束
- **AND** 内容区块使用 `bg-base-100/60 backdrop-blur-xl border border-base-300/20 rounded-2xl shadow-2xl p-4 sm:p-6` 玻璃态容器

#### 1.2 首页杂志网格
- **WHEN** 用户访问首页
- **THEN** 顶部显示 hero 区域：品牌 Logo + 标语 "MAKE MUSIC VISIBLE" + 渐变光晕
- **AND** Chord Display 模块使用 `col-span-1 lg:col-span-2` 宽卡片突出显示
- **AND** 固定模块（Quiz/CoF/Dictionary/Routing/Debugger）使用标准 `col-span-1` 卡片
- **AND** 卡片网格：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

#### 1.3 ChordDictionary 滑入式详情
- **WHEN** 用户在 ChordDictionary 点击一个和弦
- **THEN** 详情面板从右侧以 `translateX(0)` 弹簧动画滑入（替代固定 `w-96` 右侧面板）
- **AND** 详情面板宽度 `w-full max-w-md lg:max-w-lg`，带 `backdrop-blur-2xl` 玻璃态背景
- **AND** 点击面板外部区域或关闭按钮关闭面板

#### 1.4 ChordDisplay 浮动备选和弦
- **WHEN** 备选和弦列表显示
- **THEN** 备选和弦以 `fixed bottom-4 right-4` 浮动面板展示
- **AND** 面板可拖拽移动、`backdrop-blur-xl bg-base-100/70 rounded-2xl shadow-2xl`
- **AND** ✓ 当前匹配和弦以 `ring-2 ring-primary` 环形高亮

#### 1.5 CircleOfFifths 光晕环
- **WHEN** CircleOfFifths 页面渲染
- **THEN** 五度圈外围有 `from-primary/10 to-accent/5` 渐变光晕环
- **AND** 有 MIDI 输入时，光晕环使用 `animate-pulse duration-[2s]` 呼吸灯效果
- **AND** 无 MIDI 输入时显示静态淡光晕

---

### Requirement 2: 协调色彩与渐变系统
系统 SHALL 构建主题感知的渐变 + 发光色彩体系。

#### 2.1 色彩 Token 扩展
| 角色 | Token | 渐变/发光扩展 |
|------|-------|--------------|
| **主操作** | `primary` | `bg-gradient-to-r from-primary to-accent` 渐变按钮 |
| **玻璃面板** | `base-100/60` | `backdrop-blur-xl border-base-300/20` |
| **氛围光晕** | `primary/5 → accent/5` | `bg-gradient-to-br` 页面装饰 |
| **成功反馈** | `success` | `bg-gradient-to-r from-success to-success/80` |
| **错误反馈** | `error` | `bg-gradient-to-r from-error to-error/80` |
| **MIDI 活跃** | `primary` | `drop-shadow-[0_0_15px_var(--p)] animate-pulse` |

#### 2.2 硬编码颜色消除
- **WHEN** 扫描代码中任何样式属性
- **THEN** 不存在 `#e81123`、`text-orange-500`、`rgba(0,0,0,0.6)`、`hsl(var(...))` 硬编码颜色
- **AND** AppNavbar 关闭按钮 → `bg-error hover:bg-error/80 transition-colors duration-150`
- **AND** 文本阴影 → `text-shadow-[0_1px_4px_oklch(var(--b1)/0.1)]`

#### 2.3 主题系统
- **WHEN** 构建 CSS bundle
- **THEN** 仅 5 主题：`light, dark, cupcake, synthwave, forest`
- **AND** `toggleTheme()` 记忆用户亮色/暗色偏好
- **AND** 首次访问匹配 `prefers-color-scheme`

---

### Requirement 3: 动态过渡与微交互系统
系统 SHALL 建立多层次的动画和微交互体系。

#### 3.1 路由过渡
- **WHEN** 用户导航到新路由
- **THEN** `<Transition name="page">` 实现 `scale-95→100` + `opacity 0→1` 200ms ease-out
- **AND** 旧页面同期 `opacity 1→0` 100ms 淡出

#### 3.2 交错入场动画 (Staggered Entrance)
- **WHEN** ChordDictionary 和弦卡片列表首次渲染或根音切换
- **THEN** 每个卡片依次入场：`@keyframes cardEntrance` from `scale(0.9) translateY(12px) opacity(0)`
- **AND** 第 n 个卡片 `animation-delay: n × 30ms`，总动画 300ms

#### 3.3 弹性微交互
- **WHEN** 用户 hover ModuleCard 或和弦卡片
- **THEN** `hover:scale-[1.02] transition-[transform,box-shadow] duration-200 ease-out`
- **AND** `hover:shadow-2xl hover:shadow-primary/5`

#### 3.4 按钮涟漪效果
- **WHEN** 用户点击任何主要操作按钮
- **THEN** 按钮中心扩散圆形波纹（`@keyframes ripple` 从 0 到 150% 尺寸 + opacity 渐变）
- **AND** 使用 `::after` 伪元素 + JS 获取点击坐标

#### 3.5 MIDI 键盘波纹 (Ripple on Piano)
- **WHEN** MIDI 音符按下触发钢琴键高亮
- **THEN** 按键表面扩散一圈 `ring-2 ring-primary/50 animate-[ripple_0.5s_ease-out]` 波纹
- **AND** 波纹从按键中心扩散至边缘后消失

#### 3.6 得分计数器动画
- **WHEN** ChordQuiz 显示分数变化
- **THEN** 数字使用 `@keyframes countUp` 滚动效果（或至少 `transition-all duration-300` 数字替换）

#### 3.7 设置面板滑入
- **WHEN** 设置抽屉展开或面板打开
- **THEN** `<Transition name="slide-right">` 从右侧 30px 滑入 + 弹簧回弹（`ease-[cubic-bezier(0.34,1.56,0.64,1)]`）

---

### Requirement 4: 导航体验重构
系统 SHALL 提供极简浮动导航 + 胶囊面包屑 + 底部 TabBar。

#### 4.1 极简浮动 AppNavbar
- **WHEN** 应用渲染顶部导航栏
- **THEN** 使用 `bg-base-100/40 backdrop-blur-md sticky top-0 z-50 border-b border-base-300/20 h-12`
- **AND** 左侧：macOS 拖拽区域 (78px) + 面包屑胶囊导航
- **AND** 中间：应用标题 / 当前页面名称
- **AND** 右侧：调号选择器 + 主题切换 + 设置齿轮 + 窗口控制
- **AND** 自定义 CSS 控制在 10 行以内，其余使用 Tailwind 工具类

#### 4.2 胶囊面包屑
- **WHEN** 面包屑组件渲染
- **THEN** 每个层级使用 `badge badge-sm` 样式，可点击的上游层级 `badge-ghost`，当前页 `badge-primary`
- **AND** 分隔符使用 `›` 字符（`text-base-content/40`）替代 `/`
- **AND** 可点击区域 `min-h-[28px]` 确保触控友好

#### 4.3 移动端底部导航栏
- **WHEN** 屏幕宽度 < 768px
- **THEN** 顶部 Navbar 隐藏（仅显示应用标题），导航切换到底部 `btm-nav` 组件
- **AND** 5 个图标：Home、Dictionary、Quiz、Circle、Settings
- **AND** 带 `pb-[env(safe-area-inset-bottom)]` 底部安全区域适配
- **AND** 当前激活图标 `active` 状态 = `text-primary scale-110` 弹性放大

#### 4.4 首页快捷搜索
- **WHEN** 用户在首页
- **THEN** Hero 区域下方显示搜索输入框："输入和弦名称快速查找..."
- **AND** 输入时实时过滤 chord-dictionary 中的和弦选项（debounce 200ms）
- **AND** 选中后直接跳转 `/chord-dictionary/{chordName}`

#### 4.5 调号选择器统一
- **WHEN** 用户选择调号或音阶
- **THEN** 使用分段控制器样式（segmented control）替代 `<select>` 下拉：`C C# D D# E F F# G G# A A# B` 横向滚动
- **AND** 选中项 `bg-primary text-primary-content rounded-full`

---

### Requirement 5: 操作流程创新
系统 SHALL 引入智能默认、自动推进、快速预览等创新交互。

#### 5.1 ChordDictionary 首次加载
- **WHEN** 用户首次进入 ChordDictionary
- **THEN** 默认选中 C 根音 + quality 分组，和弦卡片以 staggered 动画入场
- **AND** 顶部显示提示 banner："点击任意和弦查看详情"（3 秒后自动消失）

#### 5.2 和弦卡片悬浮预览
- **WHEN** 用户在 ChordDictionary 中 hover 和弦卡片超过 500ms
- **THEN** 弹出迷你气泡：显示和弦名称 + 音程结构 + "点击查看详情"提示
- **AND** 气泡使用 `bg-base-200/90 backdrop-blur rounded-xl shadow-lg p-3`，带 `animate-[popIn_0.2s_ease-out]` 弹出动画

#### 5.3 ChordQuiz 自动推进模式
- **WHEN** 用户在 ChordQuiz 中弹奏正确和弦
- **THEN** 显示 ✓ 反馈动画后自动推进到下一题（500ms 延迟）
- **AND** 错误时手动点击"下一题"按钮，不自动跳过
- **AND** 可在设置中开启/关闭自动推进

#### 5.4 PianoKeyboard 指法提示
- **WHEN** 检测到 MIDI 和弦输入
- **THEN** 键盘上方显示手指编号（1=拇指 ~ 5=小指）标签，位置基于 chord voicing 推算
- **AND** 标签使用 `absolute -top-6` 定位在对应按键上方

#### 5.5 Widget 紧凑/展开模式
- **WHEN** Widget 窗口宽度 < 400px
- **THEN** 自动切换为紧凑模式：垂直堆叠布局、隐藏次要信息、缩小字号
- **WHEN** Widget 窗口宽度 ≥ 400px
- **THEN** 切换为展开模式：水平并排布局、完整信息显示
- **AND** 用户可手动通过标题栏按钮切换模式

#### 5.6 空状态与引导
- **WHEN** 任何页面数据为空
- **THEN** Home 无模块 → 带插图的引导卡片 + "创建第一个模块"按钮
- **AND** ChordDisplay 元素全关 → "所有显示已关闭" + "前往设置"链接
- **AND** ChordQuiz 完成 → 得分动画（数字跳动 0→最终分）+ "再玩一次"/"分享结果"
- **AND** CircleOfFifths 无 MIDI → 键盘图标 + "请连接 MIDI 设备开始交互"

---

### Requirement 6: 性能与渐进增强
系统 SHALL 在激进视觉的同时确保流畅体验。

#### 6.1 动画规范
- **WHEN** 任何 CSS 动画执行
- **THEN** 路由过渡 ≤ 300ms，微交互 ≤ 150ms，入场动画总时长 ≤ 400ms
- **AND** 仅使用 `transform` + `opacity` 做动画（GPU 合成层），禁用 `width`/`height`/`top`/`left` 过渡
- **AND** 使用 `will-change: transform, opacity` 标注即将动画的元素
- **AND** 使用 `prefers-reduced-motion` 媒体查询禁用所有非必要动画

#### 6.2 渐进加载
- **WHEN** 用户打开数据密集页面
- **THEN** 先渲染骨架加载器（skeleton pulse），数据就绪后替换为实际内容
- **AND** ChordDictionary 和弦卡片列表 skeleton：`grid` 占位卡片 × 12
- **AND** ChordDetail skeleton：标题 + 段落 + 键盘占位区
- **AND** Home skeleton：卡片占位 × 模块数量

#### 6.3 资源优化
- **CSS 主题**：35 → 5，减少约 80%
- **和弦数据**：懒加载（已实现）
- **SVG 图标**：内联并 `tree-shake`，仅加载实际使用的图标
- **字体**：RocherColorGX 仅标题使用，正文使用系统字体
- **设置防抖**：500ms（已实现）

---

### Requirement 7: 响应式全平台一致
系统 SHALL 在 Desktop/Tabet/Phone 实现协调的响应式体验。

#### 7.1 ChordDictionary 响应式
- **≥ 1024px**：三栏（类别树 + 网格 + 滑入详情面板）
- **768-1023px**：两栏（类别树 + 网格），详情通过全屏 sheet 打开
- **< 768px**：单栏 + 底部 TabBar 切换 views

#### 7.2 首页响应式
- **≥ 1024px**：hero banner + 杂志网格 `grid-cols-3`（含 `col-span-2` 宽卡片）
- **768-1023px**：hero banner + `grid-cols-2`
- **< 768px**：紧凑 hero + `grid-cols-1` + 底部 TabBar

#### 7.3 AppNavbar/底部导航响应式
- **≥ 768px**：浮动顶部 Navbar（面包屑 + 调号 + 设置 + 窗口控制）
- **< 768px**：顶部仅标题 + 系统按钮，底部 `btm-nav` 5 图标导航

#### 7.4 ChordDisplay 响应式
- **≥ 1024px**：水平双栏（notation left, chord+intervals+keyboard right）使用 `splitpanes`
- **< 1024px**：垂直堆叠，notation 顶部、keyboard 底部

#### 7.5 移动端安全区域
- **WHEN** 页面包含固定底部元素
- **THEN** 使用 `pb-[env(safe-area-inset-bottom,16px)]` 适配 iPhone notch/dynamic island
- **AND** 水平方向使用 `px-[env(safe-area-inset-left)]` 和 `px-[env(safe-area-inset-right)]`

---

### Requirement 8: ChordName 组件激进重写
系统 SHALL 完全重写 ChordName 为高表现力组件。

#### 8.1 功能完整性与视觉增强
- **WHEN** 渲染和弦名称
- **THEN** 根音 `font-bold tracking-tight`，修饰符 `italic text-base-content/60`，分隔符 `/` 使用 `text-base-content/40`
- **AND** `highlightAlterations` 启用时：♯ 用 `text-warning bg-warning/10 rounded px-0.5` 高亮，♭ 用 `text-info bg-info/10 rounded px-0.5` 高亮
- **AND** 无 Vuetify 类名残留
- **AND** 支持 `size` prop：`"sm" | "md" | "lg" | "xl"` 控制整体字号

#### 8.2 入场动画
- **WHEN** 和弦名称首次渲染或内容变化
- **THEN** 使用 `<Transition name="chord-pop">` 实现 `scale-90→100` + `opacity 0→1` 150ms 弹性入场

---

### Requirement 9: 可访问性 & 色盲友好
系统 SHALL 确保视觉增强不牺牲可访问性。

#### 9.1 ChordQuiz 多维度状态
- **WHEN** 和弦识别结果反馈
- **THEN** 正确 ✅：`bg-gradient-to-r from-success to-success/80` badge + ✓ 图标
- **AND** 错误 ❌：`bg-gradient-to-r from-error to-error/80` badge + ✗ 图标
- **AND** 超集 ⓘ：`bg-gradient-to-r from-warning to-warning/80` badge + ⓘ 图标

#### 9.2 焦点陷阱
- **WHEN** 任何 modal/drawer/sheet 打开
- **THEN** 焦点自动移至第一个可聚焦元素，Tab 键在容器内循环
- **AND** ESC 关闭并恢复焦点至触发按钮

#### 9.3 图标与国际化
- **WHEN** 组件显示文本
- **THEN** ChordIntervals "半音" → `$t('unit.semitones')`
- **AND** 所有 aria-label 使用 i18n
- **AND** `mapMdiToIcon()` 统一抽取到 `src/helpers/icon-map.ts`

#### 9.4 动画尊重用户偏好
- **WHEN** 系统设置 `prefers-reduced-motion: reduce`
- **THEN** 禁用全部非必要动画（staggered entrance、弹性交互、pipipple、计数器动画）
- **AND** 仅保留路由切换瞬时过渡

---

## MODIFIED Requirements

### Requirement: 主题系统（修改）
**Before**: `themes: all` 35 个全量主题  
**After**: `themes: light, dark, cupcake, synthwave, forest` 5 个精选主题  
**Reason**: 减少约 80% CSS 体积，5 个主题覆盖主流审美

### Requirement: ChordName 组件（修改）
**Before**: Vuetify 无效类名，升降号高亮失效  
**After**: Tailwind 等效类名 + 弹性入场动画 + size prop + 改进高亮  
**Reason**: 核心组件重写是视觉升级的基础

### Requirement: AppNavbar（修改）
**Before**: 44 行自定义 CSS，硬编码像素  
**After**: ≤10 行 CSS，玻璃态浮动栏 + 胶囊面包屑 + 移动端底部 TabBar  
**Reason**: 激进的设计需要从导航开始建立新视觉语言

---

## REMOVED Requirements
无