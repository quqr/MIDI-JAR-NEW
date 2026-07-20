# 瀑布钢琴每帧性能瓶颈 · 优化方案（更新版）

> 状态：**方案文档（待评审）** —— 本文件仅记录优化方案，**不修改任何源码**（`.ts` / `.vue` 一律不动）。
> 关联审查报告：`docs/waterfall-piano-perf-review.md`（含逐项证据与行号）。
> 依据规范：`前端开发规范`（性能规范 / Vue 规范 / TS 规范 / JS 规范）。
> 更新日期：2026-07-20

---

## 0. 实施约束

- **禁止在本方案评审通过前修改代码**。本文件是 spec，不是 patch。
- 所有修复必须在合并前通过类型检查 / 构建，并用第 8 节的量化手段验证收益。
- 优先级见第 7 节：先做 P0（低成本高收益），再 P1，最后 P2/低项。

---

## 1. [严重] `Recorder.getDuration()` 每帧 O(n) × 2

**问题根因**
`Recorder.ts:162-170` 的 `getDuration()` 对**全部** `this.notes` 线性扫描求最大 end；
`Recorder.tick()`（L231-241）每帧调用它 **两次**（L234 传参 + L235 判结束）。
录音回放时即每帧 **2×O(n)**，长录音明显占用主线程。

**修复方案（增强版）**

1. **增量维护 Duration（推荐，全链路 O(1)）**
   - 增加字段 `private _maxDuration: number = 0`。
   - 在 `loadNotes()` 中遍历一次 `notes` 初始化 `_maxDuration`。
   - 在 `recordNoteOff(note)` 中，实时比较 `note.endTime` 与 `_maxDuration`，若更大则更新。
   - `getDuration()` 直接 `return this._maxDuration`。
   - 注意：`stopRecording()`（L62-77）把 `pending` 中的音符 push 进 `notes` 时，也应同步更新 `_maxDuration`，避免加载路径遗漏。

2. **降级方案（仅消除重复调用）**
   - 在 `tick()` 开头 `const dur = this.getDuration()` 缓存一次并复用，消除第二次扫描。

**对照前端规范**：性能规范"高频路径避免重复遍历"；JS 规范"状态缓存与惰性更新"。

---

## 2. [严重] `onProgress` 每帧写入 Vue `ref` → 响应式重渲染风暴

**问题根因**
`useWaterfallMidi.ts:274-277` 与 `:304-307` 的 `onProgress` 回调，每帧 60 次写入响应式状态
`currentTime.value = current`；`PlaybackPanel.vue` 的 `progressPercent = computed(...)` 绑定该 ref，
进度条 `:style="{ width: progressPercent + '%' }"` → 每帧触发 Vue Diff + DOM 更新。
与音符数量无关，任何播放都受影响。

**修复方案（架构分离）**

1. **读写分离策略（推荐）**
   - 引擎内部维护纯数值 `internalTime`，**不使用 Vue `ref`**。
   - 在 `RenderLoop` 的 `requestAnimationFrame` 回调中，直接读取 `internalTime` 并操作 DOM：
     `progressBarEl.style.width = percent + '%'`，**绕过 Vue 响应式系统**。
   - Vue `ref`（`currentTime` / `duration`）仅在 `pause` / `seek` / `load` 等低频操作时同步，用于 UI 精确显示与显示组件（时间文本、MidiDrawer 进度）。

   **实施提示（耦合点）**：当前进度 DOM 在 `PlaybackPanel.vue`，与引擎不在同一层。
   推荐落地方式二选一：
   - (a) 由 `useWaterfallMidi` 持有一个独立 rAF 循环，读取引擎 `currentTime` 后直接写进度条 DOM（需把进度条元素通过 `ref` 暴露给该 composable）；
   - (b) 引擎暴露 `getProgressPercent()`，由 `PlaybackPanel` 用自有 rAF 读取并直驱 DOM，Vue ref 仅在低频操作同步。
   两者均符合"绕过 Vue 响应式、直驱 DOM"的思路，避免把引擎与 DOM 直接耦合。

2. **节流方案（过渡方案，低成本）**
   - 限制 `ref` 写入频率为 **10Hz**（每 100ms 更新一次），减少 Diff 次数。
   - 实现：在 `onProgress` 回调内记录 `lastRefSync` 时间戳，仅当 `now - lastRefSync >= 100` 才写 `currentTime.value / duration.value`。

**对照前端规范**：Vue 规范"避免高频响应式依赖"；性能规范"直接 DOM 操作处理高频动画"。

---

## 3. [中] `NoteBlockRenderer`：每帧双遍扫描 + 每方块颜色/渐变重建

**问题根因**（NoteBlockRenderer.ts）
- 双遍遍历 `active`：Pass1 收集 aura（L79-96）、Pass2 画实体（L103-122）。
- 每帧每方块重算 `noteToColor(...)`（L84/L109）+ `brightenColor(...)`（L86/L111），含字符串解析。
- `midiToX` 每方块每帧调用两次（L92 / L106）。
- `renderAuraLayers`（L188-230）每方块每帧创建 `createRadialGradient` / `createConicGradient` × 3 层。
- `auraBlocks` 数组每帧 `new`（L76）、每方块 `new` 对象（L91-94）。

**修复方案（缓存与复用）**

1. **合并单遍渲染**
   - 单遍遍历 `active`：在 Pass1 直接绘制实体，Pass2 仅叠加 Aura（或反之），消除双遍逻辑。
   - 单遍内 `midiToX` 只算一次，缓存到局部变量 `x` / `y`。

