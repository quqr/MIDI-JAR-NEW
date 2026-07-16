# MIDI-JAR 架构分析报告

> 本报告由三个 Agent Skills (`sql-manything`、`grill-with-docs`、`improve-codebase-architecture`) 联合分析生成

## 一、项目概况

### 基本信息

- **项目名称**: MIDI-JAR
- **版本**: 2.0.0
- **技术栈**: Tauri + Vue 3 + TypeScript + Rust
- **文件数量**: 239 个源文件
- **主要功能**: MIDI 设备管理、和弦字典、瀑布钢琴可视化、流体模拟

### 架构层次

```
┌─────────────────────────────────────────┐
│          前端层 (Vue 3)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │   Views  │  │Components│  │Stores │ │
│  └──────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────┘
                   ↕
┌─────────────────────────────────────────┐
│         引擎层 (TypeScript)             │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │   Fluid  │  │ Renderer │  │ Audio │ │
│  └──────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────┘
                   ↕
┌─────────────────────────────────────────┐
│         后端层 (Rust/Tauri)             │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │   MIDI   │  │   File   │  │Window │ │
│  └──────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────┘
```

## 二、sql-manything 分析结果

### 2.1 代码搜索能力

**数据库状态**:

- ✅ `files` 表: 239 个文件
- ✅ `files_fts` 表: FTS5 全文索引可用
- ❌ `v_enriched` 视图: **缺失** (无法使用 EXTRACT/EXTRACT_BLOCK)
- ✅ `enrich_file_deps` 表: 存在但数据为空
- ✅ `enrich_file_refs` 表: 存在但数据为空

**影响**:

- 可以使用 FTS5 进行文件搜索
- 无法使用 `block_content_full` 提取完整代码块
- 无法使用依赖图追踪模块关系

**建议**: 运行 Phase 2 脚本创建 `v_enriched` 视图

### 2.2 核心模块定位

**四大核心模块**:

