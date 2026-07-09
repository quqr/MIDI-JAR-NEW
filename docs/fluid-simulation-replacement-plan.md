# 流体模拟替换计划

## 概述

将当前 WaterfallPiano 的流体效果（PixiJS FBM 噪声 shader，伪流体）替换为 [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) 的真实 Navier-Stokes 物理流体模拟。

## 决策记录

| # | 问题 | 决策 | 理由 |
|---|------|------|------|
| 1 | 替换范围 | **双层方案**：独立 WebGL canvas (底层) + PixiJS canvas (上层) | 两层各司其职，互不干扰 |
| 2 | Canvas 对齐 | **CSS 叠加**：`position: absolute` 叠加在同一容器 | 坐标天然对齐，简单直接 |
| 3 | 代码组织 | **完全重写为 TS 模块**，最细粒度拆分 | 可维护性最好，与项目架构一致 |
| 4 | MIDI → Splat 映射 | 音符 → 水平坐标，velocity → splat 力度 | 最直觉的映射，符合钢琴空间分布 |
| 5 | 分辨率策略 | **可配置**：低(256) / 中(512) / 高(1024) | 用户根据 GPU 选择 |
| 6 | 背景模式 | 流体模式下 BackgroundRenderer 不渲染，流体 canvas 全权负责 | 职责清晰 |
| 7 | 参数面板 | **简单/高级模式切换**：预设 + 3-5 核心滑块 / 全部参数 | 两全其美 |
| 8 | 后处理 | 流体自带 Bloom/Sunrays，PixiJS 独立处理 | 各取所长，互不干扰 |

## 目录结构

```
src/views/WaterfallPiano/engine/fluid/
├── FluidSimulation.ts        # 入口类，管理主循环
├── FluidConfig.ts            # 配置类型和默认值
├── GLContext.ts              # WebGL 上下文初始化 + 扩展检测
├── GLUtils.ts               # Shader 编译、Program/Blit 工具
├── FramebufferManager.ts    # FBO 创建/管理/resize
├── FluidSolver.ts           # N-S 求解器（curl/vorticity/divergence/pressure/advect/splat）
├── BloomPass.ts             # Bloom 后处理
├── SunraysPass.ts           # Sunrays 后处理
├── DisplayPass.ts           # 最终合成显示
├── shaders/
│   ├── baseVertex.glsl      # 基础顶点着色器
│   ├── blurVertex.glsl      # 模糊顶点着色器
│   ├── blur.glsl            # 高斯模糊
│   ├── copy.glsl            # 纹理拷贝
│   ├── clear.glsl           # 压力衰减
│   ├── color.glsl           # 纯色填充
│   ├── checkerboard.glsl    # 棋盘格（透明背景）
│   ├── splat.glsl           # 流体注入
│   ├── advection.glsl       # 平流（核心 N-S）
│   ├── divergence.glsl      # 散度计算
│   ├── curl.glsl            # 旋度计算
│   ├── vorticity.glsl       # 涡度增强
│   ├── pressure.glsl        # 压力求解（Jacobi 迭代）
│   ├── gradientSubtract.glsl # 梯度减法
│   ├── display.glsl         # 最终显示（含 SHADING/BLOOM/SUNRAYS 条件编译）
│   ├── bloomPrefilter.glsl  # Bloom 预滤波
│   ├── bloomBlur.glsl       # Bloom 模糊
│   ├── bloomFinal.glsl      # Bloom 最终合成
│   ├── sunraysMask.glsl     # Sunrays 遮罩
│   └── sunrays.glsl         # Sunrays 射线
```

## 分阶段实施

### Phase 1: TS 模块移植

将 script.js (~1600行) 完全重写为 TypeScript 模块。

#### 1a. Shaders (20 个文件)

从 `F:\Codes\WebGL-Fluid-Simulation\script.js` 提取所有 GLSL shader 源码，转为 TS 模板字符串导出。

- 移除 `compileShader()` 调用，只导出纯 GLSL 字符串
- `advectionShader` 的 `MANUAL_FILTERING` 条件编译保留，由调用方传入 keywords

#### 1b. GLContext.ts

