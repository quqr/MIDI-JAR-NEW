<template>
  <ChordDictionaryModuleProvider
    :key-signature="keySignature"
    :midi-notes="midiNotesArray"
    :played-midi-notes="playedMidiNotesArray"
    :sustained-midi-notes="sustainedMidiNotesArray"
    :pitch-classes="pitchClassesArray"
    :disable-update="disableUpdate"
  >
    <ChordDictionaryToolbar
      :disable-update="disableUpdate"
      :show-drawer-toggle="true"
      :key-signature="keySignature"
      :selected-chroma="chroma"
      @toggle-drawer="toggleSidebar"
      @select-chroma="handleChromaChange"
    />

    <div class="flex flex-1 min-h-0 overflow-hidden relative">
      <!-- Mobile/Tablet drawer: chord type list（MotionDrawer 统一动效） -->
      <div class="xl:hidden">
        <MotionDrawer
          :is-open="drawerOpen"
          side="left"
          :width="288"
          @close="drawerOpen = false"
        >
          <div
            class="flex items-center justify-between px-4 h-12 border-b border-base-200 flex-shrink-0"
          >
            <span class="text-hig-sm font-semibold text-base-content/70">
              {{ t("chordDictionary.chordTypesNavigation") }}
            </span>
            <button
              class="btn btn-sm btn-ghost btn-square"
              :aria-label="t('common.close')"
              @click="drawerOpen = false"
            >
              <Icon name="x" :size="16" aria-hidden="true" />
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto">
            <ChordDictionaryChordMenu
              v-bind="chordMenuProps"
              @select="handleChordTypeChangeDrawer"
            />
          </div>
        </MotionDrawer>
      </div>

      <!-- Tablet (sm-xl): collapsible sidebar -->
      <AnimatePresence>
        <motion.aside
          v-if="sidebarVisible"
          :initial="sidebar.initial"
          :animate="sidebar.animate"
          :exit="sidebar.exit"
          :transition="sidebar.transition"
          class="hidden sm:flex xl:hidden flex-shrink-0 overflow-hidden border-r border-base-300 glass"
        >
          <div class="min-h-0 w-full overflow-y-auto">
            <ChordDictionaryChordMenu
              v-bind="chordMenuProps"
              @select="handleChordTypeChange"
            />
          </div>
        </motion.aside>
      </AnimatePresence>

      <!-- Desktop (xl+): fixed two-column layout -->
      <div
        class="hidden xl:grid flex-1 min-h-0"
        style="grid-template-columns: minmax(180px, 240px) 3fr"
      >
        <!-- Left: Chord type list -->
        <div
          class="min-h-0 overflow-y-auto min-w-full border-r border-base-300 glass"
        >
          <ChordDictionaryChordMenu
            v-bind="chordMenuProps"
            @select="handleChordTypeChange"
          />
        </div>

        <!-- Right: Detail area -->
        <div class="min-h-0 overflow-y-auto">
          <RouterView />
        </div>
      </div>

      <!-- Tablet/Mobile: detail only -->
      <div class="xl:hidden flex-1 min-h-0 overflow-y-auto">
        <RouterView />
      </div>
    </div>
  </ChordDictionaryModuleProvider>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Chord, Note } from "tonal";
import { motion, AnimatePresence } from "motion-v";

import { useSettingsStore } from "@/stores/settings";
import useNotes from "@/composables/useNotes";
import { NOTE_NAMES, getNoteInKeySignature } from "@/helpers";
import Icon from "@/components/Icon/Icon.vue";
import { MotionDrawer } from "@/components/motion";
import { useMotionPresets, sidebarCollapse } from "@/utils/motion";
import ChordDictionaryModuleProvider from "./ChordDictionaryModuleProvider.vue";
import ChordDictionaryToolbar from "./ChordDictionaryToolbar.vue";
import ChordDictionaryChordMenu from "./ChordDictionaryChordMenu.vue";

