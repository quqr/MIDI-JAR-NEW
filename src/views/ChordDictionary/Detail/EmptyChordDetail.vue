<template>
  <div class="flex flex-col items-center justify-center h-full py-16">
    <div
      class="card bg-base-100 border border-base-300 max-w-md p-8 text-center"
      style="box-shadow: var(--shadow-hig-md)"
    >
      <div class="mb-6">
        <Icon
          name="music"
          class="size-16 mx-auto text-base-content/70"
          :size="64"
        />
      </div>
      <h3 class="text-hig-lg font-semibold mb-2" v-if="!chordName">
        {{ t("chordDictionary.emptyTitle") }}
      </h3>
      <p class="text-base-content/70 mb-4 text-hig-base">
        {{
          chordName
            ? t("chordDictionary.cannotFindChord", { chordName })
            : t("chordDictionary.emptyHelp")
        }}
      </p>
      <div
        v-if="!chordName"
        class="flex flex-col gap-2 text-hig-sm text-base-content/70"
      >
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
import Icon from "@/components/Icon/Icon.vue";

interface Props {
  chordName?: string;
}

defineProps<Props>();

const { t } = useI18n();
</script>