```ts
export interface GLExtensions {
  formatRGBA: { internalFormat: number; format: number } | null;
  formatRG: { internalFormat: number; format: number } | null;
  formatR: { internalFormat: number; format: number } | null;
  halfFloatTexType: number;
  supportLinearFiltering: boolean;
}

export interface GLContextResult {
  gl: WebGLRenderingContext;
  ext: GLExtensions;
}

export function getWebGLContext(canvas: HTMLCanvasElement): GLContextResult;
export function getSupportedFormat(gl: WebGLRenderingContext, internalFormat: number, format: number, type: number): { internalFormat: number; format: number } | null;
```

#### 1c. GLUtils.ts

```ts
export class Program { ... }      // shader 程序封装
export class Material { ... }     // 可切换 keywords 的材质
export function compileShader(...): WebGLShader;
export function createBlit(gl: WebGLRenderingContext): (target: FBO | null, clear?: boolean) => void;
export function scaleByPixelRatio(input: number): number;
```

#### 1d. FramebufferManager.ts

```ts
export interface FBO { texture: WebGLTexture; fbo: WebGLFramebuffer; width: number; height: number; texelSizeX: number; texelSizeY: number; attach(id: number): number; }
export interface DoubleFBO { read: FBO; write: FBO; width: number; height: number; texelSizeX: number; texelSizeY: number; swap(): void; }

export function createFBO(gl, ext, w, h, internalFormat, format, type, param): FBO;
export function createDoubleFBO(...): DoubleFBO;
export function resizeFBO(...): FBO;
export function resizeDoubleFBO(...): DoubleFBO;
export function getResolution(gl, resolution): { width: number; height: number };
```

#### 1e. FluidSolver.ts

N-S 求解器核心逻辑，从 script.js 的 `step()` 函数提取：

```ts
export class FluidSolver {
  constructor(gl, ext, blit, config);
  initFramebuffers(width, height): void;
  step(dt: number): void;
  splat(x, y, dx, dy, color: { r, g, b }): void;
  multipleSplats(amount: number): void;
  resize(width, height): void;
  destroy(): void;
}
```

包含：curl → vorticity → divergence → clear pressure → pressure Jacobi → gradient subtract → advection（velocity + dye）

#### 1f. BloomPass.ts + SunraysPass.ts + DisplayPass.ts

```ts
export class BloomPass {
  constructor(gl, ext, blit, config);
  initFramebuffers(): void;
  apply(source: FBO, destination: FBO): void;
  resize(): void;
  destroy(): void;
}

export class SunraysPass {
  constructor(gl, ext, blit, config);
  initFramebuffers(): void;
  apply(source, mask, destination): void;
  blur(target, temp, iterations): void;
  resize(): void;
  destroy(): void;
}

export class DisplayPass {
  constructor(gl, ext, blit, config);
  render(target, dye, bloom, sunrays, ditheringTexture): void;
  updateKeywords(): void; // SHADING/BLOOM/SUNRAYS
  destroy(): void;
}
```

#### 1g. FluidConfig.ts