1. **MIDI 设备管理**
   - 前端: [src/midi/MidiDeviceManager.ts](file:///f:/Codes/MIDI-JAR-NEW/src/midi/MidiDeviceManager.ts)
   - 后端: [src-tauri/src/midi/device_manager.rs](file:///f:/Codes/MIDI-JAR-NEW/src-tauri/src/midi/device_manager.rs)

2. **流体模拟引擎**
   - 入口: [src/engine/fluid/FluidSimulation.ts](file:///f:/Codes/MIDI-JAR-NEW/src/engine/fluid/FluidSimulation.ts)
   - 求解器: [src/engine/fluid/FluidSolver.ts](file:///f:/Codes/MIDI-JAR-NEW/src/engine/fluid/FluidSolver.ts)

3. **和弦字典**
   - 主视图: [src/views/ChordDictionary/ChordDictionary.vue](file:///f:/Codes/MIDI-JAR-NEW/src/views/ChordDictionary/ChordDictionary.vue)
   - Store: [src/stores/chordDictionary.ts](file:///f:/Codes/MIDI-JAR-NEW/src/stores/chordDictionary.ts)

4. **瀑布钢琴**
   - 引擎: [src/views/WaterfallPiano/engine/WaterfallEngine.ts](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/WaterfallEngine.ts)

## 三、improve-codebase-architecture 分析结果

### 3.1 架构问题清单

#### 问题 1: MIDI 前后端紧耦合

**位置**: `src/midi/MidiDeviceManager.ts`, `src/stores/midiRouting.ts`

**问题**:

- 直接依赖 `window.tauriAPI` 全局对象
- 使用 `isTauri()` 检查散落各处
- 没有抽象层隔离前后端通信

**影响**:

- 难以测试(需要 mock Tauri API)
- 难以迁移到 Web 版本
- 违反依赖倒置原则

**建议**:

```typescript
// 创建 MidiTransport 接口
interface MidiTransport {
  getInputs(): Promise<MidiInput[]>
  getOutputs(): Promise<MidiOutput[]>
  syncRoutes(routes: MidiRoute[]): Promise<void>
  onInputs(callback: (inputs: MidiInput[]) => void): UnlistenFn
}

// Tauri 实现
class TauriMidiTransport implements MidiTransport { ... }

// Mock 实现(用于测试)
class MockMidiTransport implements MidiTransport { ... }
```

#### 问题 2: ChordDictionaryStore 薄封装

**位置**: [src/stores/chordDictionary.ts](file:///f:/Codes/MIDI-JAR-NEW/src/stores/chordDictionary.ts)

**问题**:

- 16 个方法,其中 14 个是对 `settingsStore.updateSetting` 的直接调用
- 缺少领域逻辑封装
- "删除测试": 如果删除这个 store,复杂度会转移给调用者

**影响**:

- 调用者需要知道设置的完整路径
- 未来业务逻辑变更需要修改多处调用者

**建议**:

- 将和弦别名解析逻辑集中到 store
- 添加和弦查找/过滤等高层方法
- 将此 store 作为"和弦字典领域服务"

#### 问题 3: Settings 深层嵌套

**位置**: [src/stores/settings.ts](file:///f:/Codes/MIDI-JAR-NEW/src/stores/settings.ts)

**问题**:

- 使用点分隔路径 `"notation.staffClef"` 访问嵌套属性
- `setValueByPath` 需要类型擦除 `as unknown as Record<string, unknown>`
- 类型安全性弱

**影响**:

- 运行时路径错误无法检测
- 重构设置结构时容易遗漏更新

**建议**:

- 使用 VueUse 的 `reactivePick` 或类似方案
- 或者拆分为多个独立 store

#### 问题 4: FluidConfig 三层配置映射

**位置**: [src/engine/fluid/FluidConfig.ts](file:///f:/Codes/MIDI-JAR-NEW/src/engine/fluid/FluidConfig.ts)

**问题**:

- 三层配置: `FluidSimulationConfig` → `QUALITY_PRESETS` → 用户语义映射
- 用户语义到求解器参数的映射逻辑集中在一个函数
- 配置更新时需要手动检查分辨率变化并触发 resize

**影响**:

- 新增配置项需要修改三处
- 用户难以理解配置项之间的关系

**建议**:

- 使用配置构建器模式
- 分离配置验证和默认值填充逻辑

#### 问题 5: 坐标转换逻辑分散

**位置**: [src/views/WaterfallPiano/engine/WaterfallEngine.ts](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/WaterfallEngine.ts)

**问题**:

- MIDI → X 坐标转换在 `KeyboardRenderer.midiToX()`
- Y 坐标翻转逻辑在 `fluidSplat()` 方法中: `1.0 - keyboardHeight / canvasHeight`
- Canvas 2D y 轴向下,WebGL y 轴向上

**影响**:

- 修改布局时需要同步修改多处
- 容易出现坐标对齐错误

**建议**:

- 创建 `CoordinateSystem` 类统一管理坐标转换
- 明确定义各 canvas 的坐标系

### 3.2 测试覆盖情况

**测试文件**: 7 个(仅 WaterfallPiano 模块)

```
src/views/WaterfallPiano/__tests__/
├── KeyboardRenderer.test.ts
├── MidiFilePlayer.test.ts
├── NoteBlockSystem.test.ts
├── NoteColorMapper.test.ts
├── PerformanceMonitor.test.ts
├── Recorder.test.ts
└── WaterfallEngine.test.ts
```

**缺失测试**:

- ❌ MIDI 设备管理逻辑
- ❌ 和弦字典计算逻辑
- ❌ 流体模拟引擎
- ❌ Pinia stores

**测试质量问题**:

- 大量使用 `as unknown as` 类型断言进行 mock
- 测试覆盖的是"如何调用"而非"行为是否正确"

### 3.3 代码质量问题

#### Console.log 泛滥

**位置**: 分散在 18 处

```typescript
// src/stores/midiRouting.ts
console.log("[MIDI_DEBUG] syncRoutesToMain: not in Tauri, skipping");
console.log(
  `[MIDI_DEBUG] syncRoutesToMain: syncing ${routeList.length} routes`,
);
console.error("[MIDI_DEBUG] syncRoutesToMain FAILED:", e);
```

**建议**:

- 使用 `logger` 工具类替代 `console.log`
- 区分 INFO/DEBUG/WARN/ERROR 级别
- 生产环境禁用 DEBUG 日志

#### 类型安全弱

**位置**: 20 处使用 `as unknown as` 或 `as any`

```typescript
// src/stores/settings.ts
settings.value as unknown as Record<string, unknown>;

// src/utils/tauri.ts
callback(event.payload as any);
```

**建议**:

- 使用 Zod 或类似库进行运行时类型验证
- 减少 `as unknown` 中间转换

## 四、grill-with-docs 分析结果

### 4.1 领域文档创建

**创建文件**:

- ✅ [CONTEXT.md](file:///f:/Codes/MIDI-JAR-NEW/CONTEXT.md) - 项目领域模型和核心概念
- ✅ [docs/adr/0001-midi-routing-architecture.md](file:///f:/Codes/MIDI-JAR-NEW/docs/adr/0001-midi-routing-architecture.md) - MIDI 路由架构决策记录

**CONTEXT.md 内容**:

- 定义了 6 个核心领域概念
- 明确了 3 层架构层次
- 提供了技术约束说明

**ADR-0001 内容**:

- 记录了 MIDI 路由架构的决策过程
- 分析了优缺点和风险
- 提供了替代方案对比

### 4.2 术语冲突检测

**发现的术语歧义**:

1. **"Output" 的双重含义**
   - 物理输出设备(连接到 MIDI 键盘/合成器)
   - 内部输出模块(chord-dictionary, debugger)

2. **"Route" vs "Wire"**
   - Route: 用户配置意图
   - Wire: 实际连接状态

**已在 CONTEXT.md 中明确区分**

## 五、综合建议

### 5.1 短期改进(1-2 周)

1. **补全数据库索引**

   ```bash
   python3 scripts/phase2/enrich_depth_segments.py /path/to/MIDI-JAR-NEW --batch 500
   python3 scripts/phase2/enrich_file_refs.py /path/to/MIDI-JAR-NEW --batch 500
   python3 scripts/phase2/flatten_file_deps.py /path/to/MIDI-JAR-NEW
   python3 scripts/phase2/create_enriched_view.py /path/to/MIDI-JAR-NEW
   ```

2. **替换 console.log**
   - 全局搜索 `console\.(log|warn|error)` 替换为 `logger.*`
   - 配置生产环境日志级别

3. **添加核心模块测试**
   - 创建 `src/midi/__tests__/` 目录
   - 测试 `MidiDeviceManager` 和 `InternalMidiMessages`

### 5.2 中期重构(1-2 月)

1. **创建 MIDI 传输抽象层**
   - 定义 `MidiTransport` 接口
   - 实现 `TauriMidiTransport` 和 `MockMidiTransport`
   - 依赖注入到 stores

2. **增强 ChordDictionaryStore**
   - 将和弦查找/过滤逻辑从视图层下沉到 store
   - 添加和弦推荐等高层方法

3. **统一坐标系统**
   - 创建 `CoordinateSystem` 类
   - 集中管理所有 canvas 的坐标转换

### 5.3 长期规划(3-6 月)

1. **模块化架构**
   - 将流体引擎提取为独立包
   - 将 MIDI 管理提取为独立包
   - 支持插件化扩展

2. **性能优化**
   - 使用 WebGPU 重写流体引擎
   - 实现 MIDI 消息批处理
   - 添加性能监控面板

3. **跨平台支持**
   - 探索 WebAssembly 后端
   - 支持浏览器版本(使用 Web MIDI API)

## 六、风险与缓解

### 风险 1: 重构破坏现有功能

**缓解**:

- 先补全测试再重构
- 使用 Vitest 的快照测试
- 分阶段重构,每阶段独立验证

### 风险 2: 性能退化

**缓解**:

- 建立 CI 性能基准测试
- 监控关键指标(流体 fps、MIDI 延迟)
- 使用 Chrome DevTools Performance 面板

### 风险 3: 文档过时

**缓解**:

- 将 CONTEXT.md 纳入代码审查流程
- 重要变更必须更新对应 ADR
- 定期审查文档一致性

## 七、额外发现的问题（第四轮扫描）

### 7.1 类型检查错误

**位置**: [src/views/ChordDictionary/ChordDictionaryChordMenu.vue:80](file:///f:/Codes/MIDI-JAR-NEW/src/views/ChordDictionary/ChordDictionaryChordMenu.vue#L80)

```typescript
error TS2339: Property 'open' does not exist on type 'HTMLElement'.
```

**问题**: HTML 元素类型断言不正确,缺少具体的元素类型声明。

**影响**: 编译时类型检查失败,可能在生产环境产生运行时错误。

**建议**:

```typescript
// 修改前
const details = item.querySelector("details") as HTMLElement;

// 修改后
const details = item.querySelector("details") as HTMLDetailsElement;
```

### 7.2 深拷贝性能问题

**位置**: 6 处使用 `JSON.parse(JSON.stringify())`

**问题**: 使用 JSON 序列化进行深拷贝存在以下问题:

1. 无法处理函数、undefined、Symbol
2. 循环引用会抛出错误
3. 性能较差(比 structuredClone 慢 10-100 倍)

**位置清单**:

- [src/helpers/object.ts:9](file:///f:/Codes/MIDI-JAR-NEW/src/helpers/object.ts#L9)
- [src/stores/settings.ts:57](file:///f:/Codes/MIDI-JAR-NEW/src/stores/settings.ts#L57)
- [src/stores/settings.ts:63](file:///f:/Codes/MIDI-JAR-NEW/src/stores/settings.ts#L63)
- [src/views/WaterfallPiano/**tests**/](file:///f:/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/__tests__) (3 处测试文件)

**建议**:

```typescript
// 使用 structuredClone (现代浏览器原生支持)
const clone = structuredClone(obj);

// 或使用 lodash.cloneDeep (兼容性更好)
import { cloneDeep } from "lodash-es";
const clone = cloneDeep(obj);
```

### 7.3 定时器泄漏风险

**位置**: 13 处使用 `setTimeout` / `setInterval`

**问题**: 未在组件销毁时清理定时器,可能导致:

1. 内存泄漏
2. 组件销毁后仍然执行回调
3. 意外的副作用

**高风险位置**:

- [src/composables/useMidiActivity.ts](file:///f:/Codes/MIDI-JAR-NEW/src/composables/useMidiActivity.ts) - setTimeout 未清理
- [src/stores/midiRouting.ts](file:///f:/Codes/MIDI-JAR-NEW/src/stores/midiRouting.ts) - setInterval 有清理但逻辑分散

**建议**:

```typescript
// 使用 VueUse 的 useTimeoutFn / useIntervalFn
import { useTimeoutFn, useIntervalFn } from "@vueuse/core";

const { start, stop } = useTimeoutFn(callback, interval);
// 组件销毁时自动清理
```

### 7.4 随机数使用不当

**位置**: 11 处使用 `Math.random()`

**问题**: 流体模拟和背景渲染中使用 `Math.random()` 会产生:

1. 每次渲染结果不同(破坏视觉一致性)
2. 难以复现 Bug
3. 测试困难

**影响场景**:

- 流体模拟初始化时的随机 splat
- 背景渲染的随机粒子位置

**建议**:

```typescript
// 使用种子随机数生成器(确定性随机)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

// 在配置中提供种子值
const random = new SeededRandom(config.randomSeed);
```

### 7.5 Object.assign 的可变性问题

**位置**: 3 处使用 `Object.assign`

**问题**: `Object.assign` 会修改目标对象,违反不可变性原则:

- [src/engine/fluid/FluidSimulation.ts:283](file:///f:/Codes/MIDI-JAR-NEW/src/engine/fluid/FluidSimulation.ts#L283) - 直接修改 config
- [src/engine/fluid/FluidConfig.ts:162-163](file:///f:/Codes/MIDI-JAR-NEW/src/engine/fluid/FluidConfig.ts#L162-163) - 修改 base 对象

**建议**:

```typescript
// 使用展开运算符(创建新对象)
this.config = { ...this.config, ...config };

// 或使用 Object.assign 但先创建副本
this.config = Object.assign({}, this.config, config);
```

## 八、结论

MIDI-JAR 是一个架构清晰的桌面音乐应用,核心功能实现完整。通过三个 Agent Skills 的联合分析,识别出以下关键改进点:

1. **架构层面**: MIDI 前后端耦合需要抽象层,Settings 深层嵌套需要重构
2. **测试层面**: 核心模块测试覆盖不足,需要补充单元测试和集成测试
3. **代码质量**: console.log 泛滥需要替换为结构化日志,类型安全需要增强
4. **性能层面**: 深拷贝使用 JSON 序列化,定时器泄漏风险,随机数使用不当

建议按照短期→中期→长期的节奏逐步改进,优先补全测试和文档,再进行架构重构。

---

**生成时间**: 2026-07-15
**分析工具**: sql-manything + improve-codebase-architecture + grill-with-docs
**分析文件数**: 239 个源文件
**查询次数**: 4 轮深入查询(额外补充扫描)
