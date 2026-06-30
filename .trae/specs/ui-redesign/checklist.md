# Checklist

## 阶段一：色彩系统与基础设施

- [ ] 代码中无 `#e81123`、`text-orange-500`、`rgba(0,0,0,0.6)`、`hsl(var(...))` 硬编码颜色
- [ ] `grep -rn "rgba\|#[0-9a-fA-F]\{6\}\|hsl(" src/` 无残留
- [ ] 文本阴影使用 `oklch` 主题感知表达式
- [ ] PianoKeyboard 默认颜色跟随主题切换
- [ ] `tailwind.css` `themes:` 仅 5 个主题
- [ ] `theme.ts` ALL_THEMES 为 5 个精选主题
- [ ] `toggleTheme()` 记忆亮/暗偏好（非总回退到 `light`）
- [ ] 首次访问自动匹配 `prefers-color-scheme`
- [ ] `src/helpers/icon-map.ts` 存在并导出 `mapMdiToIcon()`
- [ ] AppBreadcrumb 和 ModuleCard 使用共享图标映射
- [ ] i18n 新增 key：`unit.semitones`、引导文案

## 阶段二：ChordName 重写

- [ ] 无 Vuetify 类名残留
- [ ] 根音 `font-bold tracking-tight`，修饰符 `italic text-base-content/60`
- [ ] `highlightAlterations`：♯→`text-warning bg-warning/10`，♭→`text-info bg-info/10`
- [ ] 分隔符 `/` 使用 `text-base-content/40`
- [ ] `size` prop 支持 `"sm"|"md"|"lg"|"xl"` 并正确映射
- [ ] `<Transition name="chord-pop">` 入场动画 150ms
- [ ] 所有引用页面（ChordDisplay/ChordQuiz/CoF/CardGrid）和弦显示正确

## 阶段三：导航系统

- [ ] AppNavbar 自定义 CSS ≤ 10 行
- [ ] 使用 `bg-base-100/40 backdrop-blur-md` 玻璃态浮动
- [ ] 面包屑为胶囊式 badge（`badge-ghost` / `badge-primary`）
- [ ] 面包屑分隔符为 `›` 而非 `/`
- [ ] 移动端菜单 DaisyUI `dropdown` + `menu` + 200ms 动画
- [ ] macOS 拖拽区域不再硬编码 78px
- [ ] QuickChangeKeyToolbar 已移除/合并
- [ ] 分段控制器样式调号选择器（横向滚动 12 音名）
- [ ] 首页 Hero 搜索框存在并可跳转

## 阶段四：五个核心页面

### ChordDictionary

- [ ] 首次加载默认 C 根音 + quality 分组
- [ ] 和弦卡片 staggered 入场动画（`n × 30ms`）
- [ ] 详情使用滑入式抽屉（`translateX` + 玻璃态 + 外部点击关闭）
- [ ] 悬浮 >500ms 弹出气泡预览
- [ ] 骨架加载器（12 个占位卡片 + 详情占位）
- [ ] 移动端 `pb-[env(safe-area-inset-bottom)]`
- [ ] 无匹配结果时"未找到符合条件的和弦"提示

### ChordDisplay

- [ ] 页面顶部光晕层可见
- [ ] 所有子区域统一玻璃态容器
- [ ] `gap-20` 已修复 → `gap-4`
- [ ] 备选和弦浮动面板（`fixed bottom-4 right-4` + 可拖拽）
- [ ] 浮动面板中当前和弦 `ring-2 ring-primary` 高亮
- [ ] `splitpanes` 拖拽分割（≥1024px）
- [ ] 全部关闭时显示引导提示
- [ ] 无 inline style，全用 Tailwind

### ChordQuiz

- [ ] ✓+success / ✗+error / ⓘ+warning 渐变 badge
- [ ] 游戏完成状态：得分动画 + "再玩一次" + "分享"
- [ ] 自动推进模式（正确 500ms 后自动，错误不跳，设置可关）
- [ ] 动画 ≤ 200ms（非 500ms）
- [ ] 底部 home 按钮 `opacity-80`

### CircleOfFifths

- [ ] 外围渐变光晕环可视
- [ ] MIDI 输入时 `animate-pulse` 呼吸效果
- [ ] 无 MIDI 时引导提示
- [ ] `disableUpdate` badge 指示器
- [ ] 交互 tooltip

### Layout

- [ ] `<Transition name="page">` 路由切换 `scale-95→100` + `opacity` 200ms
- [ ] SettingsLayout 抽屉弹簧滑入动画
- [ ] 所有页面 `max-w-[1400px] mx-auto` 居中
- [ ] 移动端 `btm-nav` 5 图标 + 安全区域

## 阶段五：细节与可访问性

- [ ] 按钮涟漪效果（ripple）生效
- [ ] MIDI 键盘波纹动画
- [ ] 卡片弹性悬停 `scale-[1.02]` + `shadow-2xl`
- [ ] `prefers-reduced-motion` 禁用非必要动画
- [ ] 动画元素标注 `will-change`
- [ ] 动画仅 `transform` + `opacity`
- [ ] Home 无模块引导卡片
- [ ] WidgetPage 加载 spinner
- [ ] ChordDetail 无效和弦错误提示
- [ ] ModuleCard 无嵌套 `<a>` 标签
- [ ] ChordDetail 键盘配置从 store 读取
- [ ] ChordIntervals "半音" i18n
- [ ] PianoKeyboard 每个键 `aria-label="C4"`
- [ ] SettingsModal 焦点陷阱 + ESC 恢复
- [ ] Widget 紧凑/展开模式可用
- [ ] PianoKeyboard 指法提示可视
- [ ] Light/Dark 双主题视觉一致

## 构建验证

- [ ] `npx vue-tsc --noEmit` 无新增类型错误
- [ ] `npx vitest run` 全部测试通过
- [ ] `npm run format:fix` 格式化通过
- [ ] `npm run dev` 无样式/主题警告
- [ ] CSS 包体积显著小于优化前
