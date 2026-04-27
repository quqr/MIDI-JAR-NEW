import { ref } from "vue";

const toastRef = ref<{
  addToast: (
    message: string,
    type?: "success" | "error" | "info" | "warning",
  ) => void;
} | null>(null);

export function setToastRef(ref: typeof toastRef.value) {
  toastRef.value = ref;
}

export function useToast() {
  function show(
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
  ) {
    toastRef.value?.addToast(message, type);
  }

  return { show };
}
