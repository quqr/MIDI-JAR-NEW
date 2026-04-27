import { ref, onUnmounted } from "vue";

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
