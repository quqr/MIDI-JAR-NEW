<template>
  <div
    class="chord-dictionary-toolbar flex flex-col gap-2 px-4 py-2 border-b border-base-300 glass flex-shrink-0"
  >
    <!-- Row 1: Search + controls -->
    <div class="flex items-center gap-2">
      <!-- Hamburger for mobile drawer -->
      <button
        v-if="showDrawerToggle"
        class="btn btn-sm btn-ghost btn-square lg:hidden"
        :aria-label="t('common.openSidebar')"
        @click="$emit('toggleDrawer')"
      >
        <Icon name="menu" :size="18" />
      </button>

      <!-- Inline search -->
      <ChordSearch :on-select="handleChordSelect" mode="inline" />

      <template v-if="!disableUpdate">
        <!-- Group by dropdown -->
        <div class="relative hidden sm:block">
          <button
            class="btn btn-sm btn-outline gap-1"
            @click="menuOpen = !menuOpen"
          >
            <span class="truncate max-w-[80px]">
              {{ getGroupLabel(groupBy) }}
            </span>
            <Icon name="chevron-down" size="14" />
          </button>

          <div
            v-show="menuOpen"
            class="absolute top-full left-0 z-50 mt-1 card bg-base-100 shadow-md min-w-[180px]"
          >
            <ul class="menu bg-base-100 w-full p-1">
              <li class="menu-title">
                <span>{{ t("chordDictionary.group") }}</span>
              </li>
              <li>
                <a
                  :class="{ 'bg-primary/10 text-primary': groupBy === 'none' }"
                  @click="
                    updateGroupBy('none');
                    menuOpen = false;
                  "
                >
                  {{ t("chordDictionary.groupNames.noGroup") }}
                </a>
              </li>
              <li>
                <a
                  :class="{
                    'bg-primary/10 text-primary': groupBy === 'quality',
                  }"
                  @click="
                    updateGroupBy('quality');
                    menuOpen = false;
                  "
                >
                  {{ t("chordDictionary.groupNames.byQuality") }}
                </a>
              </li>
              <li>
                <a
                  :class="{
                    'bg-primary/10 text-primary': groupBy === 'intervals',
                  }"
                  @click="
                    updateGroupBy('intervals');
                    menuOpen = false;
                  "
                >
                  {{ t("chordDictionary.groupNames.byIntervals") }}
                </a>
              </li>
            </ul>
          </div>
          <div
            v-show="menuOpen"
            class="fixed inset-0 z-40"
            @click="menuOpen = false"
          ></div>
        </div>

        <!-- Filter toggles -->
        <div class="hidden md:flex items-center gap-3 ml-1">
          <label
            class="flex items-center gap-1.5 cursor-pointer text-hig-xs text-base-content/70 whitespace-nowrap"
          >
            <input
              type="checkbox"
              class="toggle toggle-xs toggle-primary"
              :checked="filterInKey"
              @change="toggleFilterInKey"
            />
            {{ t("chordDictionary.onlyChordsInKey") }}
          </label>
          <label
            class="flex items-center gap-1.5 cursor-pointer text-hig-xs text-base-content/70 whitespace-nowrap"
          >
            <input
              type="checkbox"
              class="toggle toggle-xs toggle-primary"
              :checked="hideDisabled"
              @change="toggleHideDisabled"
            />
            {{ t("chordDictionary.hideDisabledChords") }}
          </label>
        </div>
      </template>

      <div class="flex-1"></div>

      <div v-if="!disableUpdate" class="join">
        <button
          class="btn btn-xs join-item"
          :class="
            interactiveMode === 'detect'
              ? 'btn-primary'
              : 'btn-ghost text-base-content/70'
          "
          :title="t('chordDictionary.detect')"
          :aria-label="t('chordDictionary.detect')"
          :aria-pressed="interactiveMode === 'detect'"
          @click="handleToggleInteractive('detect')"
        >
          <Icon name="eye" :size="14" />
        </button>
        <button
          class="btn btn-xs join-item"
          :class="
            interactiveMode === 'play'
              ? 'btn-primary'
              : 'btn-ghost text-base-content/70'
          "
          :title="t('chordDictionary.play')"
          :aria-label="t('chordDictionary.play')"
          :aria-pressed="interactiveMode === 'play'"
          @click="handleToggleInteractive('play')"
        >
          <Icon name="controller" :size="14" />
        </button>
      </div>

      <SettingsButton
        :aria-label="t('chordDictionary.openDictionarySettings')"
        @click="settingsOpen = true"
      />

      <SettingsDrawer
        v-model="settingsOpen"
        :title="t('chordDictionary.settings')"
      >
        <ChordDictionarySettings />
      </SettingsDrawer>
    </div>

    <!-- Row 2: Chroma selector auto-fit grid -->
    <div
      class="grid gap-1"
      style="grid-template-columns: repeat(auto-fit, minmax(2.5rem, 1fr))"
      role="tablist"
      :aria-label="t('chordDictionary.chromaNavigation')"
    >
      <button
        v-for="note in notesList"
        :key="note"
        role="tab"
        :aria-selected="selectedChroma === getChroma(note)"
        class="btn btn-xs sm:btn-sm px-0 min-h-0 h-7 sm:h-8 text-hig-xs font-medium transition-colors"
        :class="
          selectedChroma === getChroma(note)
            ? 'btn-primary'
            : 'btn-ghost hover:bg-base-200'
        "
        @click="$emit('selectChroma', getChroma(note))"
      >
        {{ formatNote(note) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Note } from "tonal";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import type { KeySignatureConfig } from "@/helpers";
import {
  NOTE_NAMES,
  formatSharpsFlats,
  getNoteInKeySignature,
} from "@/helpers";
import { SettingsButton } from "@/components/SettingsButton";
import { SettingsDrawer } from "@/components/SettingsDrawer/";
import Icon from "@/components/Icon/Icon.vue";
import ChordSearch from "./ChordSearch/ChordSearch.vue";
import ChordDictionarySettings from "../Settings/ChordDictionarySettings/ChordDictionarySettings.vue";

interface Props {
  disableUpdate?: boolean;
  showDrawerToggle?: boolean;
  keySignature: KeySignatureConfig;
  selectedChroma: number | null;
  filterChordsInKey: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disableUpdate: false,
  showDrawerToggle: false,
});

