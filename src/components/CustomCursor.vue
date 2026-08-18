<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { createAnimatable } from "animejs";

const route = useRoute();
const settingsStore = useSettingsStore();
const innerPointer = ref<HTMLElement>();
const outerPointer = ref<HTMLElement>();

// anime.js 动画实例：用 JS 动画实现平滑跟随 / 悬停形变 / 点击脉冲。
// 不使用任何 CSS transition / @keyframes / <Transition>，与项目硬约束兼容。
// 类型为 anime.js 的 Animatable（动态属性 .x()/.y()/.scale()...），此处用 any 兼容。
let innerAnim: any = null;
let outerAnim: any = null;

let isHovering = false;
let halfElementWidth = 6;
let halfElementWidth2 = 21;
// RAF 节流：保存最新鼠标位置，每帧最多更新一次目标
let latestX = 0,
  latestY = 0;
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
  //".note",
].join(",");

function findInteractiveTarget(el: HTMLElement): HTMLElement | null {
  return el.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
}

// 将元素的 borderRadius 解析为像素值（兼容 px 与 %）
function resolveBorderRadiusPx(
  style: CSSStyleDeclaration,
  rect: DOMRect,
): number {
  const br = style.borderRadius;
  if (!br || br === "none") return Math.min(rect.width, rect.height) / 2;
  if (br.endsWith("%")) {
    const pct = parseFloat(br);
    return (pct / 100) * Math.min(rect.width, rect.height);
  }
  const px = parseFloat(br);
  return Number.isNaN(px) ? Math.min(rect.width, rect.height) / 2 : px;
}

function initAnimatables() {
  if (innerAnim || !innerPointer.value || !outerPointer.value) return;
  const oSize = cursorSettings.value.outerSize;
  innerAnim = createAnimatable(innerPointer.value, {
    x: 0,
    y: 0,
    scale: 1,
    unit: "px",
    duration: cursorSettings.value.followDuration,
    ease: "out(2)",
  });
  outerAnim = createAnimatable(outerPointer.value, {
    x: 0,
    y: 0,
    scale: 1,
    width: oSize,
    height: oSize,
    borderRadius: oSize / 2,
    unit: "px",
    duration: cursorSettings.value.hoverDuration,
    ease: "out(3)",
  });
}

function resetHoverState() {
  isHovering = false;
  isHoverState.value = false;
  hoveredRect.value = null;
  if (outerAnim) {
    outerAnim.width(halfElementWidth2 * 2);
    outerAnim.height(halfElementWidth2 * 2);
    outerAnim.borderRadius(halfElementWidth2);
  }
}

function setPosition(x: number, y: number) {
  if (!innerAnim || !outerAnim) return;
  innerAnim.x(x - halfElementWidth);
  innerAnim.y(y - halfElementWidth);
  // 悬停时外圈吸附到目标元素，不再跟随鼠标
  if (!isHovering) {
    outerAnim.x(x - halfElementWidth2);
    outerAnim.y(y - halfElementWidth2);
  }
}

const handleMouseMove = (e: MouseEvent) => {
  latestX = e.clientX;
  latestY = e.clientY;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      setPosition(latestX, latestY);
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

  // 外圈平滑过渡到目标元素轮廓
  if (outerAnim) {
    outerAnim.x(rect.left);
    outerAnim.y(rect.top);
    outerAnim.width(rect.width);
    outerAnim.height(rect.height);
    outerAnim.borderRadius(resolveBorderRadiusPx(style, rect));
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

// 点击脉冲：按下收缩、抬起回弹；收缩比例由 pulseScale 驱动
const handleMouseDown = () => {
  const p = cursorSettings.value.pulseScale;
  if (innerAnim) innerAnim.scale(p);
  if (outerAnim) outerAnim.scale(Math.min(0.95, p + 0.25));
};

const handleMouseUp = () => {
  if (innerAnim) innerAnim.scale(1);
  if (outerAnim) outerAnim.scale(1);
};

async function registerListeners() {
  if (window.matchMedia("(pointer:fine)").matches) {
    document.body.style.cursor = "none";
    // 等待 v-if 渲染出指针元素后再初始化动画实例
    await nextTick();
    initAnimatables();
    document.body.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("mouseout", handleMouseOut);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
  }
}

function unregisterListeners() {
  document.body.style.cursor = "default";
  document.body.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseover", handleMouseOver);
  window.removeEventListener("mouseout", handleMouseOut);
  window.removeEventListener("mousedown", handleMouseDown);
  window.removeEventListener("mouseup", handleMouseUp);
  if (innerAnim) {
    innerAnim.revert();
    innerAnim = null;
  }
  if (outerAnim) {
    outerAnim.revert();
    outerAnim = null;
  }
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
      halfElementWidth = cursorSettings.value.innerSize / 2;
      halfElementWidth2 = cursorSettings.value.outerSize / 2;
      registerListeners();
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
    // 未悬停时实时套用新的圆点尺寸
    if (outerAnim && !isHovering) {
      outerAnim.width(halfElementWidth2 * 2);
      outerAnim.height(halfElementWidth2 * 2);
      outerAnim.borderRadius(halfElementWidth2);
    }
  },
);

// 动画时长变化：createAnimatable 的 duration 在创建时固定，需重建实例套用新值
watch(
  () => [cursorSettings.value.followDuration, cursorSettings.value.hoverDuration],
  () => {
    if (innerAnim) {
      innerAnim.revert();
      innerAnim = null;
    }
    if (outerAnim) {
      outerAnim.revert();
      outerAnim = null;
    }
    nextTick().then(() => initAnimatables());
  },
);

// 内圈：尺寸/颜色由设置驱动（位移与缩放交给 anime.js）
const innerPointerStyle = computed(() => {
  const s = cursorSettings.value;
  return {
    width: `${s.innerSize}px`,
    height: `${s.innerSize}px`,
    backgroundColor: resolveColor(s.innerColorSource, s.innerColor),
    mixBlendMode: s.blendMode,
  };
});

// 外圈：颜色/混合/阴影由设置驱动（位移、尺寸、圆角、缩放交给 anime.js）
const outerPointerStyle = computed(() => {
  const s = cursorSettings.value;
  const hover = hoveredRect.value;
  const isHover =
    isHoverState.value && hover !== null && s.hoverMode !== "none";

  if (isHover) {
    const isCover = s.hoverMode === "cover";
    return {
      backgroundColor: isCover
        ? resolveColor(s.outerColorSource, s.outerColor)
        : "transparent",
      mixBlendMode: s.blendMode,
      boxShadow: isCover
        ? "none"
        : `inset 0 0 0 2px ${resolveColor(s.hoverRingColorSource, s.hoverRingColor)}`,
    };
  }

  return {
    backgroundColor: resolveColor(s.outerColorSource, s.outerColor),
    mixBlendMode: s.blendMode,
    boxShadow: "none",
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
      class="fixed top-0 left-0 rounded-full pointer-events-none z-cursor will-change-transform"
      :style="innerPointerStyle"
    />
    <div
      v-if="cursorSettings.enabled"
      ref="outerPointer"
      class="fixed top-0 left-0 pointer-events-none z-cursor will-change-transform"
      :style="outerPointerStyle"
    />
  </Teleport>
</template>
