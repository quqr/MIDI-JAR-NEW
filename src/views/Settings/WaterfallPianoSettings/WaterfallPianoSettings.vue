<template>
  <SettingsSection :show-reset="false">
    <SettingsPanel />
  </SettingsSection>
</template>

<script setup lang="ts">
import { SettingsSection } from "@/components/Settings";
import SettingsPanel from "@/views/WaterfallPiano/components/SettingsPanel.vue";
</script>
