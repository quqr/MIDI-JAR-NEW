# 📋 MIDI-JAR 代码审查报告

> 审查日期：2026-07-06  
> 审查范围：全项目 `src/` 目录  
> 依据标准：`CODE_REVIEW_STANDARDS.md` v1.0

---

## 总体评价

**评级：⚠️ 良好基础，但有几处需重点关注**

项目代码质量整体不错——TypeScript strict 模式、良好的组件拆分、Composition API 的正确使用、`onUnmounted` 清理的普遍意识，这些都说明团队有不错的工程素养。

不过测试覆盖严重不均衡、若干类型安全问题、以及一个实际的资源泄漏问题，需要在冲刺中优先修复。

---

## 🔴 Blocker（3 个）

### B1. Store cleanup 函数未被调用 → 资源泄漏

**文件：** `src/stores/midiRouting.ts:296-310`  
**使用位置：** `src/views/Settings/Routing/Routing.vue:238`

`midiRouting` store 定义了完整的 `cleanup()` 函数来注销 Tauri 事件监听器和停止轮询，但 `Routing.vue` 的 `onUnmounted` 只调用了 `stopPolling()`，**没有调用 `cleanup()`**。

**后果：**
- `offInputs` / `offOutputs` / `offWires` 三个 Tauri 事件监听器永远不会被注销
- 每次进入/离开路由设置页面都会注册新的监听器（旧的不释放）
- 长期运行后会产生内存泄漏和重复回调

**建议：**
```typescript
// src/views/Settings/Routing/Routing.vue:238
onUnmounted(() => {
  routingStore.cleanup();  // 替换 stopPolling()
});
```

---

### B2. ChordDictionaryModuleProvider 非空断言在可选 prop 上

**文件：** `src/views/ChordDictionary/ChordDictionaryModuleProvider.vue:40`

```typescript
const contextValue: ChordDictionaryModuleContext = reactive({
  keySignature: props.keySignature!,  // 🔴 可选 prop 上使用非空断言
  // ...
}) as ChordDictionaryModuleContext;
```

`keySignature` prop 被定义为可选（`keySignature?: KeySignatureConfig`），但初始化时直接用 `!` 断言其不为空。如果父组件没有传入 `keySignature`，**运行时 `props.keySignature` 就是 `undefined`**，非空断言不会阻止它在运行时变成 `undefined`。

**建议：**
```typescript
const props = withDefaults(defineProps<Props>(), {
  keySignature: () => getKeySignature("C"),  // 给一个安全的默认值
  // ...
});
```

---

### B3. ChordDisplay.vue 大量使用 `as any` 和 `as unknown as X` 强制类型转换

**文件：** `src/views/ChordDisplay/ChordDisplay.vue`

模板中有 7 处强制类型转换：

```vue
:chord="chords[0] as any"                    <!-- 第 31 行 -->
:chord="chord as any"                         <!-- 第 70 行 -->
:intervals="chords[0]?.intervals as unknown as string[]"  <!-- 第 50 行 -->
:pitchClasses="pitchClasses as unknown as string[]"       <!-- 第 51 行 -->
:chord="chords[0] as any"                     <!-- 第 91 行 -->
:sustained="sustainedMidiNotes as unknown as number[]"    <!-- 第 88 行 -->
:played="combinedPlayedMidi as unknown as number[]"       <!-- 第 89 行 -->
:midi="midiNotes as unknown as number[]"      <!-- 第 90 行 -->
:keySignature="keySignature as unknown as KeySignatureConfig"  <!-- 第 92 行 -->
```

`as unknown as X` 双转写意味着类型从根本上不兼容，开发者在"欺骗"TypeScript。这会：
- 掩盖真正的类型不匹配问题
- 编译时检查完全失效
- 运行时可能产生未定义行为

**建议：** 查看子组件（`ChordNameLink`、`ChordIntervals`、`PianoKeyboard`）的 Props 定义，`as` 的源类型应该能直接赋值给目标类型。如果是子组件的 Props 定义过严，先放宽子组件的类型；如果是父组件的数据源问题，修正数据源。

---

## 🟡 Suggestion（7 个）

### S1. 测试覆盖严重不均衡

**范围：** 全项目

现有 12 个测试文件**全部集中在** `src/views/WaterfallPiano/__tests__/`。以下模块**没有任何测试**：

