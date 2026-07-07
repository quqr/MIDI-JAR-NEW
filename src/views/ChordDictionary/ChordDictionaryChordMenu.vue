<template>
  <div class="chord-dictionary-chord-menu p-4 h-full">
    <ul
      class="menu bg-base-100"
      role="tree"
      :aria-label="t('chordDictionary.chordTypesNavigation')"
      @keydown="handleKeydown"
    >
      <template v-for="item in groups" :key="getItemKey(item)">
        <ChordMenuItem
          v-if="item.type === 'item'"
          :item="item"
          :selected="selected"
          @select="$emit('select', $event)"
        />
        <ChordMenuGroup
          v-else
          :group="item"
          :selected="selected"
          @select="$emit('select', $event)"
        />
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from "vue";
import { useI18n } from "vue-i18n";
import type { ChordDictionarySettings } from "@/types";
import type { KeySignatureConfig } from "@/helpers";
import { getChordGroups } from "./utils";
import type { ChordGroup, ChordItem } from "./utils";
import ChordMenuItem from "./ChordMenuItem.vue";
import ChordMenuGroup from "./ChordMenuGroup.vue";

interface Props {
  keySignature: KeySignatureConfig;
  selected: string | null;
  groupBy: ChordDictionarySettings["groupBy"];
  disabledChords: ChordDictionarySettings["disabled"];
  chroma: number | null;
  filterChordsInKey: boolean;
  hideDisabled: boolean;
}

interface Emits {
  (e: "select", note: string): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const { t } = useI18n();

const propsRefs = toRefs(props);

const groups = computed(() => {
  return getChordGroups(
    propsRefs.groupBy.value,
    propsRefs.keySignature.value,
    propsRefs.chroma.value,
    propsRefs.disabledChords.value,
    propsRefs.hideDisabled.value,
    propsRefs.filterChordsInKey.value,
  );
});

function getItemKey(item: ChordGroup | ChordItem): string {
  return item.type === "item" ? item.chordType.aliases[0] : item.value;
}

function getVisibleTreeitems(container: HTMLElement): HTMLElement[] {
  const all = Array.from(
    container.querySelectorAll<HTMLElement>('[role="treeitem"]'),
  );
  return all.filter((el) => {
    let parent = el.parentElement;
    while (parent && parent !== container) {
      if (parent.tagName === "DETAILS" && !parent.open) return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (!target || target.getAttribute("role") !== "treeitem") return;

  const container = e.currentTarget as HTMLElement;
  const items = getVisibleTreeitems(container);
  const currentIndex = items.indexOf(target);
  if (currentIndex === -1) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (currentIndex < items.length - 1) {
        items[currentIndex + 1].focus();
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (currentIndex > 0) {
        items[currentIndex - 1].focus();
      }
      break;
    case "ArrowRight": {
      e.preventDefault();
      if (target.tagName === "SUMMARY") {
        const details = target.closest("details");
        if (details && !details.open) {
          details.open = true;
          return;
        }
      }
      if (currentIndex < items.length - 1) {
        items[currentIndex + 1].focus();
      }
      break;
    }
    case "ArrowLeft": {
      e.preventDefault();
      if (target.tagName === "SUMMARY") {
        const details = target.closest("details");
        if (details && details.open) {
          details.open = false;
          return;
        }
      }
      let parent = target.parentElement;
      while (parent && parent !== container) {
        if (parent.tagName === "DETAILS") {
          const summary = parent.querySelector("summary");
          if (summary) {
            (summary as HTMLElement).focus();
            return;
          }
        }
        parent = parent.parentElement;
      }
      break;
    }
    case "Home":
      e.preventDefault();
      if (items.length > 0) items[0].focus();
      break;
    case "End":
      e.preventDefault();
      if (items.length > 0) items[items.length - 1].focus();
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      target.click();
      break;
  }
}
</script>
