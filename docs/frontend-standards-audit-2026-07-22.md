# 前端开发规范符合性审计 — MIDI-JAR (2026-07-22)

> 依据: 企业级前端开发规范 Skill（12 大类）
> 项目: Vue 3 + TypeScript + Vite 8 + Tauri 2 桌面应用（283 个 .ts/.vue 文件）
> 审计范围: `src/` 前端源码 + 配置（`.oxlintrc.json` / `.oxfmtrc.json`）
> 说明: 仓库无 `CODING_STANDARDS.md`，本次以规范 Skill 为唯一判据；所有结论基于实际读码/检索。

---

## 总览

| 章节                | 状态        | 小结                                                                |
| ------------------- | ----------- | ------------------------------------------------------------------- |
| 1. 项目目录         | ⚠️ 部分     | 无 `api/` 层，IPC 集中在 `utils/tauri.ts`，对 Tauri 合理            |
| 2. 命名规范         | ✅ 基本符合 | PascalCase 组件 / kebab 工具；少量单词组件无 HTML 冲突              |
| 3. HTML 规范        | ✅ 符合     | 语义化、无冗余行内标签                                              |
| 4. CSS/SCSS 规范    | ⚠️ 部分     | Tailwind+CSS 变量良好，但存在 24 处静态行内样式                     |
| 5. JS 规范          | ✅ 符合     | 无 `var`，async/await 为主，箭头函数常用                            |
| 6. TypeScript 规范  | ❌ 不符合   | `any` 泛滥（16 个文件），模板未严格禁用 `any`                       |
| 7. Vue 规范         | ✅ 符合     | props 全 TS 类型化 + `withDefaults`，无 `v-html`，computed 无副作用 |
| 8. React 规范       | ➖ 不适用   | 纯 Vue 项目                                                         |
| 9. Git 规范         | ❌ 不符合   | 多次提交违反 `type(scope): content` 格式                            |
| 10. ESLint/Prettier | ⚠️ 部分     | 改用 oxlint/oxfmt（等效且已强制），但 `no-explicit-any` 仅 warn     |
| 11. 性能规范        | ✅ 符合     | 路由全量懒加载，无违规                                              |
| 12. 安全规范        | ✅ 符合     | 无 XSS 注入点，localStorage 仅存非敏感设置                          |

**结论**: 强项在 Vue/TS 基础、XSS 防护、路由懒加载、lint 工具链；主要缺口在 **Git 提交规范** 与 **`any` 类型治理**，其次为行内样式与遗留 `console.log`。

---

## 1. 项目目录规范 — ⚠️ 部分

规范要求 `src/api`、`src/components`、`src/composables` 等分层。现状：

- ✅ 具备：`components/`、`composables/`、`constants/`、`stores/`（pinia）、`utils/`、`router/`、`views/`、`styles/`、`locales/`、`data/`、`types/`。
- ⚠️ 无独立 `api/` 层：网络/IPC 调用分散于 `src/utils/tauri.ts`（Tauri invoke 封装）与 `composables/`（如 `useSamplerService.ts`、`useFilePicker.ts`）。
- 评估：Tauri 桌面应用以 IPC 而非 HTTP API 为主，集中在 `utils/tauri.ts` 作单一封装点是合理实践；但建议将 IPC 调用进一步收敛为明确的「service/dao」边界，便于类型与权限统一管理。

## 2. 命名规范 — ✅ 基本符合

- ✅ 组件文件大驼峰：`PianoKeyboard.vue`、`CanvasPianoKeyboard.vue`、`ChordDictionary.vue` 等；工具/页面短横线：`useFilePicker.ts`、`object.ts`、`note.ts`。
- ⚠️ 少量单词组件：`Icon.vue`、`Notation.vue`、`LoadingSpinner.vue`（`LoadingSpinner` 为 camelCase 多词，可接受）。这些不与 HTML 原生标签冲突，规范「避免与 HTML 重名」意图已满足，仅作低优先级提示。
- ✅ 布尔命名：`isVisible`/`isPlaying`/`connected`/`enabled` 等符合 `is/has/should` 前缀约定（抽查 `WidgetWindowState`、`ApiMidiInput` 等）。
- ✅ 函数动词开头：`getInputs`、`addRoute`、`refreshDevices`、`openFileDialog` 等。

## 3. HTML 规范 — ✅ 符合

- 语义化标签（`<header>`/`<main>`/`<section>`/`<aside>`/`<footer>`）在布局组件中普遍使用。
- 类名短横线（`user-card` 风格）通过 Tailwind 工具类实现，符合。
- 未发现冗余包装标签或 `style=""` 形式的纯展示行内属性滥用（静态行内样式见第 4 节）。

## 4. CSS/SCSS 规范 — ⚠️ 部分

