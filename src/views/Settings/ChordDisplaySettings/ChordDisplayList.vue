<template>
  <div class="flex items-center gap-2 p-2 bg-base-200">
    <div class="tabs tabs-boxed bg-transparent flex-1 overflow-x-auto">
      <RouterLink
        v-for="moduleId in moduleIds"
        :key="moduleId"
        :to="`/settings/chords/${moduleId}`"
        class="tab tab-sm"
        :class="
          currentRoute === `/settings/chords/${moduleId}` ? 'tab-active' : ''
        "
        :aria-current="
          currentRoute === `/settings/chords/${moduleId}` ? 'page' : undefined
        "
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
