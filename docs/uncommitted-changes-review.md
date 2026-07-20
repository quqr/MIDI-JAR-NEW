# 未提交代码审查报告（AdvancedDebug 重构 + 配置项抽取 + 预设功能）

> **审查时间**：2026-07-20
> **范围**：`git diff HEAD -- src` + 2 个新增未跟踪文件
> **方法**：逐文件 diff 通读 + 跨文件类型/依赖核对（store 接线、helper、组件）+ code-reviewer 静态基线（其输出对本项目多为空信息误报，已忽略，仅作交叉印证）
> **结论**：整体质量良好、架构合理；发现 **2 项高优先级功能/健壮性问题**、**3 项中等问题**、若干低优先级规范项。

---

## 一、变更规模与文件清单

| 类别 | 文件 | 性质 |
|---|---|---|
| 新功能-预设 | `AdvancedDebug/composables/useAdvancedDebugPresets.ts`（+281） | 新增 |
| 新功能-预设 | `AdvancedDebug/components/PresetManagerDialog.vue`（+251） | 新增 |
| 容器重构 | `AdvancedDebug/AdvancedDebug.vue`（+388/-58） | 搜索工具栏 + 受控折叠 + 预设弹窗接线 |
| 受控折叠 | `Settings/SettingsCollapse.vue` | 受控/非受控 `v-model:open` + `useId` |
| 配置项抽出 | `Notation/{types,layout,renderer,utils}.ts` | 硬编码 → 可配置项 |
| 配置项抽出 | `WaterfallPiano/{constants,types}.ts`、`MidiFilePlayer.ts`、`useWaterfallMidi.ts` | 默认力度 / 左右手轨索引 / 速度范围常量 |
| 各 section | `AdvancedDebug/sections/*.vue`（×7） | 接入 `open`/`sectionId`/`searchQuery` + 新字段 |
| 硬码清零 | `Debugger/utils.ts`、`WaterfallCanvas.vue`、`MidiFileSection.vue` | 格式化/力度/速度范围 |
| 国际化 | `locales/{en,zh}.json` | 新增 toolbar/presets/filterClef 等键 |
| 图标 | `Icon/{Icon.vue,types.ts}` | 新增 10 个图标路径 |

---

## 二、严重问题（高优先级，建议提交前修复）

### H1. `hasNoResults` 恒为 `false` —— 搜索"无结果"功能失效
**位置**：`AdvancedDebug.vue` L797-803
```ts
const hasNoResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return false;
  // 注释声称"基于 section 标题匹配"，但实现直接 return false
  return false;
});
```
**影响**：
- 全局"未找到匹配参数"提示（`v-if="hasNoResults"`，L653）**永不渲染**；搜索一个不存在的关键词时页面静默空白，无反馈。
- 顶部 `Expand All / Collapse All` 按钮的 `:class="{ 'btn-disabled': hasNoResults }"` 永远不禁用（死逻辑）。

**根因**：父级把搜索可见性下放到各 section 的 `isVisible`（仅匹配自身标题），但父级"全局无结果"状态未聚合子级可见性，写成桩。

**修复**：基于各 section 的可见性聚合（需要一个共享的"某 section 是否可见"信号）。最简可行方案：
- 让每个 section 通过 `update:visible` emit 自身可见性，父级用 `reactive` 集合汇总；
- 或父子共用一个 `useSectionSearch(query)` composable，父级也能拿到每个 section 的可见 computed。

> 对照前端规范：JS 规范"条件分支不得写出恒真/恒假桩"；功能完整性。

---

