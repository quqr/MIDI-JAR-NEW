<template>
  <div class="bg-base-200 rounded-lg p-3 space-y-3 text-xs">
    <!-- 主面板参数 -->
    <div class="space-y-2">
      <div class="text-base-content font-semibold text-sm">模拟参数</div>

      <!-- 模拟分辨率 -->
      <div class="flex items-center gap-2">
        <label class="flex-1 text-base-content/70">模拟分辨率</label>
        <select
          :value="config.SIM_RESOLUTION"
          class="select select-bordered select-xs w-28 bg-base-100"
          @change="emitChange({ SIM_RESOLUTION: Number(($event.target as HTMLSelectElement).value) })"
        >
          <option :value="32">32</option>
          <option :value="64">64</option>
          <option :value="128">128</option>
          <option :value="256">256</option>
        </select>
      </div>

      <!-- 染料分辨率 -->
      <div class="flex items-center gap-2">
        <label class="flex-1 text-base-content/70">染料分辨率</label>
        <select
          :value="config.DYE_RESOLUTION"
          class="select select-bordered select-xs w-28 bg-base-100"
          @change="emitChange({ DYE_RESOLUTION: Number(($event.target as HTMLSelectElement).value) })"
        >
          <option :value="128">128</option>
          <option :value="256">256</option>
          <option :value="512">512</option>
          <option :value="1024">1024</option>
        </select>
      </div>

      <!-- 密度扩散 -->
      <SliderRow
        label="密度扩散"
        :value="config.DENSITY_DISSIPATION"
        :min="0"
        :max="4"
        :step="0.01"
        @change="(v) => emitChange({ DENSITY_DISSIPATION: v })"
      />

      <!-- 速度扩散 -->
      <SliderRow
        label="速度扩散"
        :value="config.VELOCITY_DISSIPATION"
        :min="0"
        :max="4"
        :step="0.01"
        @change="(v) => emitChange({ VELOCITY_DISSIPATION: v })"
      />

      <!-- 压力 -->
      <SliderRow
        label="压力"
        :value="config.PRESSURE"
        :min="0"
        :max="1"
        :step="0.01"
        @change="(v) => emitChange({ PRESSURE: v })"
      />

      <!-- 涡度 -->
      <SliderRow
        label="涡度"
        :value="config.CURL"
        :min="0"
        :max="50"
        :step="1"
        @change="(v) => emitChange({ CURL: v })"
      />

      <!-- Splat 半径 -->
      <SliderRow
        label="Splat 半径"
        :value="config.SPLAT_RADIUS"
        :min="0.0001"
        :max="0.01"
        :step="0.0001"
        @change="(v) => emitChange({ SPLAT_RADIUS: v })"
      />

      <!-- 开关行 -->
      <div class="grid grid-cols-3 gap-2 pt-1">
        <ToggleRow label="着色" :value="config.SHADING" @change="(v) => emitChange({ SHADING: v })" />
        <ToggleRow label="彩色" :value="config.COLORFUL" @change="(v) => emitChange({ COLORFUL: v })" />
        <ToggleRow label="暂停" :value="config.PAUSED" @change="(v) => emitChange({ PAUSED: v })" />
      </div>
    </div>

    <!-- Bloom 折叠组 -->
    <div class="collapse collapse-arrow bg-base-300/50">
      <input type="checkbox" checked />
      <div class="collapse-title text-xs font-semibold text-base-content">Bloom 后处理</div>
      <div class="collapse-content space-y-2">
        <ToggleRow label="启用 Bloom" :value="config.BLOOM" @change="(v) => emitChange({ BLOOM: v })" />
        <SliderRow
          label="强度"
          :value="config.BLOOM_INTENSITY"
          :min="0.1"
          :max="2.0"
          :step="0.01"
          @change="(v) => emitChange({ BLOOM_INTENSITY: v })"
        />
        <SliderRow
          label="阈值"
          :value="config.BLOOM_THRESHOLD"
          :min="0"
          :max="1"
          :step="0.01"
          @change="(v) => emitChange({ BLOOM_THRESHOLD: v })"
        />
      </div>
    </div>

    <!-- Sunrays 折叠组 -->
    <div class="collapse collapse-arrow bg-base-300/50">
      <input type="checkbox" checked />
      <div class="collapse-title text-xs font-semibold text-base-content">Sunrays 后处理</div>
      <div class="collapse-content space-y-2">
        <ToggleRow label="启用 Sunrays" :value="config.SUNRAYS" @change="(v) => emitChange({ SUNRAYS: v })" />
        <SliderRow
          label="权重"
          :value="config.SUNRAYS_WEIGHT"
          :min="0.3"
          :max="1.0"
          :step="0.01"
          @change="(v) => emitChange({ SUNRAYS_WEIGHT: v })"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-2 pt-1">
      <button class="btn btn-xs btn-primary flex-1" @click="$emit('sync-splat')">
        同步喷射
      </button>
      <button class="btn btn-xs btn-outline flex-1" @click="$emit('random-splat')">
        随机喷射
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FluidSimulationConfig } from "@/engine/fluid/FluidConfig";
import SliderRow from "./SliderRow.vue";
import ToggleRow from "./ToggleRow.vue";

const props = defineProps<{
  config: FluidSimulationConfig;
}>();

const emit = defineEmits<{
  (e: "config-change", patch: Partial<FluidSimulationConfig>): void;
  (e: "sync-splat"): void;
  (e: "random-splat"): void;
}>();

function emitChange(patch: Partial<FluidSimulationConfig>): void {
  emit("config-change", patch);
}

// 避免 props 未使用的 lint 错误
void props;
</script>
