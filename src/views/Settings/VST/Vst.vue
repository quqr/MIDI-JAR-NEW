<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('settings.vstSettings.general')"
        icon="plugin"
        :default-open="true"
      >
      </SettingsCollapse>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsSection } from "@/components/Settings";

const { t } = useI18n();
</script>
