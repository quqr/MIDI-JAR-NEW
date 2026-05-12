<template>
  <div
    class="flex items-center h-6 px-2 select-none"
    :data-tauri-drag-region="!positionLocked"
    @dblclick="!positionLocked && $emit('toggleMaximize')"
    @contextmenu.prevent="showContextMenu = !showContextMenu"
  >
    <div
      class="flex items-center gap-1.5 flex-1 min-w-0"
      :data-tauri-drag-region="!positionLocked"
    >
      <Icon :name="iconName" class="w-3 h-3 flex-shrink-0 opacity-50" />
      <span class="text-[10px] font-medium truncate opacity-70">{{ title }}</span>
    </div>
    <div class="flex items-center flex-shrink-0">
      <button
        class="btn btn-ghost btn-xs w-5 h-5 p-0 min-h-0"
        :class="{ 'text-primary': alwaysOnTop }"
        @click.stop="$emit('toggleAlwaysOnTop')"
        title="Always on top"
      >
        <Icon name="pin" class="w-2.5 h-2.5" />
      </button>
      <button
        class="btn btn-ghost btn-xs w-5 h-5 p-0 min-h-0"
        @click.stop="$emit('minimize')"
        title="Minimize"
      >
        <Icon name="minimize" class="w-2.5 h-2.5" />
      </button>
      <button
        class="btn btn-ghost btn-xs w-5 h-5 p-0 min-h-0"
        @click.stop="$emit('toggleMaximize')"
        title="Maximize"
      >
        <Icon :name="isMaximized ? 'unmaximize' : 'maximize'" class="w-2.5 h-2.5" />
      </button>
      <button
        class="btn btn-ghost btn-xs w-5 h-5 p-0 min-h-0 hover:bg-error hover:text-error-content"
        @click.stop="$emit('close')"
        title="Close"
      >
        <Icon name="x" class="w-2.5 h-2.5" />
      </button>
    </div>
  </div>
  <div
    v-if="showContextMenu"
    class="absolute right-2 top-6 z-50 bg-base-200 rounded-md shadow-lg py-1 min-w-[140px] text-xs"
    @click.stop
  >
    <label class="flex items-center gap-2 px-3 py-1.5 hover:bg-base-300 cursor-pointer">
      <span class="flex-1">Opacity</span>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        :value="opacity"
        class="range range-xs range-primary w-16 h-2"
        @input="$emit('changeOpacity', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </label>
    <button
      class="flex items-center gap-2 px-3 py-1.5 hover:bg-base-300 w-full text-left"
      :class="{ 'text-primary': autoHide }"
      @click="$emit('toggleAutoHide')"
    >
      <Icon name="eye" class="w-3 h-3" />
      <span>Auto Hide</span>
    </button>
    <button
      class="flex items-center gap-2 px-3 py-1.5 hover:bg-base-300 w-full text-left"
      :class="{ 'text-primary': positionLocked }"
      @click="$emit('toggleLock')"
    >
      <Icon :name="positionLocked ? 'lock' : 'unlock'" class="w-3 h-3" />
      <span>Lock Position</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import Icon from "@/components/Icon/Icon.vue";
import type { WidgetType } from "@/types/widget";

const props = defineProps<{
  title: string;
  type: WidgetType;
  isMaximized: boolean;
  alwaysOnTop: boolean;
  autoHide: boolean;
  positionLocked: boolean;
  opacity: number;
}>();

defineEmits<{
  close: [];
  minimize: [];
  toggleMaximize: [];
  toggleAlwaysOnTop: [];
  toggleAutoHide: [];
  toggleLock: [];
  changeOpacity: [opacity: number];
}>();

const showContextMenu = ref(false);

function onClickOutside() {
  showContextMenu.value = false;
}

onMounted(() => {
  document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside);
});

const iconNameMap: Record<WidgetType, string> = {
  keyboard: "piano",
  notation: "music",
  chord: "music",
  intervals: "music",
};

const iconName = computed(() => iconNameMap[props.type] || "music");
</script>
