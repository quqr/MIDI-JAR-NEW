<template>
  <div class="drawer-outlet relative h-full w-full">
    <Transition name="drawer">
      <div
        v-if="isOpen"
        class="fixed top-0 right-0 z-40 h-full w-80 bg-base-100 shadow-xl border-l border-base-200 overflow-hidden"
      >
        <div
          class="flex items-center justify-end px-3 py-2 border-b border-base-200"
        >
          <button
            class="btn btn-sm btn-ghost btn-circle transition-colors hover:bg-base-200"
            @click="handleClose"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
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
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

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

watch(
  () => route.name,
  (newRouteName) => {
    const hasChildren = !!newRouteName;
    if (hasChildren) {
      if (!hadChildren.value) {
        isOpen.value = true;
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
