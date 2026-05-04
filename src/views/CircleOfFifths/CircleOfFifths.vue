<template>
  <div
    class="relative w-full h-full flex flex-col justify-center items-center overflow-hidden p-4 sm:p-6 lg:p-8"
  >
    <div class="absolute top-4 right-4 z-10">
      <SettingsButton
        :aria-label="t('circleOfFifths.openSettings')"
        @click="settingsOpen = true"
      />
    </div>
    <CircleFifths
      :keySignature="keySignature"
      :chord="chords[0] as any"
      :notes="pitchClasses as unknown as string[]"
      :onChange="disableUpdate ? undefined : handleKeyChange"
      :config="config"
    >
      <div
        id="chord"
        class="flex text-lg overflow-hidden h-full items-center justify-center font-medium tracking-wide"
        style="text-shadow: 0 0.05em 0.1em rgba(0, 0, 0, 0.6)"
      >
        <ChordName :chord="chords[0] as any" hideRoot />
      </div>
    </CircleFifths>

    <SettingsModal v-model="settingsOpen" :title="t('circleOfFifths.settings')">
      <CircleOfFifthsSettings />
    </SettingsModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CircleFifths } from "@/components/CircleFifths/";
import { ChordName } from "@/components/ChordName/";
import { SettingsButton } from "@/components/SettingsButton/";
import { SettingsModal } from "@/components/SettingsModal/";
import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";
import CircleOfFifthsSettings from "@/views/Settings/CircleOfFifthsSettings/CircleOfFifthsSettings.vue";

const { t } = useI18n();
const settingsOpen = ref(false);

const props = withDefaults(
  defineProps<{
    disableUpdate?: boolean;
  }>(),
  {
    disableUpdate: false,
  },
);

const settingsStore = useSettingsStore();

const config = computed(() => settingsStore.settings.circleOfFifths);
const disabledChords = computed(
  () => settingsStore.settings.chordDictionary.disabled,
);

const { chords, pitchClasses, keySignature } = useNotes({
  key: () => settingsStore.settings.notation.key,
  midiChannel: 0,
  disabledChords: disabledChords.value,
  namespace: "circle-of-fifths",
});

const handleKeyChange = (newKey: string) => {
  return settingsStore.updateSetting("notation.key", newKey);
};
</script>