```ts
export interface FluidSimulationConfig {
  // 模拟参数
  SIM_RESOLUTION: number;       // 32-256
  DYE_RESOLUTION: number;       // 128-1024
  DENSITY_DISSIPATION: number;  // 0-4
  VELOCITY_DISSIPATION: number; // 0-4
  PRESSURE: number;             // 0-1
  PRESSURE_ITERATIONS: number;  // 5-50
  CURL: number;                 // 0-50 (涡度)
  SPLAT_RADIUS: number;         // 0.01-1.0
  SPLAT_FORCE: number;          // 1000-10000
  SHADING: boolean;
  // Bloom
  BLOOM: boolean;
  BLOOM_ITERATIONS: number;     // 2-16
  BLOOM_RESOLUTION: number;     // 64-512
  BLOOM_INTENSITY: number;      // 0.1-2.0
  BLOOM_THRESHOLD: number;      // 0-1
  BLOOM_SOFT_KNEE: number;      // 0-1
  // Sunrays
  SUNRAYS: boolean;
  SUNRAYS_RESOLUTION: number;   // 64-512
  SUNRAYS_WEIGHT: number;       // 0.3-1.0
  // 背景
  BACK_COLOR: { r: number; g: number; b: number };
  TRANSPARENT: boolean;
}

// 质量预设
export const QUALITY_PRESETS = {
  low: { DYE_RESOLUTION: 256, SIM_RESOLUTION: 64, BLOOM: false, SUNRAYS: false },
  medium: { DYE_RESOLUTION: 512, SIM_RESOLUTION: 128, BLOOM: true, SUNRAYS: false },
  high: { DYE_RESOLUTION: 1024, SIM_RESOLUTION: 128, BLOOM: true, SUNRAYS: true },
};

// 风格预设
export const STYLE_PRESETS = {
  gentle: { DENSITY_DISSIPATION: 2, VELOCITY_DISSIPATION: 0.5, CURL: 10, SPLAT_RADIUS: 0.4 },
  standard: { DENSITY_DISSIPATION: 1, VELOCITY_DISSIPATION: 0.2, CURL: 30, SPLAT_RADIUS: 0.25 },
  turbulent: { DENSITY_DISSIPATION: 0.5, VELOCITY_DISSIPATION: 0.1, CURL: 50, SPLAT_RADIUS: 0.15 },
};

export const DEFAULT_CONFIG: FluidSimulationConfig = { ... };
```

#### 1h. FluidSimulation.ts（入口类）

```ts
export class FluidSimulation {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private ext: GLExtensions;
  private solver: FluidSolver;
  private bloomPass: BloomPass;
  private sunraysPass: SunraysPass;
  private displayPass: DisplayPass;
  private config: FluidSimulationConfig;
  private animationId: number | null = null;
  private lastUpdateTime = 0;

  constructor(canvas: HTMLCanvasElement, config?: Partial<FluidSimulationConfig>);
  
  /** 初始化 WebGL 资源，启动渲染循环 */
  start(): void;
  
  /** 注入一个流体 splat（MIDI 触发时调用） */
  splat(x: number, y: number, dx: number, dy: number, color: { r: number; g: number; b: number }): void;
  
  /** 更新配置（设置面板调用） */
  updateConfig(config: Partial<FluidSimulationConfig>): void;
  
  /** 处理 canvas resize */
  resize(): void;
  
  /** 暂停/恢复 */
  setPaused(paused: boolean): void;
  
  /** 停止渲染循环，释放所有 WebGL 资源 */
  destroy(): void;
}
```

### Phase 2: 双层 Canvas 集成

修改 `WaterfallCanvas.vue`：

```html
<template>
  <div ref="containerRef" class="w-full h-full bg-base-300 relative">
    <!-- 底层：流体模拟 WebGL canvas -->
    <canvas
      v-show="isFluidBackground"
      ref="fluidCanvasRef"
      class="absolute inset-0 w-full h-full"
      style="z-index: 0"
    />
    <!-- 上层：PixiJS canvas -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full cursor-pointer"
      style="z-index: 1"
      ...
    />
    <!-- Tooltip / ContextMenu 保持不变 -->
  </div>
</template>
```

关键改动：
- 添加 `fluidCanvasRef`，在 `onMounted` 时创建 `FluidSimulation` 实例
- 监听 `settings.background.type`，当为 `"fluid"` 时显示流体 canvas 并启动模拟，否则隐藏并暂停
- 两个 canvas 都用 `position: absolute; inset: 0` 叠加

### Phase 3: MIDI → Splat 映射

在 `WaterfallEngine` 中添加流体 splat 触发：

```ts
// WaterfallEngine.ts 新增
private fluidSimulation: FluidSimulation | null = null;

// 在 playRealtimeNote 中添加
playRealtimeNote(midi: number, velocity: number) {
  // ... 现有逻辑 ...
  
  // 流体 splat
  if (this.fluidSimulation) {
    const x = this.midiToFluidX(midi);        // MIDI → 水平坐标 0-1
    const y = 0.5;                             // 垂直居中
    const force = (velocity / 127) * 6000;     // velocity → 力度
    const color = this.midiToFluidColor(midi); // 音高 → 颜色
    this.fluidSimulation.splat(x, y, force, 0, color);
  }
}

private midiToFluidX(midi: number): number {
  // 88 键映射到 0-1（A0=21, C8=108）
  return (midi - 21) / (108 - 21);
}

private midiToFluidColor(midi: number): { r: number; g: number; b: number } {
  // 音高 → HSV → RGB，高音偏冷低音偏暖
  const hue = (midi - 21) / 87; // 0-1
  return HSVtoRGB(hue, 1.0, 1.0);
}
```

