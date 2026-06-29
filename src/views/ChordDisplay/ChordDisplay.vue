<template>
  <div id="chordDisplay" class="relative h-full w-full flex flex-col gap-3">
    <div class="flex-1 rounded-lg p-3 relative">
      <div class="flex h-full w-full gap-3">
        <div
          v-if="displayNotation"
          class="flex-1 flex items-center justify-center group relative"
          @contextmenu.prevent="popOut('notation')"
        >
          <Notation
            id="notation"
            class="items-center justify-center"
            :midiNotes="midiNotes as number[]"
            :keySignature="keySignature"
            :staffClef="staffClef"
            :staffTranspose="staffTranspose"
            :display="notationDisplay"
            :layout="notationLayout"
            :style="notationStyle"
          />
          <button
            v-if="!isNotationPoppedOut && isTauriEnv"
            class="absolute top-1 right-1 btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Pop out Notation"
            @click="popOut('notation')"
          >
            <Icon name="pin" class="w-3 h-3" />
          </button>
        </div>

        <div class="flex-1 flex flex-col gap-20 items-center justify-center">
          <div
            v-if="displayChord"
            id="chord"
            class="w-full flex items-center justify-center text-5xl font-bold group relative"
            @contextmenu.prevent="popOut('chord')"
          >
            <ChordNameLink
              :chord="chords[0] as any"
              class="items-center justify-center"
              :notation="chordNotation"
              :highlightAlterations="highlightAlterations"
            />
            <button
              v-if="!isChordPoppedOut && isTauriEnv"
              class="absolute top-1 right-1 btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Pop out Chord"
              @click="popOut('chord')"
            >
              <Icon name="pin" class="w-3 h-3" />
            </button>
          </div>
          <div
            v-if="displayName"
            id="name"
            class="w-full text-center text-xl font-semibold"
          >
            {{ chords[0]?.name }}
          </div>
          <div
            v-if="displayIntervals"
            id="intervals"
            class="w-full flex items-center justify-center group relative"
            @contextmenu.prevent="popOut('intervals')"
          >
            <ChordIntervals
              :intervals="chords[0]?.intervals as unknown as string[]"
              :pitchClasses="pitchClasses as unknown as string[]"
              :tonic="chords[0]?.tonic"
            />
            <button
              v-if="!isIntervalsPoppedOut && isTauriEnv"
              class="absolute top-1 right-1 btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Pop out Intervals"
              @click="popOut('intervals')"
            >
              <Icon name="pin" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div class="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
        <SettingsButton
          :aria-label="t('chordDisplay.openSettings')"
          @click="settingsOpen = true"
        />
        <div
          v-if="displayAltChords"
          class="flex flex-col gap-2 items-end rounded-lg p-2 backdrop-blur-sm"
        >
          <template v-for="(chord, index) in chords" :key="index">
            <span v-if="index > 0" class="inline-flex">
              <ChordNameLink
                :chord="chord as any"
                class="items-center justify-center text-lg"
                :notation="chordNotation"
                :highlightAlterations="highlightAlterations"
              />
            </span>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="displayKeyboard"
      class="flex-shrink-0 rounded-lg p-2 group relative"
      style="min-height: 200px"
      @contextmenu.prevent="popOut('keyboard')"
    >
      <PianoKeyboard
        id="keyboard"
        class="w-full h-full"
        :sustained="sustainedMidiNotes as unknown as number[]"
        :played="playedMidiNotes as unknown as number[]"
        :midi="midiNotes as unknown as number[]"
        :chord="chords[0] as any"
        :keySignature="keySignature as unknown as KeySignatureConfig"
        :keyboard="keyboard"
      />
      <button
        v-if="!isKeyboardPoppedOut && isTauriEnv"
        class="absolute top-3 right-3 btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Pop out Keyboard"
        @click="popOut('keyboard')"
      >
        <Icon name="pin" class="w-3 h-3" />
      </button>
    </div>

    <SettingsModal v-model="settingsOpen" :title="t('chordDisplay.settings')">
      <ChordDisplayModuleSettings :module-id="moduleId" />
    </SettingsModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { PianoKeyboard } from "@/components/PianoKeyboard/";
