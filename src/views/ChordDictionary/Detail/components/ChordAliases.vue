<template>
  <div v-if="chord" class="w-full mb-4">
    <details class="collapse collapse-arrow bg-base-200 rounded-lg" open>
      <summary
        class="collapse-title text-sm font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
      >
        {{ t("chordDictionary.aliases") }}
      </summary>
      <div class="collapse-content pt-0 px-2">
        <ul class="w-full">
          <li
            v-for="(alias, index) in chord.aliases"
            :key="index"
            class="flex items-center justify-between px-3 py-1.5 hover:bg-base-300 rounded-lg text-sm"
            :class="{
              'border-l-[3px] border-l-warning bg-base-300': isPreferred(index),
              'border-l-[3px] border-l-info bg-base-200':
                isDefault(index) && !isPreferred(index),
            }"
          >
            <div class="flex items-center gap-2">
              <span
                v-if="isPreferred(index)"
                class="badge badge-warning badge-xs mr-1"
              >
                {{ t("chordDictionary.preferredNotation") }}
              </span>
              <span
                v-else-if="isDefault(index)"
                class="badge badge-info badge-xs mr-1"
              >
                {{ t("chordDictionary.defaultNotation") }}
              </span>
              <span
                v-else-if="index < notationLabels.length"
                class="badge badge-ghost badge-xs mr-1"
              >
                {{ notationLabels[index] }}
              </span>
              <ChordName :chord="chord" :notation="index" />
            </div>
            <button
              class="btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom"
              :class="
                isPreferred(index) || isDefault(index) ? 'text-warning' : ''
              "
              :data-tip="
                isPreferred(index)
                  ? t('chordDictionary.unsetAsPreferredAlias', { alias })
                  : t('chordDictionary.setAsPreferredAlias', { alias })
              "
              :aria-label="
                isPreferred(index)
                  ? t('chordDictionary.unsetAsPreferredAlias', { alias })
                  : t('chordDictionary.setAsPreferredAlias', { alias })
              "
              @click="toggleAlias(isPreferred(index), chord.aliases[index])"
            >
              <Icon
                name="star"
                size="14"
                :class="
                  isPreferred(index) || isDefault(index) ? 'fill-current' : ''
                "
              />
            </button>
          </li>
        </ul>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";
import ChordName from "@/components/ChordName/ChordName.vue";
import { useChordDetailContext } from "../composables/useChordDetail";

const { t, chord, notationLabels, isPreferred, isDefault, toggleAlias } =
  useChordDetailContext();
</script>
