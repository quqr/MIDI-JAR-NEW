<template>
  <div class="sticky bottom-0 z-40 bg-base-200 shadow-md px-3 py-2">
    <div class="flex flex-wrap items-center justify-center gap-3">
      <!-- 快速调性切换工具栏 -->
      <QuickChangeKeyToolbar class="flex-shrink-0" />
      <!-- MIDI 延迟监控器 -->
      <LatencyMonitor class="flex-shrink-0" />
      <span
        v-if="midiDevices.length === 0"
        class="midi-device midi-device--empty"
      >
        {{ $t("topBar.noMidiDevices") }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 导入底部栏子组件
import QuickChangeKeyToolbar from "./QuickChangeKeyToolbar.vue";
import LatencyMonitor from "./LatencyMonitor.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useMidiRoutingStore } from "@/stores/midiRouting";

const { t } = useI18n();
const routingStore = useMidiRoutingStore();
const midiDevices = computed(() => {
  const devices: Array<{
    id: string;
    name: string;
    shortName: string;
    active: boolean;
  }> = [];

  routingStore.inputs.forEach((input: any) => {
    devices.push({
      id: `input-${input.id}`,
      name: `${t("topBar.midiInput")}: ${input.name}`,
      shortName:
        input.name.length > 12 ? input.name.slice(0, 10) + "…" : input.name,
      active: true,
    });
  });

  routingStore.outputs.forEach((output: any) => {
    devices.push({
      id: `output-${output.id}`,
      name: `${t("topBar.midiOutput")}: ${output.name}`,
      shortName:
        output.name.length > 12 ? output.name.slice(0, 10) + "…" : output.name,
      active: true,
    });
  });

  return devices;
});
</script>
