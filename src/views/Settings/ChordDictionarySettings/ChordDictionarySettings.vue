<template>
  <SettingsSection
    :show-reset="true"
    :on-reset="() => settingsStore.resetSetting('chordDictionary')"
  >
    <SettingsCollapse
      :title="t('settings.chordDictionarySettings.browse')"
      icon="gamepad"
      :default-open="true"
    >
      <SettingsRadioGroup
        :model-value="settingsStore.settings.chordDictionary.interactive"
        :label="t('settings.chordDictionarySettings.interactive')"
        :description="t('settings.chordDictionarySettings.interactiveHint')"
        :options="interactiveOptions"
        @update:model-value="
          settingsStore.updateSetting('chordDictionary.interactive', $event)
        "
      />
      <SettingsRadioGroup
        :model-value="settingsStore.settings.chordDictionary.groupBy"
        :label="t('settings.chordDictionarySettings.groupChords')"
        :options="groupByOptions"
        @update:model-value="
          settingsStore.updateSetting('chordDictionary.groupBy', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.chordDictionary.hideDisabled"
        :label="t('settings.chordDictionarySettings.hideDisabledChords')"
        @update:model-value="
          settingsStore.updateSetting('chordDictionary.hideDisabled', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.chordDictionary.filterInKey"
        :label="t('settings.chordDictionarySettings.filterChordsInKey')"
        :description="
          t('settings.chordDictionarySettings.filterChordsInKeyHint')
        "
        @update:model-value="
          settingsStore.updateSetting('chordDictionary.filterInKey', $event)
        "
      />
    </SettingsCollapse>

    <SettingsCollapse
      :title="t('settings.chordDictionarySettings.disabledChords')"
      icon="cross"
      :default-open="false"
    >
      <ul class="space-y-2">
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
          <span class="text-sm text-base-content/60">
            {{ t("settings.chordDictionarySettings.noDisabledChords") }}
          </span>
        </li>
      </ul>
    </SettingsCollapse>

    <SettingsCollapse
      :title="t('settings.chordDictionarySettings.preferredNotation')"
      icon="book"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="settingsStore.settings.chordDictionary.defaultNotation"
        :label="t('settings.chordDictionarySettings.defaultNotation')"
        :options="defaultNotationOptions"
        :description="t('settings.chordDictionarySettings.defaultNotationHint')"
        @update:model-value="
          settingsStore.updateSetting('chordDictionary.defaultNotation', $event)
        "
      />
      <ul class="space-y-2 mt-3">
        <li
          v-for="[chordType, alias] in settingsStore.settings.chordDictionary
            .aliases"
          :key="chordType"
          class="flex items-center justify-between p-2 rounded-lg bg-base-200/50"
        >
          <div class="flex items-center gap-2">
            <code class="text-sm bg-base-200 px-2 py-0.5 rounded">{{
              chordType
            }}</code>
            <Icon name="angle-right" size="14" />
            <code class="text-sm bg-base-200 px-2 py-0.5 rounded">{{
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
          <span class="text-sm text-base-content/60">
            {{ t("settings.chordDictionarySettings.noPreferredAliases") }}
          </span>
        </li>
      </ul>
    </SettingsCollapse>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/components/Icon/Icon.vue";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRadioGroup,
  SettingsSection,
} from "@/components/Settings";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const interactiveOptions = computed(() => [
  { label: t("chordDictionary.detect"), value: "detect" },
  { label: t("chordDictionary.play"), value: "play" },
]);

const groupByOptions = computed(() => [
  {
    label: t("settings.chordDictionarySettings.noGroup"),
    value: "none",
    hint: t("settings.chordDictionarySettings.noGroupHint"),
  },
  {
    label: t("settings.chordDictionarySettings.byQuality"),
    value: "quality",
    hint: t("settings.chordDictionarySettings.byQualityHint"),
  },
  {
    label: t("settings.chordDictionarySettings.byInterval"),
    value: "intervals",
    hint: t("settings.chordDictionarySettings.byIntervalHint"),
  },
]);

const defaultNotationOptions = computed(() => [
  { label: t("settings.notationOptions.long"), value: "long" },
  { label: t("settings.notationOptions.short"), value: "short" },
  { label: t("settings.notationOptions.symbol"), value: "symbol" },
]);

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
