import type { MotionPreset } from "@/utils/motion";

export interface MotionPageTransitionProps {
  /** 转场预设，默认 pageFade */
  variant?: MotionPreset;
  /** AnimatePresence 子元素 key，默认取当前路由路径 */
  routeKey?: string;
}

export interface MotionDrawerProps {
  isOpen: boolean;
  /** 抽屉滑出方向 */
  side?: "left" | "right";
  /** 抽屉宽度（px） */
  width?: number;
}

export interface MotionModalProps {
  isOpen: boolean;
  /** 点击遮罩是否关闭，默认 true */
  closeOnOverlay?: boolean;
}

export interface MotionStaggerListProps {
  /** 仅在应用首次加载时播放入场动画，路由返回不重复触发 */
  once?: boolean;
  /** once 模式下的唯一标识，用于区分不同 stagger 组，默认 "default" */
  onceKey?: string;
}

export interface MotionListItemProps {
  /** 同上 */
}

export { default as MotionPageTransition } from "./MotionPageTransition.vue";
export { default as MotionDrawer } from "./MotionDrawer.vue";
export { default as MotionModal } from "./MotionModal.vue";
export { default as MotionStaggerList } from "./MotionStaggerList.vue";
export { default as MotionListItem } from "./MotionListItem.vue";
