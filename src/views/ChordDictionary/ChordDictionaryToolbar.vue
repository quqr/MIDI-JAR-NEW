<template>
  <div
    class="chord-dictionary-toolbar flex items-center gap-2 px-3 py-2 border-b border-base-200 bg-base-100 flex-wrap flex-shrink-0"
  >
    <div v-if="!disableUpdate" class="relative inline-block">
      <button class="btn btn-sm btn-outline" @click="menuOpen = !menuOpen">
        {{ getGroupLabel(groupBy)
        }}{{ filterInKey ? t("chordDictionary.inKey") : "" }}
        <Icon name="chevron-down" size="16" class="ml-1" />
      </button>

      <div
        v-show="menuOpen"
        class="absolute top-full left-0 z-50 mt-1 card bg-base-100 shadow-md min-w-[250px]"
      >
        <ul class="menu bg-base-100 w-full p-0">
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
              :class="{ 'bg-primary/10 text-primary': groupBy === 'quality' }"
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
              :class="{ 'bg-primary/10 text-primary': groupBy === 'intervals' }"
              @click="
                updateGroupBy('intervals');
                menuOpen = false;
              "
            >
              {{ t("chordDictionary.groupNames.byIntervals") }}
            </a>
          </li>
          <li class="divider my-1"></li>
          <li class="menu-title">
            <span>{{ t("chordDictionary.filter") }}</span>
          </li>
          <li>
            <a
              :class="{ 'bg-primary/10 text-primary': hideDisabled }"
              @click="
                toggleHideDisabled();
                menuOpen = false;
              "
            >
              {{ t("chordDictionary.hideDisabledChords") }}
            </a>
          </li>
          <li>
            <a
              :class="{ 'bg-primary/10 text-primary': filterInKey }"
              @click="
                toggleFilterInKey();
                menuOpen = false;
              "
            >
              {{ t("chordDictionary.onlyChordsInKey") }}
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

    <div v-if="!disableUpdate" class="divider divider-horizontal mx-0"></div>

    <ChordSearch :on-select="handleChordSelect" />

    <div v-if="!disableUpdate" class="btn-group ml-2">
      <button
        class="btn btn-sm"
        :class="interactiveMode === 'detect' ? 'btn-active' : 'btn-outline'"
        @click="handleToggleInteractive('detect')"
      >
        {{ t("chordDictionary.detect") }}
      </button>
      <button
        class="btn btn-sm"
        :class="interactiveMode === 'play' ? 'btn-active' : 'btn-outline'"
        @click="handleToggleInteractive('play')"
      >
        {{ t("chordDictionary.play") }}
      </button>
    </div>

    <div class="flex-1"></div>

    <SettingsButton
      :aria-label="t('chordDictionary.openDictionarySettings')"
      @click="settingsOpen = true"
    />

    <SettingsModal
      v-model="settingsOpen"
      :title="t('chordDictionary.settings')"
    >
      <ChordDictionarySettings />
    </SettingsModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { SettingsButton } from "@/components/SettingsButton";
import { SettingsModal } from "@/components/SettingsModal";
import Icon from "@/components/Icon/Icon.vue";
import ChordSearch from "./ChordSearch/ChordSearch.vue";
import ChordDictionarySettings from "../Settings/ChordDictionarySettings/ChordDictionarySettings.vue";

interface Props {
  disableUpdate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disableUpdate: false,
});

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