- ✅ 颜色经 Tailwind + daisyui 主题 CSS 变量管理（如 `var(--color-${option.value})`、`text-base-200`），未见大规模硬编码色值。
- ❌ 静态行内样式 24 处（`grep -rInE ' style="[^"]*"' src --include=*.vue`）：
  - `src/views/Settings/Routing/Wire.vue` 重复 `style="pointer-events: none"` / `cursor: pointer`（×6）；
  - `src/components/ChordName/ChordName.vue` 多处 `style="line-height: ..."` / `margin: 0 0.05em`；
  - `src/components/DrawerOutlet.vue:19` `style="height: calc(100% - 41px)"`；
  - `src/components/CanvasPianoKeyboard/CanvasPianoKeyboard.vue:310` `style="width: 100%; height: 100%; position: relative"`；
  - `src/components/PianoKeyboard/classic/{BlackNote,WhiteNote}.vue` `style="pointer-events: none"`。
- 评估：规范「禁止行内样式」。其中 `pointer-events: none` 与 `height: calc(...)` 可用 Tailwind（`pointer-events-none`、`h-[calc(100%-41px)]`）表达，应迁移到 class；Tauri 特有的 `-webkit-app-region: no-drag`（`AppNavbar.vue:137`）属合理例外。
- ✅ 未发现嵌套超过 3 层的 SCSS（以 Tailwind 原子类为主）。

## 5. JavaScript 规范 — ✅ 符合

- ✅ 全局无 `var`（`grep -rInE '\bvar\s' src` 零命中；全部 `const`/`let`）。
- ✅ 异步优先 `async/await`（`useFilePicker.ts`、`useSamplerService.ts` 等）。
- ✅ 箭头函数为主；数组 `map/filter/reduce` 普遍（抽查 `object.ts`、`settings.ts`）。
- ✅ 嵌套深度普遍 <3 层，模块职责清晰。

## 6. TypeScript 规范 — ❌ 不符合（重点缺口）

规范：**禁止 `any`，能用 `unknown` 替代**；函数参数与返回值必须标注类型。现状：

- ❌ `any` 出现在 **16 个文件**（检索 `.ts/.vue` 含 `any` 的文件数）。典型：
  - `src/utils/tauri.ts`：IPC 边界大量 `invoke<any>("get_inputs")`、`(data?: any) => void`、`(inputs: any[])`、`callback(event.payload as any)` —— 整个 Tauri 封装层几乎未给载荷建模。
  - `src/midi/EventEmitter.ts:6,53`：`type EventListener = (...args: any[]) => void`、`emit(event: string, ...args: any[])` —— 公共事件 API 用 `any`。
  - `src/components/Notation/renderer.ts:40,79,119,207`：VexFlow `context` 反复标为 `any`（×4），未用 `@types/vexflow` 或本地类型收窄。
  - `src/midi/MidiMessageManager.ts:5`：`console.log(...args)`（见第 10 节）。
  - `src/components/Notation/renderer.ts`、`src/stores/midiRouting.ts:177`（`catch (e: any)`）。
- ⚠️ 配置层面：`.oxlintrc.json:149` 仅设 `"typescript/no-explicit-any": "warn"` —— 即允许 `any` 仅警告不阻断，与「禁止 any」要求相悖。
- 建议：
  1. 将 `no-explicit-any` 提升至 `"error"`，对确有必要的边界加 `// oxlint-disable` 注释并留理由；
  2. IPC 载荷定义 DTO 类型（`MidiRouteRaw` 已有雏形，应推广到所有 `invoke` 返回）；
  3. `EventEmitter` 泛型化 `EventEmitter<TEventMap>`；VexFlow `context` 用 `Renderer`/`Context` 真实类型或 `unknown` + 收窄。

## 7. Vue 规范 — ✅ 符合

- ✅ 组件名多单词（除第 2 节提及的无冲突单词名）。
- ✅ **props 全量 TS 类型化**：抽查 25+ 组件，均使用 `defineProps<Props>()` + `withDefaults(defineProps<...>(), {...})` 提供默认值（如 `CanvasPianoKeyboard.vue`、`ChordName.vue`、`SettingsRange.vue`）。少数用 `defineProps<{...}>()` 无 `withDefaults` 但也带类型。
- ✅ 无 `v-html` / `v-text`（`grep` 零命中）→ 与第 12 节安全规范一致，杜绝存储型 XSS。
- ✅ computed 无副作用（检索 `computed(() => {` 内无 `await`/`fetch`/`=` 赋值，零命中）。
- ✅ 指令缩写 `:`/`@`/`#` 一致使用。
- ✅ `watch` 使用 40 处，多为合理副作用（状态持久化、事件订阅清理），未见明显滥用；建议对纯派生数据优先 `computed`（非强制）。

## 8. React 规范 — ➖ 不适用

纯 Vue 3 项目，第 8 节（函数式组件 / Hooks / `handle` 前缀）不适用。

