<script setup lang="ts">
import { ref, onMounted } from "vue";
import { RouterView } from "vue-router";
import TopBar from "@/views/Layout/TopBar.vue";
import BottomBar from "@/views/Layout/BottomBar.vue";
import Toast from "@/components/Toast/Toast.vue";
import WelcomeModal from "@/components/WelcomeModal.vue";
import { setToastRef } from "@/composables/useToast";

const toastRef = ref<InstanceType<typeof Toast> | null>(null);

onMounted(() => {
  setToastRef(toastRef.value);
});
</script>

<template>
  <div class="flex flex-col h-screen bg-base-200">
    <TopBar class="flex-shrink-0 h-16" />
    <main class="flex-1 overflow-hidden">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <Suspense>
            <template #default>
              <component :is="Component" />
            </template>
            <template #fallback>
              <div class="flex items-center justify-center h-full">
                <span
                  class="loading loading-spinner loading-lg text-primary"
                ></span>
              </div>
            </template>
          </Suspense>
        </Transition>
      </RouterView>
    </main>
    <BottomBar class="flex-shrink-0 h-10" />
  <WelcomeModal />
  <Toast ref="toastRef" />
  </div>
</template>