| 模块 | 文件数 | 测试 | 风险 |
|------|--------|------|------|
| `src/helpers/` | 12 个工具文件 | ❌ 0 | 🟠 核心逻辑 |
| `src/composables/` | composables | ❌ 0 | 🟠 频繁使用 |
| `src/stores/` | 6 个 Pinia Store | ❌ 0 | 🔴 领域核心 |
| `src/midi/` | MidiMessageManager 等 | ❌ 0 | 🔴 核心基础设施 |
| `src/components/` | 所有 Vue 组件 | ❌ 0 | 🟠 UI 稳定性 |

**建议优先级：**
1. **P0** — `helpers/chord-detect.ts`、`helpers/midi.ts`（核心业务逻辑，纯函数，极易测）
2. **P1** — `stores/midiMessages.ts`（引用计数逻辑复杂）、`stores/midiRouting.ts`
3. **P2** — 关键 Vue 组件（PianoKeyboard、ChordName）

---

### S2. `@typescript-eslint/no-explicit-any` 应打开

**文件：** `eslint.config.js:56`

```javascript
"@typescript-eslint/no-explicit-any": "off",
```

当前 `any` 在项目中出现约 **30 处**（`as any` 约 26 处，`...: any[]` 约多处）。完全关闭此规则让类型退化的代码可以畅通无阻。

**建议改为 `warn`**，逐步清理：

```javascript
"@typescript-eslint/no-explicit-any": "warn",
```

并配合 `@typescript-eslint/no-unsafe-*` 系列规则一起使用。

---

### S3. `as unknown as` 双转写出现在测试和生产代码中

**文件：**
- `src/views/ChordDisplay/ChordDisplay.vue`（6 处）
- `src/views/WaterfallPiano/__tests__/*.test.ts`（多处）
- `src/views/WaterfallPiano/engine/PostProcessingRenderer.ts`（2 处）
- `src/stores/settings.ts:35`

生产代码中的 `as unknown as` 意味着类型链断裂。测试代码中可以理解（mock 对象），但生产代码中的应该修复。

---

### S4. WaterfallPiano store 的 `updateSetting` 和 `resetGroup` 使用不安全的类型转换

**文件：** `src/views/WaterfallPiano/stores/waterfallPiano.ts:92-103`

```typescript
function resetGroup<K extends keyof WaterfallPianoSettings>(group: K) {
  (settings.value[group] as Record<string, unknown>) = {
    ...defaultWaterfallSettings[group],
  };
}

function updateSetting<K extends keyof WaterfallPianoSettings>(
  section: K,
  key: keyof WaterfallPianoSettings[K],
  value: unknown,
) {
  (settings.value[section] as Record<string, unknown>)[key as string] = value;
}
```

`as Record<string, unknown>` 绕过类型检查，丢失了嵌套对象的类型安全性。

**建议：** 利用 TypeScript 的 mapped types 生成类型安全的 setter：

```typescript
function updateSetting<K extends keyof WaterfallPianoSettings>(
  section: K,
  key: keyof WaterfallPianoSettings[K],
  value: WaterfallPianoSettings[K][keyof WaterfallPianoSettings[K]],
) {
  settings.value[section][key] = value;
}
```

---

### S5. Logger 中的 `var` 应该改为 `const`

**文件：** `src/utils/logger.ts:29`

```typescript
var logEntry: LogEntry = {  // 💡 var 已经过时
```

**建议：**
```typescript
const logEntry: LogEntry = {
```

如果 ESLint 的 `no-var` 规则没有开启，建议也一同打开。

---

### S6. AudioEngine 的 `dispose()` 未在 WaterfallPiano 中被调用

**文件：** `src/views/WaterfallPiano/audio/AudioEngine.ts:278`  
**使用位置：** `src/views/WaterfallPiano/WaterfallPiano.vue`

`AudioEngine` 类有完整的 `dispose()` 方法释放 Tone.js 合成器、混响、压缩器等音频链节点。但 `WaterfallPiano.vue` 的 `onUnmounted` 中只清理了 `recorder` 和 `midiPlayer`，**没有调用 AudioEngine 的 dispose**。

注：当前 WaterfallPiano 组件没有直接持有 AudioEngine 实例（实例可能在 engine/WaterfallEngine 内部），需要确认 WaterfallEngine 中是否已经调用了 `audioEngine.dispose()`。

