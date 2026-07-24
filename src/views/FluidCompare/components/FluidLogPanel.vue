<template>
  <div class="bg-base-200 rounded-lg flex flex-col" style="height: 240px">
    <!-- 工具栏 -->
    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-base-300 shrink-0">
      <!-- Tab 切换 -->
      <div role="tablist" class="tabs tabs-boxed tabs-xs">
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'metrics' }"
          @click="activeTab = 'metrics'"
        >
          帧指标
        </button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'solver' }"
          @click="activeTab = 'solver'"
        >
          Solver 耗时
        </button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'diagnostics' }"
          @click="activeTab = 'diagnostics'"
        >
          诊断
        </button>
      </div>

      <div class="flex-1" />

      <!-- 状态指示 -->
      <span class="text-xs text-base-content/60">
        {{ logging ? "记录中" : "已暂停" }}
      </span>
      <span v-if="latestLog" class="text-xs text-base-content/40 tabular-nums">
        {{ logCount }} 条
      </span>

      <!-- 操作按钮 -->
      <button class="btn btn-xs btn-ghost" @click="$emit('toggle-logging')">
        {{ logging ? "暂停" : "继续" }}
      </button>
      <button class="btn btn-xs btn-ghost" @click="$emit('clear-logs')">清空</button>
      <button class="btn btn-xs btn-ghost" @click="$emit('export-logs')">导出</button>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-auto p-2 text-xs">
      <template v-if="!latestLog">
        <div class="text-base-content/40 text-center py-8">等待数据...</div>
      </template>

      <!-- Tab 1: 帧指标 -->
      <template v-else-if="activeTab === 'metrics'">
        <table class="table table-xs w-full">
          <thead>
            <tr>
              <th class="text-base-content/60">指标</th>
              <th class="text-base-content/60 text-right">WebGL</th>
              <th class="text-base-content/60 text-right">PixiJS</th>
              <th class="text-base-content/60 text-right">差异</th>
            </tr>
          </thead>
          <tbody class="tabular-nums">
            <tr>
              <td>FPS</td>
              <td class="text-right">{{ latestLog.webgl.fps }}</td>
              <td class="text-right">{{ latestLog.pixi.fps }}</td>
              <td
                class="text-right"
                :class="diffClass(latestLog.diff.fpsDelta)"
              >
                {{ formatDelta(latestLog.diff.fpsDelta) }}
              </td>
            </tr>
            <tr>
              <td>dt (ms)</td>
              <td class="text-right">{{ (latestLog.webgl.dt * 1000).toFixed(2) }}</td>
              <td class="text-right">{{ (latestLog.pixi.dt * 1000).toFixed(2) }}</td>
              <td
                class="text-right"
                :class="diffClass(latestLog.diff.dtDelta * 1000)"
              >
                {{ formatDelta(latestLog.diff.dtDelta * 1000, 2) }}
              </td>
            </tr>
            <tr>
              <td>splat 总数</td>
              <td class="text-right">{{ latestLog.webgl.splatCount }}</td>
              <td class="text-right">{{ latestLog.pixi.splatCount }}</td>
              <td
                class="text-right"
                :class="diffClass(latestLog.diff.splatCountDelta)"
              >
                {{ formatDelta(latestLog.diff.splatCountDelta) }}
              </td>
            </tr>
            <tr>
              <td>染料分辨率</td>
              <td class="text-right">{{ latestLog.webgl.dyeResolution }}</td>
              <td class="text-right">{{ latestLog.pixi.dyeResolution }}</td>
              <td class="text-right text-base-content/30">—</td>
            </tr>
            <tr>
              <td>模拟分辨率</td>
              <td class="text-right">{{ latestLog.webgl.simResolution }}</td>
              <td class="text-right">{{ latestLog.pixi.simResolution }}</td>
              <td class="text-right text-base-content/30">—</td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- Tab 2: Solver 耗时 -->
      <template v-else-if="activeTab === 'solver'">
        <div v-if="!hasDiagnostics" class="text-base-content/40 text-center py-8">
          诊断数据采样中（每 30 帧更新）...
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="step in solverSteps"
            :key="step.key"
            class="flex items-center gap-2"
          >
            <span class="w-24 text-base-content/70 shrink-0">{{ step.label }}</span>
            <!-- WebGL bar -->
            <div class="flex-1 flex items-center gap-1">
              <div class="flex-1 bg-base-300 rounded h-3 overflow-hidden">
                <div
                  class="h-full bg-info rounded"
                  :style="{ width: barWidth(webglTiming(step.key)) }"
                />
              </div>
              <span class="w-12 text-right tabular-nums text-base-content/60">
                {{ webglTiming(step.key).toFixed(2) }}
              </span>
            </div>
            <!-- PixiJS bar -->
            <div class="flex-1 flex items-center gap-1">
              <div class="flex-1 bg-base-300 rounded h-3 overflow-hidden">
                <div
                  class="h-full bg-success rounded"
                  :style="{ width: barWidth(pixiTiming(step.key)) }"
                />
              </div>
              <span class="w-12 text-right tabular-nums text-base-content/60">
                {{ pixiTiming(step.key).toFixed(2) }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 pt-1 border-t border-base-300">
            <span class="w-24 text-base-content/70 shrink-0 font-semibold">总计</span>
            <div class="flex-1 flex items-center gap-1">
              <span class="w-12 text-right tabular-nums text-info font-semibold">
                {{ webglTiming("total").toFixed(2) }}ms
              </span>
            </div>
            <div class="flex-1 flex items-center gap-1">
              <span class="w-12 text-right tabular-nums text-success font-semibold">
                {{ pixiTiming("total").toFixed(2) }}ms
              </span>
            </div>
          </div>
          <div class="flex gap-4 pt-1 text-base-content/50">
            <span><span class="inline-block w-2 h-2 bg-info rounded mr-1" />WebGL</span>
            <span><span class="inline-block w-2 h-2 bg-success rounded mr-1" />PixiJS</span>
          </div>
        </div>
      </template>

      <!-- Tab 3: 诊断 -->
      <template v-else-if="activeTab === 'diagnostics'">
        <div v-if="!hasDiagnostics" class="text-base-content/40 text-center py-8">
          诊断数据采样中（每 30 帧更新）...
        </div>
        <div v-else class="space-y-2">
          <!-- Dye 采样对比 -->
          <div>
            <div class="text-base-content/70 font-semibold mb-1">Dye 纹理中心采样</div>
            <div class="flex gap-4">
              <div class="flex items-center gap-1.5">
                <span class="text-base-content/50">WebGL:</span>
                <span
                  class="inline-block w-4 h-4 rounded border border-base-300"
                  :style="{
                    backgroundColor: rgbToCss(latestLog.webgl.diagnostics?.dyeSample),
                  }"
                />
                <span class="tabular-nums text-base-content/60">
                  {{ formatSample(latestLog.webgl.diagnostics?.dyeSample) }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-base-content/50">PixiJS:</span>
                <span
                  class="inline-block w-4 h-4 rounded border border-base-300"
                  :style="{
                    backgroundColor: rgbToCss(latestLog.pixi.diagnostics?.dyeSample),
                  }"
                />
                <span class="tabular-nums text-base-content/60">
                  {{ formatSample(latestLog.pixi.diagnostics?.dyeSample) }}
                </span>
              </div>
              <div v-if="latestLog.diff.dyeSampleDelta" class="flex items-center gap-1.5">
                <span class="text-base-content/50">Δ:</span>
                <span class="tabular-nums text-base-content/60">
                  {{ formatSample(latestLog.diff.dyeSampleDelta) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Pass 状态 -->
          <div>
            <div class="text-base-content/70 font-semibold mb-1">后处理 Pass 状态</div>
            <table class="table table-xs w-full">
              <thead>
                <tr>
                  <th class="text-base-content/50">Pass</th>
                  <th class="text-base-content/50">WebGL</th>
                  <th class="text-base-content/50">PixiJS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bloom</td>
                  <td>{{ passLabel(latestLog.webgl.diagnostics?.passes, "bloom") }}</td>
                  <td>{{ passLabel(latestLog.pixi.diagnostics?.passes, "bloom") }}</td>
                </tr>
                <tr>
                  <td>Sunrays</td>
                  <td>{{ passLabel(latestLog.webgl.diagnostics?.passes, "sunrays") }}</td>
                  <td>{{ passLabel(latestLog.pixi.diagnostics?.passes, "sunrays") }}</td>
                </tr>
                <tr>
                  <td>Display 格式</td>
                  <td>{{ latestLog.webgl.diagnostics?.passes.display.outputFormat }}</td>
                  <td>{{ latestLog.pixi.diagnostics?.passes.display.outputFormat }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Splat 链路追踪 -->
          <div>
            <div class="text-base-content/70 font-semibold mb-1">最近 Splat 追踪</div>
            <div v-if="!hasSplatTrace" class="text-base-content/40">无 splat 事件</div>
            <div v-else class="space-y-1">
              <div class="flex gap-4">
                <span class="text-base-content/50">WebGL:</span>
                <span class="tabular-nums text-base-content/60">
                  {{ formatSplat(latestLog.webgl.diagnostics?.lastSplat) }}
                </span>
              </div>
              <div class="flex gap-4">
                <span class="text-base-content/50">PixiJS:</span>
                <span class="tabular-nums text-base-content/60">
                  {{ formatSplat(latestLog.pixi.diagnostics?.lastSplat) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { FluidCompareLog } from "../types";
import type { PassStatus, SplatTrace, SolverStepTimings, TextureSample } from "../diagnostics";

const props = defineProps<{
  logs: readonly FluidCompareLog[];
  logging: boolean;
}>();

defineEmits<{
  (e: "toggle-logging"): void;
  (e: "clear-logs"): void;
  (e: "export-logs"): void;
}>();

const activeTab = ref<"metrics" | "solver" | "diagnostics">("metrics");

const latestLog = computed(() => props.logs[props.logs.length - 1] ?? null);
const logCount = computed(() => props.logs.length);
const hasDiagnostics = computed(
  () => !!(latestLog.value?.webgl.diagnostics && latestLog.value?.pixi.diagnostics),
);
const hasSplatTrace = computed(
  () => !!(latestLog.value?.webgl.diagnostics?.lastSplat || latestLog.value?.pixi.diagnostics?.lastSplat),
);

const solverSteps: { key: keyof SolverStepTimings; label: string }[] = [
  { key: "curl", label: "Curl" },
  { key: "vorticity", label: "Vorticity" },
  { key: "divergence", label: "Divergence" },
  { key: "clearPressure", label: "Clear Pressure" },
  { key: "pressure", label: "Pressure" },
  { key: "gradientSubtract", label: "Gradient Sub" },
  { key: "advectVelocity", label: "Advect Vel" },
  { key: "advectDye", label: "Advect Dye" },
];

function webglTiming(key: keyof SolverStepTimings): number {
  return latestLog.value?.webgl.diagnostics?.stepTimings[key] ?? 0;
}

function pixiTiming(key: keyof SolverStepTimings): number {
  return latestLog.value?.pixi.diagnostics?.stepTimings[key] ?? 0;
}

/** 计算柱状图宽度百分比（相对于所有步骤最大值） */
function barWidth(value: number): string {
  const allTimings = latestLog.value;
  if (!allTimings?.webgl.diagnostics || !allTimings?.pixi.diagnostics) return "0%";
  const wTimings = allTimings.webgl.diagnostics.stepTimings;
  const pTimings = allTimings.pixi.diagnostics.stepTimings;
  let max = 0;
  for (const step of solverSteps) {
    max = Math.max(max, wTimings[step.key], pTimings[step.key]);
  }
  max = Math.max(max, 0.01);
  return `${Math.min(100, (value / max) * 100)}%`;
}

/** 差异颜色类 */
function diffClass(delta: number): string {
  const abs = Math.abs(delta);
  if (abs < 0.01) return "text-success";
  if (abs < 1) return "text-warning";
  return "text-error";
}

/** 格式化差异值 */
function formatDelta(delta: number, digits = 0): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(digits)}`;
}

/** 格式化纹理采样 */
function formatSample(s?: TextureSample | { r: number; g: number; b: number }): string {
  if (!s) return "—";
  return `(${s.r.toFixed(3)}, ${s.g.toFixed(3)}, ${s.b.toFixed(3)})`;
}

/** RGB 转 CSS 颜色 */
function rgbToCss(s?: TextureSample): string {
  if (!s) return "transparent";
  return `rgb(${Math.round(s.r * 255)}, ${Math.round(s.g * 255)}, ${Math.round(s.b * 255)})`;
}

/** Pass 状态标签 */
function passLabel(
  passes?: PassStatus,
  key?: "bloom" | "sunrays",
): string {
  if (!passes || !key) return "—";
  if (key === "bloom") {
    return passes.bloom.enabled ? `ON (${passes.bloom.iterations})` : "OFF";
  }
  return passes.sunrays.enabled ? `ON (${passes.sunrays.weight})` : "OFF";
}

/** 格式化 splat 追踪 */
function formatSplat(trace?: SplatTrace): string {
  if (!trace) return "—";
  const i = trace.input;
  let s = `in:(${i.x.toFixed(2)},${i.y.toFixed(2)}) d:(${i.dx.toFixed(1)},${i.dy.toFixed(1)})`;
  if (trace.converted) {
    const c = trace.converted;
    s += ` → conv:(${c.x.toFixed(2)},${c.y.toFixed(2)}) d:(${c.dx.toFixed(1)},${c.dy.toFixed(1)})`;
  }
  return s;
}
</script>
