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
      >
        {{ moduleId }}
      </RouterLink>
    </div>
    <button
      class="btn btn-sm btn-success"
      :aria-label="t('settings.chordDisplaySettings.addSession')"
      @click="addModalOpen = true"
    >
      <Icon name="plus" size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/components/Icon/Icon.vue";
import ChordDisplayAddModal from "./ChordDisplayAddModal.vue";
import { addModule } from "./utils";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const settingsStore = useSettingsStore();

const addModalOpen = ref(false);

const moduleIds = computed(() =>
  settingsStore.settings.chordDisplay.map((m) => m.id),
);
const currentRoute = computed(
  () => `/settings/chords/${route.params.moduleId}`,
);

const handleSave = async (name: string) => {
  try {
    const newModules = addModule(name, settingsStore.settings.chordDisplay);
    settingsStore.settings.chordDisplay = newModules;
    addModalOpen.value = false;
    router.push(`./${name}`);
  } catch (err) {
    throw err;
  }
};
</script>
