<template>
  <div class="flex items-center gap-2 p-2 bg-base-200">
    <div class="tabs tabs-box flex-1 overflow-x-auto">
      <RouterLink
        v-for="moduleId in moduleIds"
        :key="moduleId"
        :to="`/settings/chords/${moduleId}`"
        class="tab tab-sm"
        :class="{ 'tab-active': isCurrent(moduleId) }"
        :style="
          isCurrent(moduleId)
            ? {
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-content)',
              }
            : undefined
        "
        :aria-current="isCurrent(moduleId) ? 'page' : undefined"
      >
        {{ moduleId }}
      </RouterLink>
    </div>
    <button
      class="btn btn-sm btn-primary"
      :aria-label="t('settings.chordDisplaySettings.addSession')"
      @click="addModalOpen = true"
    >
      <Icon name="plus" size="16" />
    </button>
    <ChordDisplayAddModal
      ref="addModal"
      :open="addModalOpen"
      @cancel="addModalOpen = false"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/components/Icon/Icon.vue";
import ChordDisplayAddModal from "./ChordDisplayAddModal.vue";
import { addModule } from "./utils";

const { t } = useI18n();
const route = useRoute();
const settingsStore = useSettingsStore();

const addModalOpen = ref(false);
const addModal = ref<InstanceType<typeof ChordDisplayAddModal>>();

const moduleIds = computed(() =>
  settingsStore.settings.chordDisplay.map((m) => m.id),
);
const currentRoute = computed(
  () => `/settings/chords/${route.params.moduleId}`,
);

/** 当前路由对应的模块 tab（激活项用主题强调色底 + 反色文字） */
function isCurrent(moduleId: string): boolean {
  return currentRoute.value === `/settings/chords/${moduleId}`;
}

function handleSave(name: string) {
  try {
    settingsStore.settings.chordDisplay = addModule(
      name,
      settingsStore.settings.chordDisplay,
    );
    addModalOpen.value = false;
  } catch (err) {
    addModal.value?.handleSaveError(err);
  }
}
</script>
