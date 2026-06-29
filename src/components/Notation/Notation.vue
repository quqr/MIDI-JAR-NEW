<template>
  <div
    :id="id"
    ref="containerRef"
    class="notation-base w-full min-w-0 overflow-visible"
    :class="className"
    :style="containerStyle"
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

  resizeObserver = new ResizeObserver(
    debounce((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const newWidth =
        entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
      // Only re-render on width change to break the height→resize→render loop
      if (Math.abs(newWidth - lastWidth) > 1) {
        lastWidth = newWidth;
        renderNotation();
      }
    }, 80),
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
    } catch (e) {}
    renderer = null;
  }
});
</script>
