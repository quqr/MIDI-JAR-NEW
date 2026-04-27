<template>
  <div class="badge badge-outline gap-2 bg-base-200 border-base-300">
    <span class="text-xs" :title="t('layout.averageRoutingLatency')">
      {{ currentLatency.toFixed(3) }}ms
    </span>
    <div class="divider divider-horizontal mx-1"></div>
    <button
      class="btn btn-ghost btn-xs text-warning"
      :title="t('layout.highestRoutingLatency')"
      @click="resetHighest"
    >
      {{ highestLatency.toFixed(3) }}ms
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useMidiLatency } from "@/composables/useMidiLatency";

const { t } = useI18n();
const { currentLatency, highestLatency, resetHighest } = useMidiLatency();
</script>