### H2. 预设 `applyPreset` / `importPresets` 直接与默认值深合并缺失 —— 运行时 `undefined` 风险
**位置**：`useAdvancedDebugPresets.ts` `applyPreset`（L121-138）、`importPresets` replace 分支（L227-228）
```ts
setWaterfall(structuredClone(preset.waterfall)); // 整体覆盖 waterfallStore.settings
```
**影响**：预设仅保存"当时"的快照。若预设由**旧版本**保存（缺少本次新增的 `defaultVelocity`、`rightHandTrackIdx`、`leftHandTrackIdx` 等字段），应用后 `waterfallStore.settings` 的对应字段变为 `undefined`。
- 例：`WaterfallCanvas.vue` L79 `engine?.triggerNoteOn(midi, props.settings.keyboard.defaultVelocity)` → 传入 `undefined` → Tone 触发异常或静音。
- 注释 L40 自述"向后兼容靠 mergeDeep"，但代码中**并无 mergeDeep**，与实际行为矛盾。

**修复**：应用/导入时与 `defaultWaterfallSettings` / `defaultSettings.notation` 深合并（项目已有 `mergeXxxConfig` 系 helper，应复用）：
```ts
setWaterfall(mergeWaterfallSettings(structuredClone(preset.waterfall), defaultWaterfallSettings));
```
并对导入项做最小结构校验（`name`/`notation`/`waterfall` 存在且为对象），过滤非法项。

> 对照前端规范：数据持久化"读写需校验与默认值兜底"；避免 `undefined` 穿透到下游。

---

## 三、中等问题

### M1. `MidiFilePlayer.setHandTrackIndices` 在播放中调用会重置调度游标
**位置**：`MidiFilePlayer.ts` L715-725
```ts
setHandTrackIndices(indices) {
  this.handTrackIndices = indices;
  if (this.midi) {
    this.notes = this.collectNotes();
    this.scheduler.setNotes(this.notes);          // 重置游标
    this.callbacks.onScheduledNotesReady?.(this.notes);
  }
}
```
**影响**：`useWaterfallMidi.ts` 已对左右手索引做 `watch` 实时同步（L1629-1637）。若在播放途中改动该设置，`scheduler.setNotes` 会重建调度表，导致**播放跳变/重复触发**。

**修复**：播放中变更时先做平滑过渡——先 `pause`/记录当前时间，重建后 `seek` 回原位置；或在非播放态才重建调度（`if (this.midi && !this.isPlaying)`）。

### M2. `bookmark-outline` 图标路径与 `bookmark` 完全相同
**位置**：`Icon.vue` L10-12
```ts
bookmark:      "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",
"bookmark-outline": "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", // 与 bookmark 一致
```
**影响**：`PresetManagerDialog.vue` L89 空状态用 `bookmark-outline` 期望描边图标，实际渲染为实心，与 `bookmark` 无视觉差异。

**修复**：提供真正的描边路径（如去掉填充、仅描边），或暂时复用 `bookmark` 并在空状态换用其他语义图标（如 `inbox`/`file-text`）。

### M3. 播放速度范围行为变更需产品确认
**位置**：`constants.ts` `PLAYBACK_SPEED`（min 0.25 / max 2 / step 0.05）替换 `MidiFileSection.vue` 原 `min=0 max=3 step=0.25`
**影响**：这是**一致性修复**（与 `MidiDrawer.vue` L132-134 的 `0.25/2/0.05` 对齐，原 MidiFileSection 与之不一致属实）。但副作用是取消了 **0 速**与 **>2x** 能力。
**确认点**：是否确要移除 0 速（暂停等价）与 2x–3x 区间？若是，OK；若否，应把 `MidiDrawer` 一并放宽或保留 0。

---

## 四、低优先级 / 规范项

