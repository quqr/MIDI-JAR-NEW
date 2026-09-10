<script setup lang="ts">
/**
 * 和弦输入浮层：把 `ChordInputPanel` 定位到指定和弦的屏幕位置。
 *
 * 用 Teleport 到 body 避免被谱面的 `overflow-x-auto` 裁切；
 * 定位采用「锚点矩形 + 视口夹取」，与项目 ColorPicker 的浮层策略一致。
 * z-index 用 `z-popover`（55）——谱面本身可能在抽屉（z-50）内部，
 * `z-dropdown`（40）会被盖住。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import ChordInputPanel from "./ChordInputPanel.vue";

import type { ChordUnit } from "../domain/types";

const props = defineProps<{
  /** 锚点元素的视口矩形；null = 不显示 */
  anchorRect: DOMRect | null;
  /** 编辑中的和弦 */
  modelValue: ChordUnit | null;
  /** 当前调主音 */
  tonic?: string;
}>();

const emit = defineEmits<{
  (e: "confirm", unit: ChordUnit): void;
  (e: "cancel"): void;
  (e: "delete"): void;
}>();

const panelRef = ref<InstanceType<typeof ChordInputPanel> | null>(null);
const panelEl = ref<HTMLElement | null>(null);

/** 面板尺寸（用于夹取；首帧未知时用保守估计） */
const panelSize = ref({ width: 320, height: 380 });

/** 计算后的定位样式 */
const style = computed(() => {
  const rect = props.anchorRect;
  if (!rect) return { display: "none" };

  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { width, height } = panelSize.value;

  // 水平：优先左对齐锚点，右侧放不下则右对齐
  let left = rect.left;
  if (left + width + margin > vw) left = Math.max(margin, vw - width - margin);

  // 垂直：优先下方，放不下则上方
  let top = rect.bottom + 4;
  if (top + height + margin > vh) {
    top = Math.max(margin, rect.top - height - 4);
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

/** 测量真实尺寸（面板内容随分组切换变化） */
async function measure(): Promise<void> {
  await nextTick();
  const el = panelEl.value;
  if (!el) return;
  panelSize.value = {
    width: el.offsetWidth || 320,
    height: el.offsetHeight || 380,
  };
}

watch(() => props.anchorRect, measure);
watch(() => props.modelValue, measure);

function onDocumentPointerDown(event: PointerEvent): void {
  const el = panelEl.value;
  const target = event.target as Node | null;
  if (el && target && !el.contains(target)) {
    emit("cancel");
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") emit("cancel");
}

onMounted(() => {
  measure();
  // 捕获阶段监听，保证先于内部点击处理判断「点在外面」
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onKeydown);
  nextTick(() => panelRef.value?.focusInput());
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="anchorRect" ref="panelEl" class="fixed z-popover" :style="style">
      <ChordInputPanel
        ref="panelRef"
        :model-value="modelValue"
        :tonic="tonic"
        @confirm="(u) => emit('confirm', u)"
        @cancel="emit('cancel')"
        @delete="emit('delete')"
      />
    </div>
  </Teleport>
</template>
