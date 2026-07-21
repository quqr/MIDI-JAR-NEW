<template>
  <div
    :id="id"
    ref="containerRef"
    class="notation-base w-full min-w-0 overflow-visible"
    :class="className"
    :style="containerStyle"
    role="img"
    :aria-label="t('notation.ariaLabel')"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { Renderer } from "vexflow";

import { formatSharpsFlats } from "@/helpers";
import { debounce } from "@/helpers/debounce";
import type { NotationProps } from "./types";
import {
  getTransposedNotes,
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "./utils";
import { getLayoutDimensions } from "./layout";
import { renderGrandStaff, renderSingleStaff } from "./renderer";

const props = withDefaults(defineProps<NotationProps>(), {
  id: undefined,
  className: undefined,
  midiNotes: () => [],
  staffClef: "both",
  staffTranspose: 0,
  display: undefined,
  layout: undefined,
  style: undefined,
});

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
let renderer: Renderer | null = null;
let resizeObserver: ResizeObserver | null = null;
let lastWidth = 0;

const display = computed(() => mergeDisplayConfig(props.display));
const layout = computed(() => mergeLayoutConfig(props.layout));
const style = computed(() => mergeStyleConfig(props.style));

const notes = computed(() =>
  getTransposedNotes(
    props.midiNotes ?? [],
    props.keySignature.notes,
    props.staffTranspose,
  ),
);

const keySignatureText = computed(() => {
  if (!display.value.keySignatureText) return undefined;
  return t("notation.key", {
    tonic: formatSharpsFlats(props.keySignature.tonic),
  });
});

const containerStyle = computed(() => ({
  backgroundColor: style.value.backgroundColor,
}));

function renderNotation() {
  if (!renderer || !containerRef.value) return;

  const width = containerRef.value.clientWidth;
  if (width === 0) return;

  // Width-driven only: use a large reference height so scaleY never constrains scale.
  // The SVG renders at its natural height and the container auto-sizes via overflow:visible.
  const dimensions = getLayoutDimensions(width, 9999, {
    staffClef: props.staffClef as "both" | "bass" | "treble",
    alteration: props.keySignature.alteration,
    layout: layout.value,
    display: display.value,
  });

  renderer.resize(dimensions.totalWidth, dimensions.totalHeight);

  const context = renderer.getContext();
  context.setFont("Arial", style.value.fontSize * dimensions.scale, "");
  context.clear();

  if (props.staffClef === "both") {
    renderGrandStaff({
      context,
      layout: dimensions,
      notes: notes.value,
      keySignatureTonic: props.keySignature.tonic,
      keySignatureText: keySignatureText.value,
      display: display.value,
      style: style.value,
    });
  } else if (props.staffClef === "bass" || props.staffClef === "treble") {
    renderSingleStaff({
      context,
      layout: dimensions,
      notes: notes.value,
      staffClef: props.staffClef,
      keySignatureTonic: props.keySignature.tonic,
      keySignatureText: keySignatureText.value,
      display: display.value,
      style: style.value,
    });
  }
}

function setupResizeObserver() {
  if (!containerRef.value || resizeObserver) return;

  const handleResize = (entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;
    const newWidth =
      entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
    // Only re-render on width change to break the height→resize→render loop
    if (Math.abs(newWidth - lastWidth) > 1) {
      lastWidth = newWidth;
      renderNotation();
    }
  };

  resizeObserver = new ResizeObserver(
    debounce(handleResize as (...args: unknown[]) => unknown, 80),
  );

  resizeObserver.observe(containerRef.value);
  lastWidth = containerRef.value.clientWidth;
}

onMounted(() => {
  if (containerRef.value) {
    renderer = new Renderer(
      containerRef.value as HTMLDivElement,
      Renderer.Backends.SVG,
    );
    setupResizeObserver();
    requestAnimationFrame(renderNotation);
  }
});

watch(
  [
    notes,
    () => props.staffClef,
    () => JSON.stringify(props.keySignature),
    display,
    layout,
    style,
  ],
  () => {
    requestAnimationFrame(renderNotation);
  },
);

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (renderer) {
    try {
      renderer.getContext().clear();
    } catch (e) {
      // ignore — renderer may already be disposed
    }
    renderer = null;
  }
});

let observer: MutationObserver;

function oklchToRgb(oklchString: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = oklchString;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

function updateNoteAndStaveColor() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-base-content")
    .trim();
  const color = oklchToRgb(raw);
  style.value.staffLineColor = color;
  style.value.noteColor = color;
}

onMounted(() => {
  // 初始化颜色并首次绘制
  updateNoteAndStaveColor();
  // 监听主题变化，重新获取颜色并重绘
  observer = new MutationObserver(() => {
    updateNoteAndStaveColor();
    renderNotation(); // 需要显式重绘
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>
