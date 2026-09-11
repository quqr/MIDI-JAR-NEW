import { watch } from "vue";
import type { Directive } from "vue";
import { animate } from "animejs";
import { useSettingsStore } from "@/stores/settings";
import type { MagicSettings } from "@/types";

/**
 * v-magic —— MagicBento 风格鼠标特效指令。
 *
 * 在卡片 / 折叠根元素上添加 `v-magic`，按全局设置（settings.magic）提供：
 * - CSS 变量驱动的边框辉光（纯 CSS，见 styles/magic.css）
 * - 3D 倾斜（tilt）/ 磁性吸附（magnetism），anime.js v4 驱动
 * - 点击涟漪（clickEffect）
 *
 * 约定：
 * - 嵌套防重入：若祖先已有 [data-magic] 则跳过（父级特效已覆盖）。
 * - 事件始终绑定，开关变化只影响内部守卫标志，避免反复 add/removeEventListener。
 * - ≤768px 或无 hover 设备（触屏）自动跳过悬停类特效，点击涟漪保留。
 * - 颜色以 hex 存储，运行时转 "r,g,b" 通道串写入 --glow-color，
 *   CSS 侧统一以 rgba(var(--glow-color), a) 消费。
 */

const NARROW_MEDIA = "(max-width: 768px)";
const HOVER_NONE_MEDIA = "(hover: none)";
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

const DEFAULT_RGB = "132,0,255";

