<template>
  <SettingsSection :show-reset="true" :on-reset="() => store.resetSettings()">
    <div class="grid grid-cols-1 gap-hig-4 m-4">
      <ParticlesSection
        :settings="settings.particles"
        @update="(key, value) => store.updateSetting('particles', key, value)"
      />
      <AuraSection
        :settings="settings.aura"
        @update="(key, value) => store.updateSetting('aura', key, value)"
      />
      <BackgroundSection
        :settings="settings.background"
        @update="(key, value) => store.updateSetting('background', key, value)"
      />
      <FluidAdvancedSection
        :fluid-params="settings.background.fluidParams"
        @update="
          (key, value) =>
            store.updateSetting('background', 'fluidParams', {
              ...settings.background.fluidParams,
              [key]: value,
            })
        "
      />
      <EffectsSection
        :settings="settings.effects"
        @update="(key, value) => store.updateSetting('effects', key, value)"
      />
      <KeyboardSection
        :settings="settings.keyboard"
        @update="(key, value) => store.updateSetting('keyboard', key, value)"
      />
      <MidiFileSection
        :settings="settings.midiFile"
        @update="(key, value) => store.updateSetting('midiFile', key, value)"
      />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWaterfallPianoStore } from "../stores/WaterfallPiano";
import { SettingsSection } from "@/components/Settings";
import ParticlesSection from "./sections/ParticlesSection.vue";
import AuraSection from "./sections/AuraSection.vue";
import BackgroundSection from "./sections/BackgroundSection.vue";
import FluidAdvancedSection from "./sections/FluidAdvancedSection.vue";
import EffectsSection from "./sections/EffectsSection.vue";
import KeyboardSection from "./sections/KeyboardSection.vue";
import MidiFileSection from "./sections/MidiFileSection.vue";

const store = useWaterfallPianoStore();
const settings = computed(() => store.settings);
</script>
