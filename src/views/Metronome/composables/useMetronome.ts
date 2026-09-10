import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { ensureAudioReady } from "@/composables/useAudioContext";
import { MetronomeEngine } from "../audio/MetronomeEngine";
import {
  DEFAULT_PARAMS,
  normalizeAccents,
  type MetronomeParams,
  type MetronomeStatus,
  type MetronomeVisualState,
} from "../types";

/**
 * 节拍器的 Vue 粘合层：参数 → 引擎，引擎 → 可视化状态。
 *
 * - `visual` 只在离散量（小节/拍/细分/音色）变化时更新，避免 60fps 触发 Vue 更新；
 *   需要逐帧平滑绘制的画布走 `getState`（引擎现算，不进响应式）。
 * - 页面级生命周期：离开页面即 stop + dispose，不做后台播放。
 */
export function useMetronome() {
  const params = ref<MetronomeParams>({
    ...DEFAULT_PARAMS,
    timeSignature: { ...DEFAULT_PARAMS.timeSignature },
    accents: [...DEFAULT_PARAMS.accents],
  });
  const status = ref<MetronomeStatus>("idle");
  const visual = shallowRef<MetronomeVisualState | null>(null);

  const engine = new MetronomeEngine(params.value);
  let rafId: number | null = null;

  function getState(): MetronomeVisualState | null {
    return engine.getVisualState();
  }

  function loop(): void {
    const next = engine.getVisualState();
    const prev = visual.value;
    const discreteChanged =
      !prev ||
      !next ||
      prev.barIndex !== next.barIndex ||
      prev.beatIndex !== next.beatIndex ||
      prev.subIndex !== next.subIndex ||
      prev.silent !== next.silent ||
      prev.kind !== next.kind;
    if (discreteChanged) visual.value = next;
    rafId = requestAnimationFrame(loop);
  }

  function startLoop(): void {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function stopLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  async function start(): Promise<void> {
    if (status.value !== "idle") return;
    status.value = "starting";
    await engine.start();
    status.value = engine.status;
    if (status.value === "playing") startLoop();
    else visual.value = null;
  }

  function stop(): void {
    engine.stop();
    status.value = "idle";
    visual.value = null;
    stopLoop();
  }

  function toggle(): void {
    if (status.value === "idle") void start();
    else stop();
  }

  watch(
    params,
    (next) => {
      if (next.accents.length !== next.timeSignature.numerator) {
        next.accents = normalizeAccents(
          next.accents,
          next.timeSignature.numerator,
        );
      }
      engine.setParams(next);
    },
    { deep: true },
  );

  onMounted(() => {
    ensureAudioReady();
  });

  onUnmounted(() => {
    stopLoop();
    engine.dispose();
  });

  return {
    params,
    status,
    isPlaying: computed(() => status.value === "playing"),
    visual,
    getState,
    start,
    stop,
    toggle,
  };
}