interface Props {
  disableUpdate?: boolean;
}

withDefaults(defineProps<Props>(), {
  disableUpdate: false,
});

const { t } = useI18n();
const settingsStore = useSettingsStore();
const router = useRouter();
const route = useRoute();
const { resolve } = useMotionPresets();

const {
  chords,
  midiNotes,
  playedMidiNotes,
  sustainedMidiNotes,
  pitchClasses,
  keySignature,
} = useNotes({
  key: () => settingsStore.settings.notation.key,
  accidentals: () => settingsStore.settings.notation.accidentals,
  midiChannel: 0,
  useSustain: true,
  detectOnRelease: false,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  namespace: "chord-dictionary",
});

const midiNotesArray = computed(() => midiNotes.value.slice());
const playedMidiNotesArray = computed(() => playedMidiNotes.value.slice());
const sustainedMidiNotesArray = computed(() =>
  sustainedMidiNotes.value.slice(),
);
const pitchClassesArray = computed(() => pitchClasses.value.slice());

const chroma = ref<number | null>(null);
const chordType = ref<string | null>(null);
const drawerOpen = ref(false);
const sidebarVisible = ref(false);
const isTablet = ref(false);

let tabletMql: MediaQueryList | null = null;

const handleTabletChange = (e: MediaQueryListEvent | MediaQueryList) => {
  isTablet.value = e.matches;
  // 平板端默认显示侧边栏
  sidebarVisible.value = e.matches;
  // 平板端关闭抽屉
  if (e.matches) drawerOpen.value = false;
};

function toggleSidebar() {
  if (isTablet.value) {
    sidebarVisible.value = !sidebarVisible.value;
  } else {
    drawerOpen.value = !drawerOpen.value;
  }
}

const chordMenuProps = computed(() => ({
  keySignature: keySignature.value,
  selected: chordType.value,
  chroma: chroma.value,
  groupBy: settingsStore.settings.chordDictionary.groupBy,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
  hideDisabled: settingsStore.settings.chordDictionary.hideDisabled,
}));

const sidebar = computed(() => resolve(sidebarCollapse));

function navigateToChord(tonic: string | null, type: string | null) {
  if (!tonic || type === null) {
    router.push({ path: "/chord-dictionary" });
  } else {
    const name = encodeURIComponent(
      `${getNoteInKeySignature(tonic, keySignature.value.notes as string[])}${type}`,
    );
    router.push({ path: `/chord-dictionary/${name}` });
  }
}

function handleChromaChange(newChroma: number) {
  chroma.value = newChroma;
  navigateToChord(NOTE_NAMES[newChroma], chordType.value);
}

function handleChordTypeChange(newChordType: string) {
  chordType.value = newChordType;
  navigateToChord(
    chroma.value !== null ? NOTE_NAMES[chroma.value] : null,
    newChordType,
  );
}

function handleChordTypeChangeDrawer(newChordType: string) {
  handleChordTypeChange(newChordType);
  drawerOpen.value = false;
}

watchEffect(() => {
  if (settingsStore.settings.chordDictionary.interactive === "detect") {
    if (chords.value[0] && chords.value[0].tonic) {
      navigateToChord(chords.value[0].tonic, chords.value[0].aliases[0]);
    }
  }
});

const chordName = computed(() => route.params.chordName as string | undefined);

watch(chordName, (newName) => {
  const chord = newName ? Chord.get(newName) : null;

  if (chord && chord.tonic) {
    chroma.value = Note.chroma(chord.tonic) ?? null;
    chordType.value = chord.aliases[0];
  }
});

onMounted(() => {
  // sm-xl 为平板范围
  tabletMql = window.matchMedia("(min-width: 640px) and (max-width: 1279px)");
  handleTabletChange(tabletMql);
  tabletMql.addEventListener("change", handleTabletChange);
});

onUnmounted(() => {
  tabletMql?.removeEventListener("change", handleTabletChange);
});
</script>