2. **颜色 / 渐变缓存池**
   - 建立 `Map<string, CanvasGradient>` 缓存（key 例如 `style|color|radius|padding` 或 `midi|hand|scheme`）。
   - **关键点**：监听 `resize` 与 `themeChange` 事件，**清空缓存池**，防止尺寸错误 / 颜色残留。
   - 颜色计算结果（含 `brightenColor`）挂载到 `NoteBlock` 实例上，仅在 `note` 属性（midi / hand / scheme）变更时重算，不在每帧重算。

3. **对象池（auraBlocks）**
   - 预分配 `auraBlocks` 数组 / 复用 scratch 结构，循环利用，避免每帧 `new Array` 与对象字面量。

**对照前端规范**：性能规范"减少冗余渲染 / 离屏缓存复用"；TS 规范"对象池模式"。

---

## 4. [中] `KeyboardRenderer.render` 每帧全量重绘（含文字标签）

**问题根因**（KeyboardRenderer.ts:223-309）
每帧 `clearRect` + 重绘全部白键（L232-254）、黑键（L266-281）；
若开启标签，每键 `fillText`（L291-307，约 88 次/帧）。静态部分（键体、边框、标签）每帧重绘浪费严重。

**修复方案（离屏 Canvas）**

1. **静态层缓存**
   - 创建离屏 Canvas `keyboardStaticCache`。
   - 仅在**初始化或设置变更**时绘制键体、边框、标签到该缓存。
   - 每帧主循环仅 `drawImage(keyboardStaticCache, 0, 0)` 绘制静态底图。

2. **动态层叠加**
   - 在底图之上，仅绘制当前按下（高亮）的键（`activeNotes` 集合，已存在）。

3. **高 DPI 适配**
   - 离屏 Canvas 的 `width/height` 乘以 `devicePixelRatio`，绘制时 `scale(dpr, dpr)`，
     防止标签文字模糊（与 `KeyboardRenderer.resize` L86-103 的 dpr 处理保持一致）。

**对照前端规范**：性能规范"离屏渲染减少主线程压力"。

---

## 5. [低/中] `FluidSplatManager`：每帧分配活跃方块位置数组

**问题根因**：`NoteBlockSystem.getActiveBlockPositions()`（L196-233）每帧 `new Array` + 每活跃方块 `new` 对象；
在 `blockCoverage` 开启时由 `FluidSplatManager.updateAndSplat`（FluidSplatManager.ts:205）每帧调用 → GC 压力。

**修复方案**
- 移除中间数组，直接在 Splats 循环中计算 `normX / normY` 坐标。
- 若必须返回数组：使用**预分配定长数组 + `length` 重置**（在 `NoteBlockSystem` 上挂一个持久 buffer，`getActiveBlockPositions` 复用它，调用方读取后不再持有引用），避免内存抖动。

**对照前端规范**：性能规范"减少冗余分配"；TS 规范"对象池模式"。

---

## 6. [低] 其他小项

- **`renderFPSOverlay`**（WaterfallEngine.ts:403）：缓存 `ctx = this.canvases.waterfall.getContext("2d")` 引用（如存入字段），避免每帧 `getContext`。
- **`RealtimeModeController.updateBlocks`**（L107-123）：用 **`swap-remove`** 替代 `splice(i, 1)`——与末尾元素交换后 `pop()`，消除 O(n) 位移（批量离场时避免退化为 O(n²)）。
- **`SynthesiaModeController`** 预计算 `noteKey` 字符串：在 `scheduleSynthesiaNotes` 时为每个 `note` 计算一次 key 并缓存（或挂到 `ScheduledNote`），避免每帧 `this.noteKey(note)`（L185）与 recycle 循环模板字符串（L260）重复分配。

---

## 7. 优先级与落地建议（更新版）

| 优先级 | 项 | 修复策略 | 预期收益 | 成本 |
|---|---|---|---|---|
| **P0** | #1 `Recorder.getDuration()` | **增量维护** Max Duration | 消除录音卡顿，算法降至 O(1) | 低 |
| **P0** | #2 `onProgress` 风暴 | **读写分离**，rAF 直驱 DOM | 消除 60fps 重渲染风暴，CPU 占用降 20%+ | 中 |
| **P1** | #3 渲染器重算 | 渐变缓存池 + 单遍遍历 | 降低 GC 频率，渲染耗时减半 | 中 |
| **P1** | #4 键盘重绘 | 离屏 Canvas 缓存 | 降低每帧基线开销 | 低 |
| **P2** | #5 内存分配 | 复用数组 / 对象池 | 减少 Young GC 次数 | 低 |

> 落地顺序建议：P0 #1（纯字段缓存，零风险）→ P0 #2 节流方案（过渡，低成本）→ P1 #4（离屏缓存，收益高成本低）→ P1 #3 → P2 #5 与小项。P0 #2 的"读写分离（直驱 DOM）"作为最终形态，在节流方案验证收益后择机实施。

---

## 8. 量化验证建议（前端规范：性能优化应可度量）

**核心指标监控**
- `Recorder.tick` 耗时（应 < 0.1ms，修复 #1 后）。
- Vue `update` 触发频率（应 < 10fps，仅限用户交互 / 低频同步时，修复 #2 后）。
- `NoteBlockRenderer` 内存堆大小波动（应平稳，无锯齿状波动，修复 #3/#5 后）。

**工具验证**
- Chrome DevTools → **Performance**：录制 5s 播放，确认 Long Task 消失、`getDuration` 与 Vue update 不再出现在火焰图热点。
- DevTools → **Rendering → Paint flashing**：确认键盘区域无频繁闪烁（仅按键时局部重绘，验证 #4）。
- 复用 `RenderLoop.logPerformance` 的分相计时（playback / bg / nbUpd / nbRdr / kb / fluid），对比修复前后帧时间分布。
