import { ref, onMounted, onUnmounted } from "vue";
import type { UnlistenFn } from "@tauri-apps/api/event";

export function useMidiLatency(filterDevice = "*") {
  const currentLatency = ref<number>(0);
  const highestLatency = ref<number>(0);
  const highest = ref<number>(0);
  const buffer = ref<number[]>([]);
  const timeout = ref<ReturnType<typeof setTimeout> | null>(null);
  let cleanup: UnlistenFn | null = null;

  const resetHighest = () => {
    highest.value = 0;
    highestLatency.value = 0;
  };

  // onUnmounted 必须在 setup 期间同步注册，不能放在 async onMounted 回调的 await 之后
  onUnmounted(() => {
    if (cleanup) cleanup();
    if (timeout.value) {
      clearTimeout(timeout.value);
      timeout.value = null;
    }
  });

  onMounted(async () => {
    if (window.tauriAPI?.midi) {
      cleanup = await window.tauriAPI.midi.onLatency((latency, device) => {
        if (filterDevice === "*" || filterDevice === device) {
          buffer.value.push(latency);

          if (!timeout.value) {
            timeout.value = setTimeout(() => {
              let sum = 0;
              for (let i = 0; i < buffer.value.length; i++) {
                sum += buffer.value[i];
                if (highest.value < buffer.value[i]) {
                  highest.value = buffer.value[i];
                }
              }
              const average = sum / buffer.value.length;
              buffer.value = [];

              currentLatency.value = average;
              highestLatency.value = highest.value;

              timeout.value = null;
            }, 0);
          }
        }
      });
    }
  });

  return { currentLatency, highestLatency, resetHighest };
}

export default useMidiLatency;
