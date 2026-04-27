<template>
  <div class="drawer-outlet relative h-full w-full">
    <Transition name="drawer">
      <div
        v-if="isOpen"
        ref="drawerRef"
        class="fixed top-0 right-0 z-40 h-full w-80 bg-base-100 shadow-xl border-l border-base-200 overflow-hidden"
        @keydown.tab="handleDrawerTab"
        @keydown.escape="handleClose"
      >
        <div
          class="flex items-center justify-end px-3 py-2 border-b border-base-200"
        >
          <button
            class="btn btn-sm btn-ghost btn-circle transition-colors hover:bg-base-200"
            @click="handleClose"
          >
            <Icon name="x" size="16" />
          </button>
        </div>
        <div class="overflow-auto" style="height: calc(100% - 41px)">
          <RouterView />
        </div>
      </div>
    </Transition>

    <div class="h-full w-full">
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/components/Icon/Icon.vue";

interface Props {
  context?: unknown;
  drawerWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  context: undefined,
  drawerWidth: 320,
});

const route = useRoute();
const router = useRouter();

const isOpen = ref(false);
const hadChildren = ref(false);
const drawerRef = ref<HTMLDivElement | null>(null);
const previousFocus = ref<HTMLElement | null>(null);

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
}

function handleDrawerTab(e: KeyboardEvent) {
  if (!drawerRef.value) return;
  const focusable = getFocusableElements(drawerRef.value);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

watch(
  () => route.name,
  (newRouteName) => {
    const hasChildren = !!newRouteName;
    if (hasChildren) {
      if (!hadChildren.value) {
        previousFocus.value = document.activeElement as HTMLElement;
        isOpen.value = true;
        nextTick(() => {
          if (drawerRef.value) {
            const focusable = getFocusableElements(drawerRef.value);
            if (focusable.length > 0) focusable[0].focus();
          }
        });
      }
      hadChildren.value = true;
    } else {
      hadChildren.value = false;
    }
  },
  { immediate: true },
);

function handleClose() {
  isOpen.value = false;
  previousFocus.value?.focus();
  previousFocus.value = null;
  router.push({ path: route.path.split("/").slice(0, -1).join("/") || "/" });
}

defineExpose({ onDrawerToggle: handleClose });
</script>

<style scoped>
.drawer-enter-active {
  transition: transform 0.3s ease;
}
.drawer-leave-active {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
