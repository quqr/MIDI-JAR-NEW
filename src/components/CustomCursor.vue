<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { useSettingsStore } from "@/stores/settings";

const route = useRoute();
const settingsStore = useSettingsStore();
const innerPointer = ref<HTMLElement>();
const outerPointer = ref<HTMLElement>();

let isHovering = false;
let halfElementWidth = 6;
let halfElementWidth2 = 21;
// RAF 节流：保存最新鼠标位置，每帧最多更新一次
let latestX = 0,
  latestY = 0,
  latestTarget: HTMLElement | null = null;
let rafPending = false;

const isHoverState = ref(false);

const hoveredRect = ref<{
  width: number;
  height: number;
  left: number;
  top: number;
  borderRadius: string;
} | null>(null);

const cursorSettings = computed(() => settingsStore.settings.cursor);

function resolveColor(source: "custom" | "theme", value: string): string {
  if (source === "theme") {
    return `var(--color-${value})`;
  }
  return value;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "li",
  "summary",
  '[role="button"]',
  '[role="link"]',
  ".btn",
  ".toggle",
  ".swap",
  ".drawer-toggle",
  ".vue-flow__node",
  ".wire-delete-btn",
  ".cursor-interactive",
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
  hoveredRect.value = null;
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
  // 保存最新鼠标位置，每帧最多更新一次指针位置
  latestX = e.clientX;
  latestY = e.clientY;
  latestTarget = e.target as HTMLElement;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      const zoom = getVueFlowZoom(latestTarget!);
      setPosition(latestX, latestY, zoom);
      rafPending = false;
    });
  }
};

const handleMouseOver = (event: MouseEvent) => {
  const target = findInteractiveTarget(event.target as HTMLElement);
  if (!target) return;

  const mode = cursorSettings.value.hoverMode;
  if (mode === "none") return;

  isHovering = true;
  isHoverState.value = true;

  const rect = target.getBoundingClientRect();
  const style = window.getComputedStyle(target);

  hoveredRect.value = {
    width: rect.width,
    height: rect.height,
    left: rect.left,
    top: rect.top,
    borderRadius: style.borderRadius,
  };

  if (outerPointer.value) {
    outerPointer.value.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
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

function registerListeners() {
  if (window.matchMedia("(pointer:fine)").matches) {
    document.body.style.cursor = "none";
    document.body.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("mouseout", handleMouseOut);
  }
}

function unregisterListeners() {
  document.body.style.cursor = "default";
  document.body.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseover", handleMouseOver);
  window.removeEventListener("mouseout", handleMouseOut);
}

watch(
  () => route.path,
  () => {
    resetHoverState();
  },
);

watch(
  () => cursorSettings.value.enabled,
  (enabled) => {
    if (enabled) {
      registerListeners();
      halfElementWidth = cursorSettings.value.innerSize / 2;
      halfElementWidth2 = cursorSettings.value.outerSize / 2;
    } else {
      unregisterListeners();
      resetHoverState();
    }
  },
);

watch(
  () => [cursorSettings.value.innerSize, cursorSettings.value.outerSize],
  () => {
    halfElementWidth = cursorSettings.value.innerSize / 2;
    halfElementWidth2 = cursorSettings.value.outerSize / 2;
  },
);

const transitionStyle = computed(
  () =>
    `width ${cursorSettings.value.transitionDuration}ms ease-out, height ${cursorSettings.value.transitionDuration}ms ease-out, transform ${cursorSettings.value.transitionDuration}ms ease-out, background-color ${cursorSettings.value.transitionDuration}ms ease-out, box-shadow ${cursorSettings.value.transitionDuration}ms ease-out, border-radius ${cursorSettings.value.transitionDuration}ms ease-out`,
);

const innerPointerStyle = computed(() => {
  const s = cursorSettings.value;
  return {
    width: `${s.innerSize}px`,
    height: `${s.innerSize}px`,
    backgroundColor: resolveColor(s.innerColorSource, s.innerColor),
    mixBlendMode: s.blendMode,
  };
});

const outerPointerStyle = computed(() => {
  const s = cursorSettings.value;
  const hover = hoveredRect.value;
  const isHover =
    isHoverState.value && hover !== null && s.hoverMode !== "none";

  if (isHover) {
    const isCover = s.hoverMode === "cover";
    return {
      width: `${hover.width}px`,
      height: `${hover.height}px`,
      borderRadius: hover.borderRadius || "50%",
      backgroundColor: isCover
        ? resolveColor(s.outerColorSource, s.outerColor)
        : "transparent",
      mixBlendMode: s.blendMode,
      boxShadow: isCover
        ? "none"
        : `inset 0 0 0 2px ${resolveColor(s.hoverRingColorSource, s.hoverRingColor)}`,
      transition: transitionStyle.value,
    };
  }

  return {
    width: `${s.outerSize}px`,
    height: `${s.outerSize}px`,
    borderRadius: "50%",
    backgroundColor: resolveColor(s.outerColorSource, s.outerColor),
    mixBlendMode: s.blendMode,
    boxShadow: "none",
    transition: transitionStyle.value,
  };
});

onMounted(async () => {
  halfElementWidth = cursorSettings.value.innerSize / 2;
  halfElementWidth2 = cursorSettings.value.outerSize / 2;

  if (cursorSettings.value.enabled) {
    registerListeners();
  }
});

onUnmounted(() => {
  unregisterListeners();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="cursorSettings.enabled"
      ref="innerPointer"
      class="fixed top-0 left-0 rounded-full pointer-events-none z-[99999] will-change-transform"
      :style="innerPointerStyle"
    />
    <div
      v-if="cursorSettings.enabled"
      ref="outerPointer"
      class="fixed top-0 left-0 pointer-events-none z-[9999] will-change-transform"
      :style="outerPointerStyle"
    />
  </Teleport>
</template>
