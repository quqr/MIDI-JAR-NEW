<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const innerPointer = ref<HTMLElement>();
const outerPointer = ref<HTMLElement>();

let isHovering = false;
let halfElementWidth = 6;
let halfElementWidth2 = 21;

const isHoverState = ref(false);

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "summary",
  '[role="button"]',
  '[role="link"]',
  ".btn",
  ".toggle",
  ".swap",
  ".drawer-toggle",
  ".vue-flow__node",
  ".vue-flow__edge",
].join(",");

function findInteractiveTarget(el: HTMLElement): HTMLElement | null {
  return el.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
}

function getVueFlowZoom(target: HTMLElement): number {
  const flowEl = target.closest(".vue-flow");
  if (!flowEl) return 1;

  const viewport = flowEl.querySelector(".vue-flow__viewport");
  if (!viewport) return 1;

  const style = window.getComputedStyle(viewport);
  const transform = style.transform;
  if (transform && transform !== "none") {
    const match = transform.match(/matrix\(([^)]+)\)/);
    if (match) {
      const values = match[1].split(",").map(Number);
      return values[0];
    }
  }
  return 1;
}

function resetHoverState() {
  isHovering = false;
  isHoverState.value = false;

  if (outerPointer.value) {
    outerPointer.value.style.removeProperty("width");
    outerPointer.value.style.removeProperty("height");
    outerPointer.value.style.removeProperty("border-radius");
  }
}

function setPosition(x: number, y: number, zoom: number = 1) {
  if (innerPointer.value) {
    innerPointer.value.style.transform = `translate(${x - halfElementWidth}px, ${y - halfElementWidth}px) scale(${zoom})`;
  }

  if (!isHovering && outerPointer.value) {
    outerPointer.value.style.transform = `translate(${x - halfElementWidth2}px, ${y - halfElementWidth2}px) scale(${zoom})`;
  }
}

const handleMouseMove = (e: MouseEvent) => {
  const zoom = getVueFlowZoom(e.target as HTMLElement);
  requestAnimationFrame(() => {
    setPosition(e.clientX, e.clientY, zoom);
  });
};

const handleMouseOver = (event: MouseEvent) => {
  const target = findInteractiveTarget(event.target as HTMLElement);

  if (target) {
    isHovering = true;
    isHoverState.value = true;

    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);

    if (outerPointer.value) {
      outerPointer.value.style.width = `${rect.width}px`;
      outerPointer.value.style.height = `${rect.height}px`;
      outerPointer.value.style.borderRadius = style.borderRadius;
      outerPointer.value.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    }
  }
};

const handleMouseOut = (event: MouseEvent) => {
  const target = findInteractiveTarget(event.target as HTMLElement);
  const relatedTarget =
    event.relatedTarget instanceof HTMLElement
      ? findInteractiveTarget(event.relatedTarget)
      : null;

  if (target && target !== relatedTarget) {
    resetHoverState();
  }
};

watch(
  () => route.path,
  () => {
    resetHoverState();
  },
);

onMounted(async () => {
  await nextTick();

  if (innerPointer.value) {
    halfElementWidth = innerPointer.value.offsetWidth / 2;
  }
  if (outerPointer.value) {
    halfElementWidth2 = outerPointer.value.offsetWidth / 2;
  }

  if (window.matchMedia("(pointer:fine)").matches) {
    document.body.style.cursor = "none";
    document.body.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("mouseout", handleMouseOut);
  }
});

onUnmounted(() => {
  document.body.style.cursor = "default";
  document.body.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseover", handleMouseOver);
  window.removeEventListener("mouseout", handleMouseOut);
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="innerPointer"
      class="fixed top-0 left-0 w-3 h-3 rounded-full bg-primary pointer-events-none z-[99999] [mix-blend-mode:exclusion] will-change-transform"
    />
    <div
      ref="outerPointer"
      class="cursor-outer fixed top-0 left-0 w-[42px] h-[42px] rounded-full pointer-events-none z-[99999] [mix-blend-mode:exclusion] will-change-transform"
      :class="{
        'bg-transparent ring-2 ring-primary': isHoverState,
        'bg-white': !isHoverState,
      }"
    />
  </Teleport>
</template>

<style>
.cursor-outer {
  transition:
    width 0.1s ease-out,
    height 0.1s ease-out,
    
    transform 0.1s ease-out,
    background-color 0.1s ease-out,
    box-shadow 0.1s ease-out;
}
</style>