**建议：** 在 `WaterfallEngine.ts` 中确认 `dispose()` 是否被调用。如果没有，在 `onUnmounted` 中补充。

---

### S7. MIDI helper 缺少输入校验

**文件：** `src/helpers/midi.ts`

```typescript
export const getMidiNote = (m: MidiMessage | number[]) => m[1];
export const getMidiValue = (m: MidiMessage | number[]) => m[2];
```

这些函数假设数组至少有三个元素。如果传入空数组或只有一个元素的数组，`m[1]` 或 `m[2]` 返回 `undefined`，会静默传播。

**建议：**
```typescript
export const getMidiNote = (m: MidiMessage | number[]): number => {
  if (m.length < 2) return 0;
  return m[1];
};
```

---

## 💭 Nit（5 个）

### N1. `innerHTML` 可替换为 `textContent`

**文件：** `src/components/PianoKeyboard/utils.ts:116,134,151`

设置的内容是音程名（"3M"、"5P"）和音符名，是应用控制的文本，**没有 XSS 风险**。但作为最佳实践，纯文本内容应该使用 `textContent` 而不是 `innerHTML`（性能更好，语义更准确）。

### N2. `Shared/debounce.ts` 中的 `any` 可收紧

**文件：** `src/shared/debounce.ts`（通过 `src/helpers/debounce.ts` 引入）

可以加泛型约束保留函数参数类型。

### N3. 组件导出风格不统一

有些文件同时使用 `export default` 和 `export`，建议统一风格。Vue 组件文件推荐使用 `export default`，纯 TS 模块推荐使用 `export`。

### N4. 缺少 JSDoc 注释

`src/helpers/` 中很多导出函数（如 `getMidiCommand`、`getChroma` 等）缺少 JSDoc 注释。虽然函数名已经比较清晰，但对新团队成员来说，文档化的函数签名仍然有帮助。

### N5. PianoKeyboard 组件的 `else if (props.midi)` branch 逻辑可疑

**文件：** `src/components/PianoKeyboard/PianoKeyboard.vue:169-207`

```typescript
if (props.midi) {
  if (props.keyboard.wrap) {
    if (props.keyboard.displaySustained) {
      highlightWrapLabels(...midi...);
    } else {
      highlightWrapLabels(...midi...); // 参数完全一样
    }
  }
  // ...
}
```

两个分支的 `highlightWrapLabels` 调用参数完全一致，`if (props.keyboard.displaySustained)` 的判断似乎是冗余的。建议确认这是否有意为之，如果是冗余条件，可以移除。

---

## ✅ 值得表扬

| 优点 | 位置 |
|------|------|
| **生命周期管理意识强**——`onUnmounted` 清理 keydown 监听器、定时器 | `WaterfallPiano.vue:334`, `Routing.vue:238`, `useMidiLearn.ts:51` |
| **MidiMessageManager 的 dispose guard 模式**——`disposed` 标志防止重复清理 | `MidiMessageManager.ts:129-145` |
| **midiMessages store 的引用计数设计**——`subscribeToNamespace`/`unsubscribeFromNamespace` 对称管理 | `stores/midiMessages.ts:68-104` |
| **测试质量高**——覆盖正常、异常、边界，命名清晰（中文 describe） | `ThemeSystem.test.ts` |
| **TypeScript strict 模式已开启**——给类型安全奠定了基础 | `tsconfig.json:18` |
| **代码组织清晰**——组件/引擎/音频/MIDI 分层合理 | 整体项目结构 |

---

## 修复优先级建议

| 优先级 | 项目 | 预估工作量 |
|--------|------|-----------|
| 🔴 **本轮修复** | B1 cleanup 泄漏 + B2 非空断言 + B3 类型强制转换 | 2h |
| 🟡 **本轮修复** | S1 核心 helpers 测试 + S2 开启 no-explicit-any | 4h |
| 🟡 **下轮冲刺** | S3 清理 as unknown as + S4 类型安全 setter | 3h |
| 🔵 **持续改进** | S5-S7 + N1-N5 | 随时可做 |

---

> **审查人：** AI Code Reviewer  
> **审查标准：** `CODE_REVIEW_STANDARDS.md` v1.0  
> **说明：** 如需对某个发现深入讨论或给出具体修改示例，随时找我。
