<template>
  <div class="relative inline-block">
    <button class="btn btn-sm btn-outline" @click="menuOpen = !menuOpen">
      <Icon
        name="search"
        class="w-4 h-4 mr-1"
        :size="16"
      />
      <span class="truncate">
        {{ search || t("chordDictionary.searchChord") }}
      </span>
    </button>

    <div
      v-show="menuOpen"
      class="absolute top-full left-0 z-50 mt-1 card bg-base-100 shadow-xl w-72"
    >
      <div class="card-body p-3 pb-2">
        <div class="form-control w-full">
          <div class="relative">
            <Icon
              name="search"
              class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50"
              :size="16"
            />
            <input
              v-model="search"
              type="text"
              class="input input-bordered input-sm w-full pl-9"
              :placeholder="t('chordDictionary.typeChord')"
              :aria-label="t('chordDictionary.typeChord')"
              autofocus
            />
            <button
              v-if="search"
              class="btn btn-xs btn-ghost btn-circle absolute right-1 top-1/2 -translate-y-1/2"
              @click="search = ''"
            >
              <Icon
                name="x"
                class="w-3 h-3"
                :size="12"
              />
            </button>
          </div>
        </div>
      </div>

      <div class="divider my-0"></div>

      <ul class="menu bg-base-100 w-full max-h-72 overflow-y-auto p-0">
        <li class="menu-title">
          <span>
            {{
              search
                ? t("chordDictionary.matches")
                : t("chordDictionary.previousChords")
            }}
          </span>
        </li>

        <template v-if="search">
          <ChordSearchOption
            v-for="option in searchResults"
            :key="option.chord.tonic + option.chord.aliases[0]"
            :chord="option.chord"
            :parts="option.parts"
            @select="handleSelect"
          />
          <li
            v-if="!searchResults.length"
            class="text-base-content/50 text-sm px-3 py-2"
          >
            {{ t("chordDictionary.noChordsFound") }}
          </li>
        </template>

        <template v-else>
          <ChordSearchOption
            v-for="chord in previousChords"
            :key="chord.tonic + chord.aliases[0]"
            :chord="chord"
            @select="handleSelect"
          />
          <li
            v-if="!previousChords.length"
            class="text-base-content/50 text-sm px-3 py-2"
          >
            {{ t("chordDictionary.noChordsInHistory") }}
          </li>
        </template>
      </ul>
    </div>

    <div
      v-show="menuOpen"
      class="fixed inset-0 z-40"
      @click="menuOpen = false"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { Chord } from "tonal";
import type { Chord as TChord } from "@tonaljs/chord";
import { isSameChord } from "@/helpers";
import { searchChords } from "./utils";
import ChordSearchOption from "./ChordSearchOption.vue";
import Icon from "@/components/Icon/Icon.vue";

interface Props {
  onSelect: (value: string | null) => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

const search = ref("");
const previousChords = ref<TChord[]>([]);
const menuOpen = ref(false);

const searchResults = computed(() => searchChords(search.value));

function handleSelect(val: string | null) {
  if (val) {
    props.onSelect(val);
    const chord = Chord.get(val);
    const existingIndex = previousChords.value.findIndex((c) =>
      isSameChord(c, chord),
    );
    if (existingIndex >= 0) {
      previousChords.value.splice(existingIndex, 1);
    }
    previousChords.value.unshift(chord);
    if (previousChords.value.length > 10) {
      previousChords.value = previousChords.value.slice(0, 10);
    }
  }
  menuOpen.value = false;
}
</script>
