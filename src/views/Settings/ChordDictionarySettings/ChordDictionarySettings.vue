<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsFieldGroup
        :fields="browseGroup.fields"
        :model="model"
        :title-key="browseGroup.titleKey"
        :icon="browseGroup.icon"
        i18n-prefix="settings.chordDictionarySettings"
        @update="update"
      />

      <SettingsCollapse
        :title="t('settings.chordDictionarySettings.disabledChords')"
        icon="cross"
        :default-open="true"
      >
        <ul class="flex flex-col gap-2">
          <li
            v-for="disabledChord in settingsStore.settings.chordDictionary
              .disabled"
            :key="disabledChord"
            class="flex items-center justify-between p-2 rounded-lg bg-base-200/50"
          >
            <span class="text-sm font-mono">{{ disabledChord }}</span>
            <div class="flex gap-1">
              <RouterLink
                :to="`/chord-dictionary/${encodeURIComponent(`C${disabledChord}`)}`"
                class="btn btn-sm btn-ghost btn-square"
              >
                <Icon name="dictionary" size="14" />
              </RouterLink>
              <button
                class="btn btn-sm btn-ghost btn-square text-error"
                @click="deleteDisabled(disabledChord)"
              >
                <Icon name="trash" size="14" />
              </button>
            </div>
          </li>
          <li v-if="!settingsStore.settings.chordDictionary.disabled.length">
            <span class="text-sm text-base-content/70">
              {{ t("settings.chordDictionarySettings.noDisabledChords") }}
            </span>
          </li>
        </ul>
      </SettingsCollapse>

      <SettingsFieldGroup
        :fields="preferredNotationGroup.fields"
        :model="model"
        :title-key="preferredNotationGroup.titleKey"
        :icon="preferredNotationGroup.icon"
        i18n-prefix="settings.chordDictionarySettings"
        @update="update"
      >
        <ul class="flex flex-col gap-2 mt-3">
          <li
            v-for="[chordType, alias] in settingsStore.settings.chordDictionary
              .aliases"
            :key="chordType"
            class="flex items-center justify-between p-2 rounded-lg bg-base-200/50"
          >
            <div class="flex items-center gap-2">
              <code class="text-sm bg-base-200 px-2 py-0.5 rounded-md">{{
                chordType
              }}</code>
              <Icon name="angle-right" size="14" />
              <code class="text-sm bg-base-200 px-2 py-0.5 rounded-md">{{
                alias
              }}</code>
            </div>
            <div class="flex gap-1">
              <RouterLink
                :to="`/chord-dictionary/${encodeURIComponent(`C${chordType}`)}`"
                class="btn btn-sm btn-ghost btn-square"
              >
                <Icon name="dictionary" size="14" />
              </RouterLink>
              <button
                class="btn btn-sm btn-ghost btn-square text-error"
                @click="deleteAlias(chordType)"
              >
                <Icon name="trash" size="14" />
              </button>
            </div>
          </li>
          <li v-if="!settingsStore.settings.chordDictionary.aliases.length">
            <span class="text-sm text-base-content/70">
              {{ t("settings.chordDictionarySettings.noPreferredAliases") }}
            </span>
          </li>
        </ul>
      </SettingsFieldGroup>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/components/Icon/Icon.vue";
import {
  SettingsCollapse,
  SettingsFieldGroup,
  SettingsSection,
} from "@/components/Settings";
import type { SettingsFieldModel } from "@/components/Settings/schema";
import { browseGroup, preferredNotationGroup } from "./schema";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const model = computed(
  () => settingsStore.settings.chordDictionary as unknown as SettingsFieldModel,
);

function update(key: string, value: boolean | number | string | null) {
  settingsStore.updateSetting(`chordDictionary.${key}`, value);
}

const deleteDisabled = (value: string) => {
  const disabledChords = settingsStore.settings.chordDictionary.disabled.filter(
    (c) => c !== value,
  );
  settingsStore.updateSetting("chordDictionary.disabled", disabledChords);
};

const deleteAlias = (value: string) => {
  const aliases = settingsStore.settings.chordDictionary.aliases.filter(
    ([chordType]) => chordType !== value,
  );
  settingsStore.updateSetting("chordDictionary.aliases", aliases);
};
</script>
