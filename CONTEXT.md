# CONTEXT.md — UI 架构约定（daisyUI v5 全量重构）

> 本文件由 grill-with-docs 工作流维护。最近更新：2026-08-15（PianoSettings 接线为全局默认键盘 + toKeyboardConfig 自定义色生效）。

## 技术基线

- **daisyUI 5.7.16** + **Tailwind CSS v4.3.3**（`@tailwindcss/vite` 插件驱动，读取 CSS 而非 JS 配置）。
- `tailwind.config.js` 已删除（Tailwind v4 忽略它）。主题与插件在 `src/styles/tailwind.css` 中声明。
- 设计令牌来源：daisyUI 原生 `--color-*` / `--radius-*`；层级 z-index 在 `tailwind.css` 的 `@theme` 中以 `--z-index-*` 定义，生成 `z-overlay` / `z-drawer` / `z-modal` / `z-toast` / `z-cursor` 等工具类。
- **动画引擎：`anime.js` v4.5.0**（`animejs` 包，`import { createAnimatable } from "animejs"`）。仅用于 `CustomCursor` 的 JS 动画，以纯运行时 transform/尺寸/圆角驱动，替代被约束移除的 CSS `transition`。属于 **明确例外**（见下方约束 #1 注释）。

## 硬性约束（违反即视为回归）

1. **禁止自定义 CSS**：不得新增 `<style>` 块、内联 `style`（Tauri `-webkit-app-region` 除外）、`@keyframes`、`animation:`，以及 `transition:` 内联过渡。
   - **例外（anime.js）**：`CustomCursor` 使用 `animejs` 的 `createAnimatable` 在运行时以 JS 驱动 `transform`/尺寸/圆角，**不写任何 CSS 过渡/关键帧**。这是允许的唯一动画手段，禁止回头改用 CSS `transition` 或 `@keyframes` 重写光标动画。
2. **禁止 hig-tokens**：`--hig-*`、`text-hig-*`、`rounded-hig-*`、`duration-hig-*`、`--shadow-hig-*` 等一律不存在，已全量清除。
3. **禁止 Vue `<Transition>` 包裹**：所有进出场动画已移除。
4. **控件必须来自 daisyUI / Tailwind 工具类**：手写控件优先复用现有组件。

## daisyUI v4 → v5 映射（已落地）

| v4 遗留                                | v5 写法                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `form-control`                         | `fieldset`                                                                            |
| `label-text` / `label-text-alt`        | `fieldset-legend` / `label`                                                           |
| `input-bordered` / `select-bordered`   | `input` / `select`（v5 默认带边框）                                                   |
| `alert-sm` / `alert-lg`                | `alert`（尺寸类已移除）                                                               |
| 手写状态点 + `@keyframes status-pulse` | daisyUI `status status-success/warning/error`                                         |
| 手写面包屑                             | daisyUI `breadcrumbs`                                                                 |
| 手写抽屉遮罩/面板 `<style>`            | `fixed inset-0 z-overlay bg-black/40` + `fixed top-0 bottom-0 z-drawer ... shadow-xl` |

## 复用控件库（`src/components`）

- `Settings/`：`SettingsSelect`、`SettingsToggle`、`SettingsTextInput`、`SettingsRadioGroup`、`SettingsSection`、`SettingsRange`、`SettingsCollapse`、`SettingsColorPicker`、`SettingsThemeColorPicker`。
- `common/` 通用原语：`StateDot`（语义状态点，`status: success/warning/error/info/neutral` + `size` props，渲染 daisyUI `status status-*`）、`PageHeader`（页面/浮层标题栏，`title`/`description` props + `#actions` 插槽）、`SettingRow`（标签+控件行，`title`/`description` props + 默认插槽放控件）。新写的标签+控件行、标题栏、状态点必须复用这三个原语，禁止再内联手写。
- 浮层：`common/ConfirmDialog`、`SettingsDrawer`、`DrawerOutlet`（均无 `<Transition>`、无 scoped 样式）。
- 光标：`CustomCursor`（anime.js `createAnimatable` 驱动，实现平滑跟随 / 悬停形变吸附 / 点击脉冲；无 CSS 过渡、无 `<Transition>`）。

## 钢琴设置 → 全局默认键盘（2026-08-15 补充）

