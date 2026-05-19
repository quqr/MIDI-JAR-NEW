<template>
  <div
    class="flex items-center h-7 px-2 select-none border-b border-base-200 widget-titlebar"
    data-tauri-drag-region
    @dblclick="$emit('toggleMaximize')"
  >
    <div class="flex items-center gap-1.5 flex-1 min-w-0" data-tauri-drag-region>
      <Icon :name="iconName" class="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
      <span class="text-xs font-medium truncate opacity-80">{{ title }}</span>
    </div>
    <div class="flex items-center gap-0.5 flex-shrink-0">
      <div v-if="showOpacity" class="flex items-center gap-1 mr-1 opacity-slider">
        <button
          class="btn btn-ghost btn-xs w-5 h-5 p-0 min-h-0"
          :class="{ 'text-primary': transparentMode }"
          @click.stop="$emit('toggleTransparentMode')"
          :title="transparentMode ? '内容淡出模式' : '背景透明模式'"
        >
          <Icon :name="transparentMode ? 'visible' : 'layers'" class="w-2.5 h-2.5" />
        </button>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          :value="opacity"
          class="range range-xs range-primary w-14 h-3"
          @input="$emit('changeOpacity', parseFloat(($event.target as HTMLInputElement).value))"
          @mousedown.stop
          @click.stop
        />
      </div>
      <button
        v-if="showPin"
        class="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0"
        :class="{ 'text-primary': alwaysOnTop }"
        @click.stop="$emit('toggleAlwaysOnTop')"
        title="置顶"
      >
        <Icon name="pin" class="w-3 h-3" />
      </button>
      <button
        v-if="showLock"
        class="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0"
        :class="{ 'text-primary': positionLocked }"
        @click.stop="$emit('toggleLock')"
        :title="positionLocked ? '解锁位置' : '锁定位置'"
      >
        <Icon :name="positionLocked ? 'lock' : 'unlock'" class="w-3 h-3" />
      </button>
      <button
        class="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0"
        @click.stop="$emit('minimize')"
        title="最小化"
      >
        <Icon name="minimize" class="w-3 h-3" />
      </button>
      <button
        class="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0"
        @click.stop="$emit('toggleMaximize')"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <Icon :name="isMaximized ? 'unmaximize' : 'maximize'" class="w-3 h-3" />
      </button>
      <button
        class="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 hover:bg-error hover:text-error-content"
        @click.stop="$emit('close')"
        title="关闭"
      >
        <Icon name="x" class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Icon, { type IconName } from "@/components/Icon/Icon.vue";
import type { WidgetType } from "@/types/widget";

const props = defineProps<{
  title: string;
  type: WidgetType;
  isMaximized: boolean;
  alwaysOnTop: boolean;
  autoHide: boolean;
  positionLocked: boolean;
  opacity: number;
  transparentMode: boolean;
  showPin?: boolean;
  showAutoHide?: boolean;
  showLock?: boolean;
  showOpacity?: boolean;
}>();

defineEmits<{
  close: [];
  minimize: [];
  toggleMaximize: [];
  toggleAlwaysOnTop: [];
  toggleAutoHide: [];
  toggleLock: [];
  changeOpacity: [opacity: number];
  toggleTransparentMode: [];
}>();

const iconNameMap: Record<WidgetType, IconName> = {
  keyboard: "piano",
  notation: "music",
  chord: "music",
  intervals: "music",
};

const iconName = computed(() => iconNameMap[props.type] || "music");
</script>