/** hex（#8400FF / #fff）→ "r,g,b" 通道串；解析失败回落到默认紫 */
export function hexToRgbChannels(hex: string): string {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = Number.parseInt(value, 16);
  if (Number.isNaN(num) || value.length !== 6) return DEFAULT_RGB;
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

interface MagicElementState {
  settingsStore: ReturnType<typeof useSettingsStore>;
  stopWatch: () => void;
  listeners: Array<[string, EventListener]>;
  animations: Set<ReturnType<typeof animate>>;
  ripples: Set<HTMLElement>;
  /** 当前是否有 tilt / 磁性偏移在生效（用于开关关闭或离开时归零） */
  transformActive: boolean;
}

const states = new WeakMap<HTMLElement, MagicElementState>();

// MediaQueryList 缓存（matches 动态求值，无需重复创建）
let narrowMql: MediaQueryList | null = null;
let hoverNoneMql: MediaQueryList | null = null;
let reducedMql: MediaQueryList | null = null;

function getNarrowMql(): MediaQueryList {
  return (narrowMql ??= window.matchMedia(NARROW_MEDIA));
}
function getHoverNoneMql(): MediaQueryList {
  return (hoverNoneMql ??= window.matchMedia(HOVER_NONE_MEDIA));
}
function getReducedMql(): MediaQueryList {
  return (reducedMql ??= window.matchMedia(REDUCED_MOTION_MEDIA));
}

/** 悬停类特效（tilt / 磁性 / 涟漪之外的光标跟随）是否允许 */
function hoverEffectsAllowed(magic: MagicSettings): boolean {
  return (
    magic.enabled &&
    !getNarrowMql().matches &&
    !getHoverNoneMql().matches &&
    !getReducedMql().matches
  );
}

/** 添加带自动回收的动画（onComplete 后从 Set 移除，避免集合无限增长） */
function runAnimation(
  state: MagicElementState,
  target: HTMLElement,
  params: Parameters<typeof animate>[1],
): void {
  const anim = animate(target, {
    ...params,
    onComplete: (self) => {
      state.animations.delete(self);
    },
  });
  state.animations.add(anim);
}

/** 归零 tilt / 磁性变换 */
function resetTransform(state: MagicElementState, el: HTMLElement): void {
  if (!state.transformActive) return;
  state.transformActive = false;
  runAnimation(state, el, {
    rotateX: 0,
    rotateY: 0,
    x: 0,
    y: 0,
    duration: 300,
    ease: "out(2)",
  });
}

function onMouseEnter(el: HTMLElement, state: MagicElementState): void {
  const magic = state.settingsStore.settings.magic;
  if (!hoverEffectsAllowed(magic)) return;
  // 入场即点亮辉光，等聚光灯 / 后续 mousemove 接管坐标
  el.style.setProperty("--glow-intensity", "1");
  state.transformActive = true;
  // 参考实现：入场静态倾斜 rotateX/Y 5°（0.3s power2.out）。
  // 入场角度按 tiltMaxAngle 的一半缩放，默认 10° → 5°，保持原观感且随设置联动。
  if (magic.tilt) {
    const entryAngle = magic.tiltMaxAngle * 0.5;
    runAnimation(state, el, {
      perspective: 1000,
      rotateX: entryAngle,
      rotateY: entryAngle,
      duration: 300,
      ease: "out(2)",
    });
  }
}

function onMouseMove(
  el: HTMLElement,
  state: MagicElementState,
  event: Event,
): void {
  const magic = state.settingsStore.settings.magic;
  if (!hoverEffectsAllowed(magic)) return;
  const e = event as MouseEvent;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // 参考实现：坐标以卡片百分比写入（updateCardGlowProperties）
  el.style.setProperty("--glow-x", `${((x / rect.width) * 100).toFixed(2)}%`);
  el.style.setProperty("--glow-y", `${((y / rect.height) * 100).toFixed(2)}%`);
  el.style.setProperty("--glow-intensity", "1");

  // 参考实现：rotateX = ((y-cy)/cy)*-10，rotateY = ((x-cx)/cx)*10，0.1s power2.out
  // 角度上限经 tiltMaxAngle 控制（默认 10°），0 即关闭倾斜效果。
  if (magic.tilt) {
    const rotateX = ((y - centerY) / centerY) * -magic.tiltMaxAngle;
    const rotateY = ((x - centerX) / centerX) * magic.tiltMaxAngle;
    runAnimation(state, el, {
      perspective: 1000,
      rotateX,
      rotateY,
      duration: 100,
      ease: "out(2)",
    });
    state.transformActive = true;
  }

  // 参考实现：磁性 = 偏移量 × 0.05，0.3s power2.out
  if (magic.magnetism) {
    runAnimation(state, el, {
      x: (x - centerX) * magic.magnetismStrength,
      y: (y - centerY) * magic.magnetismStrength,
      duration: 300,
      ease: "out(2)",
    });
    state.transformActive = true;
  }
}

function onMouseLeave(el: HTMLElement, state: MagicElementState): void {
  const magic = state.settingsStore.settings.magic;
  if (!magic.enabled) return;
  el.style.setProperty("--glow-intensity", "0");
  if (hoverEffectsAllowed(magic)) {
    resetTransform(state, el);
  }
}

function onClick(
  el: HTMLElement,
  state: MagicElementState,
  event: Event,
): void {
  const magic = state.settingsStore.settings.magic;
  if (!magic.enabled || !magic.clickEffect) return;
  if (getReducedMql().matches) return;
  const e = event as MouseEvent;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 涟漪直径 = 点击点到四个角的最大距离 × rippleSize 倍率，保证覆盖整个卡片
  const size =
    magic.rippleSize *
    Math.max(
      Math.hypot(x, y),
      Math.hypot(rect.width - x, y),
      Math.hypot(x, rect.height - y),
      Math.hypot(rect.width - x, rect.height - y),
    );

  const ripple = document.createElement("span");
  ripple.className = "magic-ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;
  el.appendChild(ripple);
  state.ripples.add(ripple);

  const anim = animate(ripple, {
    scale: [0, 1],
    opacity: [1, 0],
    duration: magic.rippleDuration,
    ease: "out(2)",
    onComplete: (self) => {
      state.animations.delete(self);
      ripple.remove();
      state.ripples.delete(ripple);
    },
  });
  state.animations.add(anim);
}

/** 响应设置变化：同步颜色 / 辉光类名，关闭项立即归零副作用 */
function applySettings(el: HTMLElement, state: MagicElementState): void {
  const magic = state.settingsStore.settings.magic;
  el.style.setProperty("--glow-color", hexToRgbChannels(magic.glowColor));
  // 辉光强度系数经 CSS 变量传给 magic.css 渐变（边框辉光环 alpha 乘以它）
  el.style.setProperty("--glow-strength", magic.glowIntensity.toString());
  // 卡片高亮宽度（边框辉光环 padding 环宽）
  el.style.setProperty("--glow-ring-width", `${magic.glowWidth}px`);
  el.classList.toggle("magic--border-glow", magic.enabled && magic.borderGlow);
  if (!magic.enabled) {
    resetTransform(state, el);
    el.style.setProperty("--glow-intensity", "0");
    for (const ripple of state.ripples) ripple.remove();
    state.ripples.clear();
  } else if (!magic.tilt && !magic.magnetism) {
    resetTransform(state, el);
  }
}

export const vMagic: Directive<HTMLElement, void> = {
  mounted(el) {
    // 嵌套防重入：父级已带特效时交给父级
    if (el.closest("[data-magic]")) return;

    const settingsStore = useSettingsStore();
    const state: MagicElementState = {
      settingsStore,
      stopWatch: () => {},
      listeners: [],
      animations: new Set(),
      ripples: new Set(),
      transformActive: false,
    };
    states.set(el, state);

    el.dataset.magic = "";
    el.classList.add("magic-card");
    el.style.setProperty("--glow-radius", "300px");
    el.style.setProperty(
      "--glow-strength",
      settingsStore.settings.magic.glowIntensity.toString(),
    );

    const listeners: MagicElementState["listeners"] = [
      ["mouseenter", () => onMouseEnter(el, state)],
      ["mousemove", (e) => onMouseMove(el, state, e)],
      ["mouseleave", () => onMouseLeave(el, state)],
      ["click", (e) => onClick(el, state, e)],
    ];
    state.listeners = listeners;
    for (const [type, handler] of listeners) {
      el.addEventListener(type, handler);
    }

    state.stopWatch = watch(
      () => settingsStore.settings.magic,
      () => applySettings(el, state),
      { deep: true, immediate: true },
    );
  },

  unmounted(el) {
    const state = states.get(el);
    if (!state) return;
    states.delete(el);
    state.stopWatch();
    for (const [type, handler] of state.listeners) {
      el.removeEventListener(type, handler);
    }
    for (const anim of state.animations) anim.pause();
    state.animations.clear();
    for (const ripple of state.ripples) ripple.remove();
    state.ripples.clear();
    el.classList.remove("magic-card", "magic--border-glow");
    delete el.dataset.magic;
  },
};