- **目标**：让原本无人消费的 `settings.piano`（`PianoSettings` 类型）真正成为各 `PianoKeyboard` 渲染器的默认基础，而非死设置页。
- **桥接函数**：`createKeyboardSettingsFromPiano(piano: PianoSettings): KeyboardSettings`（位于 `src/utils/pianoUtils.ts`，重建自历史遗留的 `src/utils/pianoUtils.ts`）。
- **映射规则**：
  - `from` / `to` / `keyName` 直传；
  - `label = showNoteNames ? piano.label : "none"`（`KeyboardSettings` 由 `label!=="none"` 推导 `showNoteNames`）；
  - `keyCornerRadius → sizes.radius`；
  - `useThemeColors === true`：`skin = "coral"`，`colors.* = null` → 走主题色板；
  - `useThemeColors === false`：`skin = "coral"`（保留主题渐变质感），`colors.white/black/played` 填入 `PianoSettings` 自定义色。
  - `gradientIntensity` 暂无 `KeyboardSettings` 对应字段（渲染器渐变由 `theme` 决定），**暂不参与映射**，保持向后兼容。
- **消费方（全部改为以全局默认键盘为基础）**：
  - `useChordDetail`（和弦字典详情 + 转位）：`keyboardSettings = computed(() => createKeyboardSettingsFromPiano(settings.piano))`，替换原内联写死的 `defaultKeyboardSettings`。
  - `Sampler.vue`：替换退化的 `computed(() => undefined)`。
  - `ChordDisplay.vue`：`moduleSettings.keyboard` 优先；为空时 `??` 回退到 `createKeyboardSettingsFromPiano(settings.piano)`（模块级键盘优先级不变）。
- **`toKeyboardConfig` 颜色优先级调整**（`src/components/PianoKeyboard/utils.ts`）：原逻辑为「主题色板永远压过 `colors.*`」，导致 `KeyboardSettings.colors.*` 形同死字段。改为「`kb.colors.*` 显式值优先，为 null 时回退主题色板」。此改动仅影响 `PianoKeyboard` 组件（`toKeyboardConfig` 的唯一调用方），**不影响** WaterfallPiano（其直接用 `KeyboardConfig`）。`ChordDisplay` 默认模块键盘的显式色与 coral 主题色一致，外观无回归。
- **约束**：`KeyboardSettings.skin` 为严格联合类型（`coral|indigo|midnight`），无法用非法主题哨兵触发自定义色分支；故自定义色通过 `colors.*` 优先于主题的方式生效，而非扩展 skin 联合。

## 排除项（允许的“必要自定义”）

- 渲染层：PixiJS 瀑布流、VexFlow 记谱、@vue-flow 路由图（canvas/SVG，非 HTML 控件，其 `<style>` 保留）。
- Tauri 窗口拖拽区：仅 `-webkit-app-region: drag/no-drag` 以内联 `style` 形式保留。
- **动画：`animejs`**（运行时 JS 驱动，仅用于 `CustomCursor`，详见约束 #1 例外）。

## 验证命令

- 类型：`npm run type-check`（vue-tsc --noEmit）
- lint：`npm run lint`（oxlint）
- 已知预存问题（非本次引入）：全库 `any` 类型 lint 告警（oxlint 仅作 warning，`delegate.ts` 有一处 `no-self-assign` 被标为 error，均为历史遗留、非本次改动引入，且 `build:pre` 不执行 lint，不影响构建）。`AdvancedDebug.vue` 曾因误删残留一个悬空 `</template>` 标签，导致 `PresetManagerDialog` 及 `setAllOpen`/`resetAll` 等被移出模板、触发 `TS6133`，已在本次清理中修复（删除悬空标签并移除 `Icon` 等无引用 import）；MIDI 时钟（`Debugger.vue` 的 `displayTimingClock`/`shouldDisplayMessage` 及 `constants.ts` 的 `MIDI_CLOCK_CMD`/`MIDI_SYSEX_CMD`）已移除；`MidiMessageManager.ts` 的 `debugLog`、`themeColors.ts` 的空 `catch (error)` 与 `SamplerSidebar.vue` 的 `console.log` 已清理。当前无预存 TS6133 错误，`vue-tsc --noEmit` 与 `vite build` 通过。`CustomCursor` 已回退为 anime.js 驱动：跟随（`innerAnim`/outerAnim 位移，RAF 节流）、悬停形变（外圈吸附到目标矩形轮廓并匹配圆角）、点击脉冲（down 收缩 / up 回弹），已随本次改动 `vue-tsc --noEmit` 0 错误通过。`CursorSettings` 新增「动画设置」折叠区：`followDuration`（内圈跟随时长 → `innerAnim` duration）、`hoverDuration`（外圈悬停形变时长 → `outerAnim` duration，变化即重建实例）、`pulseScale`（点击脉冲强度 → down 收缩比例）；并将被取代且无引用的旧 `transitionDuration` 字段从类型（`types/index.ts` 与 `types/settings.ts` 两处重复定义同步）、默认值、locale（zh/en）、UI 及 store 加载迁移中彻底移除。
