<template>
  <div class="chord-dictionary-chord-menu h-full">
    <ul
      class="menu bg-base-100 w-full rounded-lg p-0"
      role="navigation"
      :aria-label="t('chordDictionary.chordTypesNavigation')"
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
</script>