### Phase 4: 设置面板

在 `WaterfallPianoSettings.vue` 的背景设置区域添加：

1. **质量选择**（简单模式）：`低 / 中 / 高` 单选
2. **风格预设**（简单模式）：`柔和 / 标准 / 激烈` 单选
3. **高级模式开关**：展开全部参数
4. **高级参数**（折叠）：
   - 密度扩散 (0-4)
   - 速度扩散 (0-4)
   - 压力 (0-1)
   - 涡度 (0-50)
   - Splat 半径 (0.01-1.0)
   - Bloom 开关 + 强度 + 阈值
   - Sunrays 开关 + 权重

在 `types.ts` 的 `BackgroundConfig` 中扩展流体配置：

```ts
// 新增字段
fluidQuality: 'low' | 'medium' | 'high';
fluidStyle: 'gentle' | 'standard' | 'turbulent';
fluidAdvanced: boolean;
fluidParams: Partial<FluidSimulationConfig>; // 高级模式参数覆盖
```

### Phase 5: 清理

- 删除 `FluidRenderer.ts`（旧的 PixiJS FBM shader）
- `BackgroundRenderer.ts` 中移除 `FluidRenderer` 导入和引用
- 流体模式改为只设置深色背景底色 + 显示流体 canvas

## 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `engine/fluid/*.ts` (新建 ~20 个文件) | **新建** | Phase 1: 完整 TS 模块 |
| `engine/fluid/shaders/*.glsl` (新建 ~20 个文件) | **新建** | Phase 1: GLSL shader 源码 |
| `WaterfallPiano/components/WaterfallCanvas.vue` | **修改** | Phase 2: 添加流体 canvas |
| `WaterfallPiano/engine/WaterfallEngine.ts` | **修改** | Phase 3: MIDI → Splat 映射 |
| `WaterfallPiano/engine/BackgroundRenderer.ts` | **修改** | Phase 5: 移除旧 FluidRenderer |
| `WaterfallPiano/engine/FluidRenderer.ts` | **删除** | Phase 5: 旧实现 |
| `WaterfallPiano/types.ts` | **修改** | Phase 4: 扩展配置类型 |
| `Settings/WaterfallPianoSettings/WaterfallPianoSettings.vue` | **修改** | Phase 4: 设置面板 |
| `stores/waterfallPiano.ts` | **修改** | Phase 4: 默认值 |

## 依赖关系

```
Phase 1 (TS 模块) ← 完全独立，可提前开发和测试
  ↓
Phase 2 (Canvas 集成) ← 依赖 Phase 1
  ↓
Phase 3 (MIDI 映射) ← 依赖 Phase 2
  ↓
Phase 4 (设置面板) ← 依赖 Phase 1 的 FluidConfig
  ↓
Phase 5 (清理) ← 依赖 Phase 2 确认可用
```

## 风险和注意事项

1. **WebGL context 冲突**：两个独立的 WebGL context（PixiJS + 流体）在同一页面上，某些设备可能限制 context 数量。需要在 `FluidSimulation` 初始化失败时 graceful fallback 到旧的 FBM 效果。

2. **性能**：N-S 求解器每帧执行 14+ 次 shader pass，在低端设备上可能影响帧率。通过 `QualityPresets` 和 `PerformanceMonitor` 的自动降级机制缓解。

3. **Dithering 纹理**：原项目加载 `LDR_LLL1_0.png` 作为 dithering 噪声，需要将此文件复制到项目的 `public/` 目录。

4. **Shader 语法差异**：script.js 使用 WebGL1/2 兼容的 GLSL（`texture2D`），需确保与 PixiJS 的 WebGL context 版本兼容。

## License

WebGL-Fluid-Simulation 使用 MIT License，可自由使用和修改。
