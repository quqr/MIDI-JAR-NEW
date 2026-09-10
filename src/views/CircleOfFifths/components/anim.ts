import { animate } from "animejs";

/**
 * 五度循环圈的动效工具。
 *
 * 项目惯例（见 Tuner / PitchIndicator）是组件内自行 `matchMedia` 判断
 * `prefers-reduced-motion`、收集动画对象并在卸载时逐个 `revert`。这里只把
 * 「anime 自己不方便做」的几件事收敛在页面目录内，不上升为全局抽象；
 * 入场 / 错峰这类编排仍由组件直接用 anime 的 `animate` / `createTimeline`。
 */

/** 可回退的动画对象（anime 的 Animation / Timeline 均满足） */
export type Revertible = { revert: () => void };

/** 是否允许播放动效——尊重系统的「减少动态效果」偏好 */
export function motionEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 动画作用域：集中登记、统一清理 */
export function createMotionScope() {
  let running: Revertible[] = [];

  /** 登记一个动画，交由作用域统一回退 */
  function track<T extends Revertible>(
    animation: T | null | undefined,
  ): T | null {
    if (!animation) return null;
    running.push(animation);
    return animation;
  }

  /** 回退并清空全部已登记的动画 */
  function dispose(): void {
    for (const animation of running) animation.revert();
    running = [];
  }

  return { track, dispose };
}

/**
 * 描画一段路径 / 直线：把 `stroke-dashoffset` 从全长收到 0。
 * 需要在元素已挂载且可测量时调用（`getTotalLength` 依赖布局）。
 * @param target - SVG 几何元素（path / line / polyline / circle）
 */
export function drawStroke(
  target: SVGGeometryElement | null | undefined,
  options: { duration?: number; delay?: number } = {},
): Revertible | null {
  if (!target || !motionEnabled()) return null;

  const { duration = 620, delay = 0 } = options;

  let length = 0;
  try {
    length = target.getTotalLength();
  } catch {
    // 元素尚未布局（如 display:none 的祖先）时无法测量，直接放弃动画
    return null;
  }
  if (!length) return null;

  target.style.strokeDasharray = `${length}px`;
  target.style.strokeDashoffset = `${length}px`;

  return animate(target, {
    strokeDashoffset: [`${length}px`, "0px"],
    duration,
    delay,
    ease: "outQuad",
  });
}

/**
 * 数字滚动。目标元素的文本内容需为可解析的数字。
 * @param target - 承载数字的元素（SVG `<text>` 亦可，故取 `Element`）
 * @param to - 目标值
 */
export function countUp(
  target: Element | null | undefined,
  to: number,
  options: { duration?: number } = {},
): Revertible | null {
  if (!target) return null;

  const { duration = 420 } = options;

  if (!motionEnabled()) {
    target.textContent = String(to);
    return null;
  }

  const carrier = { value: Number(target.textContent) || 0 };

  return animate(carrier, {
    value: to,
    duration,
    ease: "outExpo",
    onUpdate: () => {
      target.textContent = String(Math.round(carrier.value));
    },
  });
}