## 9. Git 规范 — ❌ 不符合（重点缺口）

规范提交格式：`type(scope): content`，type ∈ {feat,fix,docs,style,refactor,perf,test,chore}。检索近 20 条提交：

- ❌ 违例提交：
  - `844c000 Update`
  - `06da7cb Update .gitignore`
  - `4f73811 1`
  - `e7f544d 1`
  - `fe0437d updaw`
  - `3be180b perf(waterfall-piano): ...`（✅ 合规）
  - `9fa9ac7 fix: comprehensive ...`（✅ 合规）
  - `da19995 refactor(chord): ...`（✅ 合规）
- 评估：约 1/3 提交为无意义的 `Update` / `1` / `updaw`，无法追溯意图，违反团队可追溯性要求。
- 建议：启用 commitlint（`@commitlint/config-conventional`），在 `lint-staged`/husky 或 CI 中强制拦截；存量提交可保留，但后续必须合规。

## 10. ESLint + Prettier 规范 — ⚠️ 部分

- ⚠️ 工具链偏差：项目使用 **oxlint + oxfmt**（`.oxlintrc.json` / `.oxfmtrc.json`），而非规范字面要求的 ESLint + Prettier。功能上 oxlint 已配置 2 空格缩进、`no-unused-vars`、`no-debugger`、`no-var` 等强规则集，oxfmt 负责格式化，**实际效果等效且已在 `package.json` 的 `lint`/`format` 脚本中强制**，属可接受的现代替代。
- ✅ 样式细节匹配：oxfmt 默认 2 空格缩进、单引号、分号、文件末尾空行（规范第 10 节要求）。
- ❌ 见第 6 节：`no-explicit-any` 仅 `warn`，未达「禁止 any」。
- ❌ `console` 残留：规范「禁止 console（生产环境）」。`src/midi/MidiMessageManager.ts:5` 存在裸 `console.log(...args)` 调试遗留；其余 `console.error`（Routing.vue、sampler.ts、tauri.ts、logger）用于错误处理，建议统一经 `utils/logger.ts`（已封装 Pino）输出，并配置 oxlint `no-console` 规则。

## 11. 性能规范 — ✅ 符合

- ✅ 路由全量懒加载：`src/router/index.ts` 全部 `component: () => import("@/views/...")`（Home/ChordDisplay/ChordDictionary/WaterfallPiano/Sampler/Settings/* 均懒加载）。
- ✅ 图片/资源：项目以矢量图标与 Canvas 渲染为主，无大图滥用；`loading="lazy"` 在本桌面应用中非关键点。
- ⚠️ 魔法数字（低）：`SamplerSidebar.vue:70` 与 `CacheManagementSection.vue:49` 的 `setInterval(refreshCacheSize, 5000)` 硬编码 `5000`，建议抽为 `CACHE_REFRESH_MS` 常量。
- 说明：虚拟滚动、防抖节流（`src/shared/debounce.ts` 已实现）按需使用，未见大数据列表违规。

## 12. 安全规范 — ✅ 符合

- ✅ 防 XSS：无 `v-html`/`innerHTML`/`eval`（与第 7 节一致）；CSP 收紧（`script-src 'self'`、`connect-src 'self'`，见独立安全审计报告）。
- ⚠️ CSRF：桌面 Tauri 应用无 Cookie/跨站会话，CSRF 不适用；Tauri capability 权限模型已在前序审计中评估。
- ✅ 敏感信息：localStorage 经 `helpers/storage.ts` 仅存设置/缓存（非密钥/Token）；无前端明文密钥（`grep` 秘密扫描零命中）。`useInstrumentCache.ts` 的 localStorage 操作为采样缓存，非敏感。

---

## 修复优先级

1. **(P0) Git 提交规范**：引入 commitlint + 钩子，强制 `type(scope): content`；存量无意义提交后续杜绝。（第 9 节）
2. **(P1) `any` 治理**：`.oxlintrc.json` 将 `typescript/no-explicit-any` 提为 `error`；为 IPC 载荷补 DTO 类型、泛型化 `EventEmitter`、`Notation/renderer.ts` 的 VexFlow 类型收窄。（第 6 节）
3. **(P2) 行内样式清理**：将 24 处静态 `style="..."` 迁移到 Tailwind class 或 `<style scoped>`；保留 Tauri `app-region` 例外。（第 4 节）
4. **(P2) 遗留 `console.log`**：移除 `MidiMessageManager.ts:5` 裸日志，统一走 `utils/logger`；配置 `no-console`。（第 10 节）
5. **(P3) 魔法数字**：缓存定时器 `5000` 抽常量。（第 11 节）

---

_审计原则：所有判定基于实际读码与检索（grep/规则文件核对），未对任何未验证的路径做断言；工具链偏差（oxlint/oxfmt）与 Tauri 特例已在对应章节明确标注，避免误报。_
