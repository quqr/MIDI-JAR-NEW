<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

const { t } = useI18n();
const show = ref(false);
const STORAGE_KEY = "midi-jar-welcome-dismissed";

onMounted(() => {
  const dismissed = localStorage.getItem(STORAGE_KEY);
  if (!dismissed) {
    show.value = true;
  }
});

function dismiss() {
  show.value = false;
  localStorage.setItem(STORAGE_KEY, "true");
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div class="card bg-base-100 shadow-2xl w-full max-w-lg">
        <div class="card-body">
          <h2 id="welcome-title" class="card-title text-xl justify-center">
            🎵 MIDI Jar
          </h2>
          <p class="text-base-content/80 text-center mt-2">
            {{ t("welcome.intro") }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div class="flex items-start gap-3 p-3 rounded-lg bg-base-200/50">
              <Icon
                name="piano"
                size="24"
                class="text-primary flex-shrink-0 mt-0.5"
              />
              <div>
                <p class="text-sm font-semibold">
                  {{ t("welcome.featureDisplay") }}
                </p>
                <p class="text-xs text-base-content/80">
                  {{ t("welcome.featureDisplayHint") }}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-lg bg-base-200/50">
              <Icon
                name="quiz"
                size="24"
                class="text-primary flex-shrink-0 mt-0.5"
              />
              <div>
                <p class="text-sm font-semibold">
                  {{ t("welcome.featureLearn") }}
                </p>
                <p class="text-xs text-base-content/80">
                  {{ t("welcome.featureLearnHint") }}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-lg bg-base-200/50">
              <Icon
                name="routing"
                size="24"
                class="text-primary flex-shrink-0 mt-0.5"
              />
              <div>
                <p class="text-sm font-semibold">
                  {{ t("welcome.featureRoute") }}
                </p>
                <p class="text-xs text-base-content/80">
                  {{ t("welcome.featureRouteHint") }}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-lg bg-base-200/50">
              <Icon
                name="overlay"
                size="24"
                class="text-primary flex-shrink-0 mt-0.5"
              />
              <div>
                <p class="text-sm font-semibold">
                  {{ t("welcome.featureIntegrate") }}
                </p>
                <p class="text-xs text-base-content/80">
                  {{ t("welcome.featureIntegrateHint") }}
                </p>
              </div>
            </div>
          </div>
          <div class="card-actions justify-center mt-4">
            <button class="btn btn-primary" @click="dismiss">
              {{ t("welcome.getStarted") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active {
  transition: opacity 0.3s ease;
}
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
