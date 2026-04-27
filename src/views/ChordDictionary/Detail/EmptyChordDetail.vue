<template>
  <div class="flex flex-col items-center justify-center h-full py-16">
    <div class="card bg-base-100 shadow-lg max-w-md p-8 text-center">
      <div class="mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-16 mx-auto text-base-content/30"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.125 1.125 0 01-1.313-.684l-.194-.698a2.25 2.25 0 00-2.02-1.632H6.553a2.25 2.25 0 01-2.163-1.632l-.377-1.313a1.125 1.125 0 01.684-1.313l.698-.194a2.25 2.25 0 001.632-2.02V6.553a2.25 2.25 0 011.632-2.163l1.313-.377a1.125 1.125 0 011.313.684l.194.698a2.25 2.25 0 002.02 1.632h2.947a2.25 2.25 0 012.163 1.632l.377 1.313a1.125 1.125 0 01-.684 1.313l-.698.194z"
          />
        </svg>
      </div>
      <h3 class="text-lg font-semibold mb-2" v-if="!chordName">
        {{ t("chordDictionary.emptyTitle") }}
      </h3>
      <p class="text-base-content/70 mb-4">
        {{
          chordName
            ? t("chordDictionary.cannotFindChord", { chordName })
            : t("chordDictionary.emptyHelp")
        }}
      </p>
      <div v-if="!chordName" class="flex flex-col gap-2 text-sm text-base-content/60">
        <div class="flex items-center gap-2">
          <span class="badge badge-sm">1</span>
          <span>{{ t("chordDictionary.emptyHint1") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge badge-sm">2</span>
          <span>{{ t("chordDictionary.emptyHint2") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge badge-sm">3</span>
          <span>{{ t("chordDictionary.emptyHint3") }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

interface Props {
  chordName?: string;
}

defineProps<Props>();

const { t } = useI18n();
</script>
