<template>
  <SettingsSection :show-reset="true" :on-reset="() => store.resetSettings()">
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsFieldGroup
        :fields="particlesGroup.fields"
        :model="settings.particles"
        :title-key="particlesGroup.titleKey"
        :icon="particlesGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('particles', key, value)"
      />
      <SettingsFieldGroup
        :fields="auraGroup.fields"
        :model="settings.aura"
        :title-key="auraGroup.titleKey"
        :icon="auraGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('aura', key, value)"
      />
      <SettingsFieldGroup
        :fields="backgroundGroup.fields"
        :model="settings.background"
        :title-key="backgroundGroup.titleKey"
        :icon="backgroundGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('background', key, value)"
      />
      <SettingsFieldGroup
        :fields="fluidAdvancedGroup.fields"
        :model="settings.background"
        :title-key="fluidAdvancedGroup.titleKey"
        :icon="fluidAdvancedGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('background', key, value)"
      />
      <SettingsFieldGroup
        :fields="effectsGroup.fields"
        :model="settings.effects"
        :title-key="effectsGroup.titleKey"
        :icon="effectsGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('effects', key, value)"
      />
      <SettingsFieldGroup
        :fields="keyboardGroup.fields"
        :model="settings.keyboard"
        :title-key="keyboardGroup.titleKey"
        :icon="keyboardGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('keyboard', key, value)"
      />
      <SettingsFieldGroup
        :fields="midiFileGroup.fields"
        :model="settings.midiFile"
        :title-key="midiFileGroup.titleKey"
        :icon="midiFileGroup.icon"
        i18n-prefix="WaterfallPiano"
        @update="(key, value) => updateSection('midiFile', key, value)"
      />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWaterfallPianoStore } from "../stores/WaterfallPiano";
import type { WaterfallPianoSettings } from "../types";
import { setValueByPath } from "@/helpers";
import { SettingsFieldGroup, SettingsSection } from "@/components/Settings";
import {
  particlesGroup,
  auraGroup,
  backgroundGroup,
  fluidAdvancedGroup,
  effectsGroup,
  keyboardGroup,
  midiFileGroup,
} from "../settingsSchema";

const store = useWaterfallPianoStore();
const settings = computed(() => store.settings);

type FieldValue = boolean | number | string | null | undefined;

/**
 * 字段写回：平铺 key 直写；点路径 key（如 "hitLine.color"、
 * "fluidParams.fluidSplatPerturbation.positionJitter"）浅拷贝外层对象后
 * 经 setValueByPath 深写入再整体写回，与迁移前各 section 的 spread 语义一致。
 */
function updateSection<K extends keyof WaterfallPianoSettings>(
  section: K,
  key: string,
  value: FieldValue,
): void {
  if (!key.includes(".")) {
    store.updateSetting(section, key as never, value);
    return;
  }
  const [outer, ...rest] = key.split(".");
  const base =
    (store.settings[section] as Record<string, unknown>)[outer] ?? {};
  const clone = structuredClone(base) as Record<string, unknown>;
  setValueByPath(clone, rest.join("."), value);
  store.updateSetting(section, outer as never, clone);
}
</script>
