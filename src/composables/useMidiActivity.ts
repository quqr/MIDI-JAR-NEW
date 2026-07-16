import { ref, onUnmounted } from "vue";

/**
 * MIDI 设备活跃状态指示器：触发后保持活跃状态 300ms，用于 UI 闪烁反馈。
 *
 * @param _deviceName - 设备名称（预留参数，当前未使用）
 * @returns 活跃状态 ref 及触发方法
 */
export function useMidiActivity(_deviceName: string) {
  const isActive = ref(false);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const triggerActivity = () => {
    isActive.value = true;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      isActive.value = false;
      timeout = null;
    }, 300);
  };

  onUnmounted(() => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  });

  return { isActive, triggerActivity };
}

export default useMidiActivity;
