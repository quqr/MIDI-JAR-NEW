<template>
  <div
    class="relative w-full min-h-screen flex flex-col justify-center items-center overflow-hidden p-page-x sm:p-6 lg:p-8"
  >
    <h1 class="sr-only">{{ $t("nav.circleOfFifths") }}</h1>
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
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CircleFifths } from "@/components/CircleFifths/";
import { ChordName } from "@/components/ChordName/";
import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";

const props = withDefaults(
  defineProps<{
    disableUpdate?: boolean;
  }>(),
  {
    disableUpdate: false,
  },
);

const settingsStore = useSettingsStore();

const key = computed(() => settingsStore.settings.notation.key);
const config = computed(() => settingsStore.settings.circleOfFifths);
const disabledChords = computed(
  () => settingsStore.settings.chordDictionary.disabled,
);

const { chords, pitchClasses, keySignature } = useNotes({
  key: key.value,
  midiChannel: 0,
  disabledChords: disabledChords.value,
});

const handleKeyChange = (newKey: string) => {
  return settingsStore.updateSetting("notation.key", newKey);
};
</script>
