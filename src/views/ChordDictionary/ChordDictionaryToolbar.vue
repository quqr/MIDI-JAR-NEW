<template>
  <div
    class="chord-dictionary-toolbar flex items-center gap-2 p-2 border-b border-base-200 bg-base-100 flex-wrap"
  >
    <div v-if="!disableUpdate" class="relative inline-block">
      <button
        class="btn btn-sm btn-outline"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        {{ getGroupLabel(groupBy)
        }}{{ filterInKey ? t("chordDictionary.inKey") : "" }}
        <Icon name="chevron-down" size="16" />
      </button>

      <div
        v-show="menuOpen"
        class="absolute top-full left-0 z-50 mt-1 card bg-base-100 shadow-xl min-w-[250px]"
        @keydown.escape="menuOpen = false"
      >
        <ul role="menu" class="menu bg-base-100 w-full p-0">
          <li class="menu-title">
            <span>{{ t("chordDictionary.group") }}</span>
          </li>
          <li>
            <a
              role="menuitem"
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
              role="menuitem"
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
              role="menuitem"
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
              role="menuitem"
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
              role="menuitem"
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

    <button
      ref="settingsBtnRef"
      class="btn btn-sm btn-outline btn-circle"
      :aria-label="t('chordDictionary.openDictionarySettings')"
      @click="settingsOpen = true"
    >
      <Icon name="settings" size="16" />
    </button>

    <Transition name="modal">
      <div
        v-if="settingsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="settingsOpen = false"
      >
        <div
          ref="modalRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          class="card bg-base-100 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4"
          @keydown.tab="handleModalTab"
          @keydown.escape="settingsOpen = false"
        >
          <div
            class="card-title p-4 flex items-center justify-between border-b border-base-200"
          >
            <h2 id="settings-modal-title" class="text-lg font-bold">
              {{ t("chordDictionary.settings") }}
            </h2>
            <button
              class="btn btn-sm btn-ghost btn-circle"
              @click="settingsOpen = false"
            >
              <Icon name="x" size="16" />
            </button>
          </div>
          <div class="overflow-auto max-h-[calc(90vh-73px)]">
            <ChordDictionarySettings />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
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
const settingsBtnRef = ref<HTMLButtonElement | null>(null);
const modalRef = ref<HTMLDivElement | null>(null);

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
}

function handleModalTab(e: KeyboardEvent) {
  if (!modalRef.value) return;
  const focusable = getFocusableElements(modalRef.value);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

watch(settingsOpen, (open) => {
  if (open) {
    nextTick(() => {
      if (modalRef.value) {
        const focusable = getFocusableElements(modalRef.value);
        if (focusable.length > 0) focusable[0].focus();
      }
    });
  } else {
    nextTick(() => {
      settingsBtnRef.value?.focus();
    });
  }
});

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
