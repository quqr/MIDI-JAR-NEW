<script setup lang="ts">
import { ref } from "vue";
import Icon from "@/components/Icon/Icon.vue";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

const toasts = ref<ToastItem[]>([]);
let nextId = 0;

function addToast(message: string, type: ToastItem["type"] = "info") {
  const id = nextId++;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    removeToast(id);
  }, 3000);
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function iconForType(type: ToastItem["type"]) {
  switch (type) {
    case "success":
      return "check";
    case "error":
      return "x";
    case "warning":
      return "warning";
    case "info":
      return "info";
  }
}

function classForType(type: ToastItem["type"]) {
  switch (type) {
    case "success":
      return "alert-success";
    case "error":
      return "alert-error";
    case "warning":
      return "alert-warning";
    case "info":
      return "alert-info";
  }
}

defineExpose({ addToast });
</script>

<template>
  <div class="toast toast-bottom toast-end z-[100]">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="alert shadow-lg"
        :class="classForType(toast.type)"
      >
        <Icon :name="iconForType(toast.type)" size="18" />
        <span class="text-sm">{{ toast.message }}</span>
        <button class="btn btn-ghost btn-xs" @click="removeToast(toast.id)">
          <Icon name="x" size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
