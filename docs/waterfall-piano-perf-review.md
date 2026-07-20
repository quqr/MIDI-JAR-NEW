# 瀑布钢琴性能瓶颈专项审查（聚焦每帧热路径）

> 审查日期：2026-07-20
> 范围：`src/views/WaterfallPiano` 引擎/音频/渲染层每帧热路径
> 依据：`代码审查` skill 静态审查视角 + `前端开发规范`（性能规范 / Vue 规范 / TS 规范）

---

## 0. 关于 `tick()` 每帧 O(n) 全量扫描的现状

**该瓶颈已被修复（已提交 `a8b38e0`）。** 重构把 `MidiFilePlayer.tick()` 与 `Recorder.tick()` 的调度逻辑收敛到游标化的 `EventScheduler`：

- `MidiFilePlayer.tick()`（L231-247）仅调用 `this.scheduler.tick(current)`，游标推进为 **O(1) 摊还**；`tick()` 内使用的 `this.duration` 为加载时缓存的字段，**不再每帧扫描**。
- `EventScheduler.tick()`（EventScheduler.ts:59-76）用 `noteOnCursor`/`noteOffCursor` 两个 while 推进，seek 用 `lowerBound` 二分（O(log n)）。
- `SynthesiaModeController.update()`（SynthesiaModeController.ts:174）用 `synthesiaCursor` + `break`（当 `timeUntilHit > lookAhead`），**只遍历预告窗口内的音符，非全量**。
- `NoteBlockStateSync.syncToTime()` 仅遍历 `active`（非全量），其中的 `rebuildTriggeredState` 虽 O(n) 但只在 seek/恢复时调用，非每帧。

**结论**：音符调度的全量扫描已消除。但以下是仍存在的**相关/残余每帧瓶颈**，按严重度排序。

---

## 1. [严重] `Recorder.tick()` 每帧 O(n) 全量扫描（`getDuration()` 被调用两次）

**证据**
- `Recorder.tick()`（Recorder.ts:231-241）：
  ```ts
  tick(): void {
    const current = this.getCurrentTime();
    this.scheduler.tick(current);
    this.callbacks.onProgress?.(current, this.getDuration());   // 第 1 次
    if (current >= this.getDuration() && this.getDuration() > 0) { // 第 2 次
      ...
    }
  }
  ```
- `getDuration()`（Recorder.ts:162-170）对 **全部** `this.notes` 线性扫描求最大 end：
  ```ts
  getDuration(): number {
    if (this.notes.length === 0) return 0;
    let max = 0;
    for (const n of this.notes) {
      const end = n.time + n.duration;
      if (end > max) max = end;
    }
    return max;
  }
  ```

**影响**：录音回放时，每帧执行 **2×O(n)**。当录音含数千音符、60fps 下每秒约 `120 × n` 次比较，长录音（即兴演奏数分钟）会明显占用主线程，且与"已修复的 tick 全量扫描"属同一类缺陷，只是藏在 `getDuration` 里。

**修复**
- 在 `loadNotes()` / `stopRecording()` / `recordNoteOff()` 中计算并缓存 `this.duration`（字段），`tick()` 直接用字段；`getDuration()` 仍保留但仅供非热路径。
- 退一步：在 `tick()` 开头 `const dur = this.getDuration()` 只算一次并复用。

**对照前端规范**：性能规范"减少冗余计算/高频路径避免重复遍历"；JS 规范"禁止魔法数字"（duration 应抽常量语义）。

---

## 2. [严重] `onProgress` 每帧写入 Vue `ref` → 响应式重渲染风暴

**证据**
- `MidiFilePlayer.tick()`（L234）与 `Recorder.tick()`（L234）每帧触发 `onProgress`。
- `useWaterfallMidi.ts:274-277 / 304-307` 中回调每帧写响应式状态：
  ```ts
  onProgress: (current, dur) => {
    currentTime.value = current;          // 每帧 60 次写入
    if (dur > 0) duration.value = dur;
    engineRef.value?.noteBlockSystemRef.setTransportTime(current);
  },
  ```
- `PlaybackPanel.vue:28` `progressPercent = computed(...)` 绑定 `currentTime`，进度条 `:style="{ width: progressPercent + '%' }"`（L10）。

**影响**：60fps 下每帧触发 `currentTime` 响应式更新 → 绑定它的组件（进度条、时间文本）**每帧重渲染**。这是比 `tick` O(n) 更隐蔽、影响面更广的瓶颈——与音符数量无关，任何播放都中招。

**修复**
- **节流写 ref**：仅在整数秒变化或每 ~100ms 才写 `currentTime.value`；rAF 内用本地变量累积，低频（如 10Hz）同步到响应式。
- 或在渲染层用 `shallowRef` / 普通对象承载高频时间，显示组件用 `requestAnimationFrame` 直接读，避免 Vue 依赖追踪。
- 进度条用 CSS `transform: scaleX()` 或 `width` 由 rAF 直接赋值 DOM，而非经 Vue 响应式 `width%`。
- `setTransportTime(current)` 每帧调用本身正常（仅赋值），但可合并到播放策略的 frame 钩子里，避免在回调里跨层调用。

**对照前端规范**：Vue 规范"计算属性避免副作用、watch 慎用，优先 computed"；性能规范"减少冗余渲染"。

---

## 3. [中] `NoteBlockRenderer`：每帧双遍扫描 + 每方块颜色/渐变重建