import { Notation } from "@/components/Notation/";
import { ChordNameLink } from "@/components/ChordNameLink/";
import { ChordIntervals } from "@/components/ChordIntervals/";
import { SettingsButton } from "@/components/SettingsButton/";
import { SettingsModal } from "@/components/SettingsModal/";
import Icon from "@/components/Icon/Icon.vue";
import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";
import { useWidgetStore } from "@/stores/widget";
import { isTauri } from "@/utils/tauri";
import {
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "@/components/Notation/utils";
import ChordDisplayModuleSettings from "@/views/Settings/ChordDisplaySettings/ChordDisplayModuleSettings.vue";
import type { StaffClef } from "@/components/Notation/types";
import type { KeySignatureConfig } from "@/helpers";
import type { WidgetType } from "@/types/widget";

const { t } = useI18n();
const settingsOpen = ref(false);
const isTauriEnv = isTauri();

const props = defineProps<{
  moduleId: string;
}>();

const settingsStore = useSettingsStore();
const widgetStore = useWidgetStore();

const moduleSettings = computed(() => {
  return settingsStore.settings.chordDisplay.find(
    (m) => m.id === props.moduleId,
  );
});

const staffClef = computed<StaffClef>(
  () => settingsStore.settings.notation.staffClef,
);
const staffTranspose = computed(
  () => settingsStore.settings.notation.staffTranspose,
);
const notationDisplay = computed(() =>
  mergeDisplayConfig(settingsStore.settings.notation.display),
);
const notationLayout = computed(() =>
  mergeLayoutConfig(settingsStore.settings.notation.layout),
);
const notationStyle = computed(() =>
  mergeStyleConfig(settingsStore.settings.notation.style),
);

const {
  midiNotes,
  pitchClasses,
  sustainedMidiNotes,
  playedMidiNotes,
  chords,
  keySignature,
} = useNotes({
  accidentals: () => settingsStore.settings.notation.accidentals,
  key: () => settingsStore.settings.notation.key,
  midiChannel: 0,
  allowOmissions: moduleSettings.value?.allowOmissions ?? false,
  useSustain: moduleSettings.value?.useSustain ?? true,
  detectOnRelease: moduleSettings.value?.detectOnRelease ?? true,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  namespace: `chord-display/${props.moduleId}`,
});

const chordNotation = computed(
  () => moduleSettings.value?.chordNotation ?? "preferred",
);
const highlightAlterations = computed(
  () => moduleSettings.value?.highlightAlterations ?? false,
);
const displayKeyboard = computed(
  () =>
    !isKeyboardPoppedOut.value &&
    (moduleSettings.value?.displayKeyboard ?? true),
);
const displayChord = computed(
  () => !isChordPoppedOut.value && (moduleSettings.value?.displayChord ?? true),
);
const displayName = computed(() => moduleSettings.value?.displayName ?? false);
const displayNotation = computed(
  () =>
    !isNotationPoppedOut.value &&
    (moduleSettings.value?.displayNotation ?? false),
);
const displayAltChords = computed(
  () => moduleSettings.value?.displayAltChords ?? true,
);
const displayIntervals = computed(
  () =>
    !isIntervalsPoppedOut.value &&
    (moduleSettings.value?.displayIntervals ?? false),
);
const keyboard = computed(() => moduleSettings.value?.keyboard);

const isKeyboardPoppedOut = computed(() =>
  widgetStore.isWidgetPoppedOut("keyboard", props.moduleId),
);
const isNotationPoppedOut = computed(() =>
  widgetStore.isWidgetPoppedOut("notation", props.moduleId),
);
const isChordPoppedOut = computed(() =>
  widgetStore.isWidgetPoppedOut("chord", props.moduleId),
);
const isIntervalsPoppedOut = computed(() =>
  widgetStore.isWidgetPoppedOut("intervals", props.moduleId),
);

async function popOut(type: WidgetType) {
  await widgetStore.popOutWidget(type, props.moduleId);
}

let unlistenWindowClosed: (() => void) | null = null;

onMounted(async () => {
  if (isTauriEnv) {
    const { getTauriAPI } = await import("@/utils/tauri");
    const api = getTauriAPI();
    unlistenWindowClosed = await api.widget.onWindowClosed((label: string) => {
      const prefix = "widget-";
      const id = label.startsWith(prefix) ? label.slice(prefix.length) : label;
      widgetStore.removeWidget(id);
    });
  }
});

onUnmounted(() => {
  if (unlistenWindowClosed) {
    unlistenWindowClosed();
  }
});
</script>
