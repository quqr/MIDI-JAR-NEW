/* ============================================================
 * motion-v 预设层 — 全局动效单一真相源
 *
 *
 *   - 缓动：standard [0.2,0.8,0.2,1] / emphasized [0.3,0,0,1] / exit [0.4,0,1,1]
 *   - 时长：instant 0.08 / fast 0.15 / normal 0.22 / slow 0.32（秒）
 *   - 弹簧：soft（卡片微交互）/ gentle（面板/抽屉/模态）/ snappy（按压）
 *
 * 所有 Motion* 组件与视图动效应通过 useMotionPresets().resolve() 使用预设，
 * 以便在 prefers-reduced-motion 时自动降级为仅 opacity 瞬时过渡。
 * ============================================================ */

import { useReducedMotion } from "motion-v";
import type { Transition } from "motion-v";

/** cubic-bezier 控制点（4 元组） */
export type Bezier = [number, number, number, number];

export const EASE: { standard: Bezier; emphasized: Bezier; exit: Bezier } = {
  standard: [0.2, 0.8, 0.2, 1],
  emphasized: [0.3, 0, 0, 1],
  exit: [0.4, 0, 1, 1],
};

/** 时长（秒），对齐 HIG duration token */
export const DURATION = {
  instant: 0.08,
  fast: 0.15,
  normal: 0.22,
  slow: 0.32,
} as const;

/** 弹簧预设 */
export const spring = {
  /** 卡片悬停 / 微交互 */
  soft: { type: "spring", stiffness: 300, damping: 26 } as const,
  /** 面板 / 抽屉 / 模态 */
  gentle: { type: "spring", stiffness: 200, damping: 24 } as const,
  /** 按压反馈 */
  snappy: { type: "spring", stiffness: 500, damping: 30 } as const,
};

/** 时长式过渡（路由转场、面板切换等） */
export const transition: Record<string, Transition> = {
  micro: { duration: DURATION.instant, ease: EASE.standard },
  fast: { duration: DURATION.fast, ease: EASE.standard },
  panel: { duration: DURATION.fast, ease: EASE.standard },
  page: { duration: DURATION.fast, ease: EASE.standard },
  exit: { duration: DURATION.fast, ease: EASE.exit },
};

/** 动画目标状态（opacity / x / y / scale / width 等数值或百分比字符串） */
export type MotionTarget = Record<string, number | string>;

/** 预设：initial / animate / exit + transition */
export interface MotionPreset {
  initial?: MotionTarget;
  animate?: MotionTarget;
  exit?: MotionTarget;
  transition?: Transition;
}

/* ------------------------------------------------------------
 * 路由 / 页面转场
 * ------------------------------------------------------------ */

/** 路由淡入淡出（配合 AnimatePresence mode="wait"）
 * 纯 opacity 交叉淡入——去除 y 位移抖动，转场更平稳 */
export const pageFade: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transition.page,
};

/** 方向式页面滑动（direction: 1 前进 / -1 后退） */
export function pageSlide(direction: 1 | -1 = 1): MotionPreset {
  return {
    initial: { opacity: 0, x: 24 * direction },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 * direction },
    transition: transition.page,
  };
}

/* ------------------------------------------------------------
 * 抽屉 / 侧栏
 * ------------------------------------------------------------ */

/** 右侧抽屉滑入 */
export const drawerRight: MotionPreset = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
  transition: transition.panel,
};

/** 左侧抽屉滑入 */
export const drawerLeft: MotionPreset = {
  initial: { x: "-100%" },
  animate: { x: 0 },
  exit: { x: "-100%" },
  transition: transition.panel,
};

/** 侧栏折叠（宽度动画，替代硬编码 width 动画） */
export const sidebarCollapse: MotionPreset = {
  initial: { width: 0, opacity: 0 },
  animate: { width: 240, opacity: 1 },
  exit: { width: 0, opacity: 0 },
  transition: transition.panel,
};

/* ------------------------------------------------------------
 * 模态 / 遮罩
 * ------------------------------------------------------------ */

/** 模态弹窗缩放入场 */
export const modal: MotionPreset = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: spring.gentle,
};

/** 遮罩淡入（抽屉/模态背景层） */
export const overlayFade: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transition.fast,
};

/* ------------------------------------------------------------
 * 卡片微交互
 * ------------------------------------------------------------ */

/** 卡片悬停 / 按压微交互 */
export const cardHover = {
  whileHover: { y: -4 },
  whilePress: { scale: 0.98 },
  transition: spring.soft,
};

/* ------------------------------------------------------------
 * Stagger 列表（orchestration）
 * ------------------------------------------------------------ */

/** stagger 容器：子项依次入场 */
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren" as const,
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

/** stagger 子项 */
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/* ------------------------------------------------------------
 * reduced-motion 适配
 * ------------------------------------------------------------ */

/**
 * 封装 useReducedMotion()，提供 resolve() 将预设降级为仅 opacity 瞬时过渡。
 * 在 prefers-reduced-motion 启用时，移除位移/缩放/宽度等 transform 动画，
 * 仅保留 opacity 且 duration 为 0，符合无障碍要求。
 */
export function useMotionPresets() {
  const reduced = useReducedMotion();

  function degrade(state: MotionTarget | undefined): MotionTarget | undefined {
    if (!state) return state;
    const out: MotionTarget = {};
    if ("opacity" in state && typeof state.opacity === "number") {
      out.opacity = state.opacity;
    }
    return out;
  }

  function resolve(preset: MotionPreset): MotionPreset {
    if (!reduced.value) return preset;
    return {
      ...preset,
      initial: degrade(preset.initial),
      animate: degrade(preset.animate),
      exit: degrade(preset.exit),
      transition: { duration: 0 },
    };
  }

  return { reduced, resolve };
}
