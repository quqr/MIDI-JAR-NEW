<template>
  <SettingsSection>
    <div class="grid grid-cols-1 gap-4 m-4">
      <!-- 缓存管理：高级调试页唯一保留的功能 -->
      <CacheManagementSection v-model:open="cacheOpen" />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { SettingsSection } from "@/components/Settings";
import CacheManagementSection from "./sections/CacheManagementSection.vue";

const cacheOpen = ref(true);
</script>
