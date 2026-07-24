import { onMounted } from "vue";

/**
 * 模块级集合：记录当前应用会话中已播放入场动画的 stagger 组。
 * 跨路由返回时不重复触发，仅应用首次加载时动画一次。
 */
const animatedKeys = new Set<string>();

/**
 * 让 MotionStaggerList 仅在应用首次加载（首次挂载）时播放入场动画。
 * once 为 true 时，同一 onceKey 的后续挂载跳过动画直接呈现在终态。
 *
 * @param once   是否启用"仅首载"模式
 * @param onceKey 唯一标识，区分不同 stagger 组
 * @returns shouldAnimate 当前挂载是否需要播放入场动画
 */
export function useStaggerOnce(once: boolean, onceKey: string) {
  const shouldAnimate = !once || !animatedKeys.has(onceKey);

  onMounted(() => {
    if (once) {
      animatedKeys.add(onceKey);
    }
  });

  return { shouldAnimate };
}