defineEmits<{
  (e: "toggleDrawer"): void;
  (e: "selectChroma", chroma: number): void;
}>();

const { t } = useI18n();
const router = useRouter();
const settingsStore = useSettingsStore();

const settingsOpen = ref(false);
const menuOpen = ref(false);

const groupBy = computed(() => settingsStore.settings.chordDictionary.groupBy);
const filterInKey = computed(
  () => settingsStore.settings.chordDictionary.filterInKey,
);
const hideDisabled = computed(
  () => settingsStore.settings.chordDictionary.hideDisabled,
);
const interactiveMode = computed(
  () => settingsStore.settings.chordDictionary.interactive,
);

// Chroma selector
const notesList = computed(() =>
  props.filterChordsInKey ? props.keySignature.scale : NOTE_NAMES,
);

function getChroma(note: string): number {
  return Note.chroma(note) as number;
}

function formatNote(note: string): string {
  return formatSharpsFlats(
    getNoteInKeySignature(note, props.keySignature.notes),
  );
}

function getGroupLabel(groupByValue: string): string {
  if (groupByValue === "none") return t("chordDictionary.groupNames.noGroup");
  if (groupByValue === "quality")
    return t("chordDictionary.groupNames.byQuality");
  return t("chordDictionary.groupNames.byIntervals");
}

function toggleHideDisabled() {
  settingsStore.updateSetting(
    "chordDictionary.hideDisabled",
    !hideDisabled.value,
  );
}

function toggleFilterInKey() {
  settingsStore.updateSetting(
    "chordDictionary.filterInKey",
    !filterInKey.value,
  );
}

function handleToggleInteractive(value: string) {
  settingsStore.updateSetting("chordDictionary.interactive", value);
}

function updateGroupBy(value: "none" | "quality" | "intervals") {
  settingsStore.updateSetting("chordDictionary.groupBy", value);
}

function handleChordSelect(chord: string | null) {
  if (chord) {
    router.push({
      path: `/chord-dictionary/${encodeURIComponent(chord)}`,
    });
  }
}
</script>