| # | 项 | 说明 | 建议 |
|---|---|---|---|
| L1 | 错误清除双定时器 | `showNotification`（AdvancedDebug.vue）与 `useAdvancedDebugPresets` 的 `watch(error)` 各设 5s 超时，逻辑重复 | 仅在 composable 内统一处理 error 自动清除 |
| L2 | `as never` 类型逃逸 | 多处 `updateSetting("midiFile", key as never, value)` 用 `as never` 绕过嵌套类型（本次沿用既有模式） | 改为 `updateSetting<"midiFile", keyof MidiFileConfig>(...)` 强类型重载 |
| L3 | `Notification` 类型遮蔽全局 API | `AdvancedDebug.vue` L816 `type Notification = {...}` 遮蔽 Web `Notification` | 改名 `ToastNotification` |
| L4 | 导入无结构校验 | `importPresets` 仅按数组/对象解析，破损/恶意 JSON 可注入形状不符项 | 轻度校验每项含 `name/notation/waterfall` |
| L5 | 七处 `isVisible`/`isOpen` 计算逻辑完全复制 | 7 个 section 各约 12 行重复（标题匹配 + 搜索强制展开） | 抽 `useSectionFilter(searchQuery, titleGetter)` composable |
| L6 | 图标声明可能含未使用项 | `filter`/`list`/`file-text` 等在本轮 diff 的 vue 中未见引用 | 确认是否在其他模块使用，否则删除以减包 |

---

## 五、肯定项（良好实践）

- **配置项抽取正确**：`Notation` 的 `filterClef`/`noteStartXOffset`/`minScaleRatio`/`noteDuration`/`noteHighlightColor` 与 `WaterfallPiano` 的 `defaultVelocity`/`rightHandTrackIdx`/`leftHandTrackIdx` 将历史硬编码提升为可配置项，并在 `defaultXxxConfig` 补齐默认值与类型注释（"历史硬编码默认值"注释很好）。符合前端规范"消除魔法数字 / 单一真相源"。
- **`SettingsCollapse` 受控模式规范**：`v-model:open` + `useId()` 生成回退 `sectionId` + `badge: string|number`，是可复用的受控/非受控组件范式（Vue 3.5.39 已支持 `useId`，全仓已用 14 处，安全）。
- **预设 composable 结构完整**：保存/应用/重命名/删除/导出/导入齐全，含 `try-catch`、`structuredClone` 深拷贝、`createLogger` 日志、`error` 状态机，质量高于平均。
- **`useConfigUpdater.ts` 净清理**：删除未使用的 `import type { Ref }`，无副作用。
- **跨文件接线核对通过**：`loadFromStorage`/`saveToStorage` 签名匹配；`SettingsSelect` 组件存在；`waterfallStore.settings =`（Pinia setup store 状态可写）合法；`waterfallStore.updateSetting(key, subkey, value)` 三参形式与既有用法一致。

---

## 六、修复优先级建议

| 优先级 | 项 | 成本 | 收益 |
|---|---|---|---|
| **P0（提交前）** | H1 `hasNoResults` 桩 | 低 | 恢复搜索"无结果"反馈 |
| **P0（提交前）** | H2 预设深合并 + 导入校验 | 低-中 | 消除运行时 `undefined` 穿透 |
| P1 | M1 播放中重置调度 | 中 | 避免播放跳变 |
| P1 | M2 bookmark-outline 路径 | 低 | 修正视觉语义 |
| P1 | M3 速度范围确认 | 低（确认） | 明确行为边界 |
| P2 | L1-L6 规范项 | 低 | 可维护性/类型安全 |

---

## 七、验证方式

- **类型检查**：`npm run typecheck`（vue-tsc）确认无 TS 错误（尤其 `setWaterfall`/`setNotation` 入参类型、`props.settings.keyboard.defaultVelocity` 已随 `KeyboardConfig` 扩展）。
- **手动验证**：
  1. 搜索框输入不存在词 → 应出现"未找到匹配参数"（验证 H1）。
  2. 保存预设 → 改设置（如关掉某 toggle）→ 应用预设 → 所有改动应被还原（验证 H2 整对象覆盖）。
  3. 用旧版导出 JSON（缺字段）导入应用 → 不应出现 `undefined` 字段（验证 H2 深合并）。
  4. 播放中改"右手轨道索引" → 播放不应跳变（验证 M1）。