**证据**（NoteBlockRenderer.ts）
- **双遍遍历** `active`：Pass1 收集 aura（L79-96），Pass2 画实体（L103-122）——可合并为单遍。
- **每方块每帧重算颜色**：`noteToColor(b.midi, ...)`（L84 / L109）+ `brightenColor(baseColor, 0.4)`（L86 / L111）。`noteToColor` 是纯函数但含字符串解析（`hexToRgb`/`hslToHex` 多次 `parseInt`/`toString(16)`），按方块数量每帧重复。
- **`midiToX` 每方块调用两次**（Pass1 L92、Pass2 L106）——同一值算两遍。
- **渐变每帧每方块创建 ×3 层**：`renderAuraLayers`（L188-230）对每个方块调用 `ctx.createRadialGradient` / `ctx.createConicGradient`，再在 3 个 layer 中复用（L259-281）。渐变对象创建与 GPU 上传开销显著。
- **`auraBlocks` 数组每帧 new**（L76）+ 每方块 new 对象（L91-94）——GC 压力。

**影响**：`aura` 开启 + 活跃方块多（几十~上百）时，每帧大量渐变对象与字符串分配 → GC 抖动，且 `createConicGradient` 在部分浏览器偏慢。

**修复**
- 合并双遍为单遍：先收集 aura 到**复用**数组（见下），再统一绘制实体+aura。
- 颜色缓存：按 `(midi, scheme, hand, custom)` 建 Map，或把 `computedColor` 挂在 `NoteBlock` 上、仅在 `midi/scheme/hand` 变化时重算；`brightenColor` 结果一并缓存。
- 渐变去重：用 `ctx.save() + ctx.translate(cx, cy)` 后复用"原点渐变"（只创建一次）；或对离散颜色缓存有限个渐变对象（颜色本就有限）。
- `midiToX` 在单遍内只算一次，缓存到局部变量 `x`。
- `auraBlocks`：预分配 / 复用 scratch 数组，避免每帧 `new` 数组与对象字面量。

**对照前端规范**：性能规范"减少冗余渲染"；TS 规范"禁止 any、类型复用"。

---

## 4. [中] `KeyboardRenderer.render` 每帧全量重绘（含文字标签）

**证据**（KeyboardRenderer.ts:223-309）：每帧 `clearRect` + 重绘全部白键（L232-254）、黑键（L266-281），若开启标签则每键 `fillText`（L291-307，约 88 次/帧）。

**影响**：键盘静态部分（键体、边框、标签）每帧重绘，标签 `fillText` 成本较高；实际只有按下/释放（高亮）时才需变更。

**修复**：参照 `BackgroundRenderer`（已用离屏 canvas 缓存静态背景，L67-103）——把静态键盘（键体+边框+标签）渲染到离屏 canvas，每帧仅 `clearRect + drawImage(缓存) + 叠加高亮键`；高亮变化时才重绘缓存。

**对照前端规范**：性能规范"减少冗余渲染/离屏缓存复用"。

---

## 5. [低/中] `FluidSplatManager`：每帧分配活跃方块位置数组

**证据**：`NoteBlockSystem.getActiveBlockPositions()`（L196-233）每帧 `new Array` + 每活跃方块 `new` 对象（L224-230）；在 `blockCoverage` 开启时由 `FluidSplatManager.updateAndSplat` 每帧调用（FluidSplatManager.ts:205）。

**影响**：活跃方块多时每帧分配数组+对象 → GC 压力（与 #3 同类）。

**修复**：复用预分配的 scratch 数组（定长、下标复用），或在 splat 循环内直接计算 `normX/normY`，不产出中间数组。

---

## 6. [低] 其他小项

- `renderFPSOverlay`（WaterfallEngine.ts:403）每帧 `this.canvases.waterfall.getContext("2d")`——缓存 ctx 引用即可。
- `RealtimeModeController.updateBlocks`（L107-123）用 `active.splice(i, 1)` 回收（O(n) 位移）；方块批量离场时退化为 O(n²)，但单帧移除数通常小，影响有限。可改 **swap-remove**（与末尾交换后 `pop()`）。
- `SynthesiaModeController` 每帧 `this.noteKey(note)` 重新拼字符串（L185）、recycle 循环内模板字符串（L260）——小量分配；可把 `key` 预计算到 `ScheduledNote`（或缓存 Map）。
- `RenderLoop`（RenderLoop.ts）每帧 ~8 次 `performance.now()` 仅用于分阶段计时，开销可忽略。

---

## 7. 优先级与落地建议

| 优先级 | 项 | 类型 | 修复成本 |
|---|---|---|---|
| **P0** | #1 `Recorder.getDuration()` 每帧 O(n)×2 | 残留全量扫描 | 低（缓存字段） |
| **P0** | #2 `onProgress` 每帧写 Vue ref | 响应式重渲染风暴 | 中（节流/直驱 DOM） |
| **P1** | #3 渲染器单遍 + 颜色/渐变缓存 | 每帧分配/重算 | 中 |
| **P1** | #4 键盘离屏缓存 | 每帧全量重绘 | 中 |
| **P2** | #5 方块位置数组复用 | GC 压力 | 低 |
| **P2** | #6 小项（ctx 缓存、swap-remove、key 预计算） | 微优化 | 低 |

---

## 8. 量化验证建议（前端规范：性能优化应可度量）

- `RenderLoop.logPerformance` 已有分相计时（playback/bg/nbUpd/nbRdr/kb/fluid），可在其中补充：
  - `onProgress` 触发频率与 `currentTime.value` 写入次数；
  - `Recorder.tick` 内 `getDuration` 耗时（修复前后对比）；
  - 渲染器每帧分配字节（手动计数器或 `performance.memory`，Chromium 可用）。
- 用 DevTools Performance 录制 5s 播放，对比修复前后帧时间分布与 Long Task 数量。
