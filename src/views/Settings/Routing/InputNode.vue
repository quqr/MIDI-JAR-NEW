<template>
  <div class="midi-input-node" :class="{ 'midi-input-node--active': isActive }">
    <div>
      <span>{{ data.label }}</span>
    </div>
    <Handle type="source" :position="Position.Right" class="handle-source" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";
import { useMidiActivity } from "@/composables/useMidiActivity";

const props = defineProps<NodeProps>();

const { isActive } = useMidiActivity(props.data.label as string);
</script>
