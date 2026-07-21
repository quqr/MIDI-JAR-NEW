<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.sound.title')"
    icon="speaker"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
  >
    <!-- 基础参数 -->
    <SettingsRange
      :model-value="soundSettings.volume"
      :label="t('advancedDebug.sound.volume')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="emit('updateSound', 'volume', $event)"
    />
    <SettingsRange
      :model-value="soundSettings.reverbAmount"
      :label="t('advancedDebug.sound.reverbAmount')"
      :description="t('advancedDebug.sound.reverbAmountHint')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="emit('updateSound', 'reverbAmount', $event)"
    />
    <SettingsRange
      :model-value="soundSettings.reverbDecay"
      :label="t('advancedDebug.sound.reverbDecay')"
      :min="0.5"
      :max="8"
      :step="0.5"
      @update:model-value="emit('updateSound', 'reverbDecay', $event)"
    />
    <SettingsToggle
      :model-value="soundSettings.sustain"
      :label="t('advancedDebug.sound.sustain')"
      @update:model-value="emit('updateSound', 'sustain', $event)"
    />
    <SettingsToggle
      :model-value="soundSettings.velocitySensitivity"
      :label="t('advancedDebug.sound.velocitySensitivity')"
      @update:model-value="emit('updateSound', 'velocitySensitivity', $event)"
    />

    <!-- 合成器参数 -->
    <div class="divider text-xs text-base-content/50">
      {{ t("advancedDebug.sound.synthParams") }}
    </div>

    <SettingsRange
      :model-value="soundSettings.harmonicity"
      :label="t('advancedDebug.sound.harmonicity')"
      :min="0.5"
      :max="10"
      :step="0.5"
      @update:model-value="emit('updateSound', 'harmonicity', $event)"
    />
    <SettingsRange
      :model-value="soundSettings.modulationIndex"
      :label="t('advancedDebug.sound.modulationIndex')"
      :min="1"
      :max="50"
      :step="1"
      @update:model-value="emit('updateSound', 'modulationIndex', $event)"
    />
    <SettingsSelect
      :model-value="soundSettings.oscillatorType"
      :label="t('advancedDebug.sound.oscillatorType')"
      :options="oscillatorTypeOptions"
      @update:model-value="emit('updateSound', 'oscillatorType', $event)"
    />

    <!-- 包络参数 -->
    <div class="divider text-xs text-base-content/50">
      {{ t("advancedDebug.sound.envelope") }}
    </div>

    <SettingsRange
      :model-value="soundSettings.envelope.attack"
      :label="t('advancedDebug.sound.attack')"
      :min="0.001"
      :max="1"
      :step="0.001"
      @update:model-value="emit('updateEnvelope', 'envelope', 'attack', $event)"
    />
    <SettingsRange
      :model-value="soundSettings.envelope.decay"
      :label="t('advancedDebug.sound.decay')"
      :min="0.01"
      :max="2"
      :step="0.01"
      @update:model-value="emit('updateEnvelope', 'envelope', 'decay', $event)"
    />
    <SettingsRange
      :model-value="soundSettings.envelope.sustain"
      :label="t('advancedDebug.sound.sustainLevel')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('updateEnvelope', 'envelope', 'sustain', $event)
      "
    />
    <SettingsRange
      :model-value="soundSettings.envelope.release"
      :label="t('advancedDebug.sound.release')"
      :min="0.01"
      :max="5"
      :step="0.01"
      @update:model-value="
        emit('updateEnvelope', 'envelope', 'release', $event)
      "
    />

    <!-- 调制包络参数 -->
    <div class="divider text-xs text-base-content/50">
      {{ t("advancedDebug.sound.modEnvelope") }}
    </div>

    <SettingsRange
      :model-value="soundSettings.modulationEnvelope.attack"
      :label="t('advancedDebug.sound.modAttack')"
      :min="0.001"
      :max="1"
      :step="0.001"
      @update:model-value="
        emit('updateEnvelope', 'modulationEnvelope', 'attack', $event)
      "
    />
    <SettingsRange
      :model-value="soundSettings.modulationEnvelope.decay"
      :label="t('advancedDebug.sound.modDecay')"
      :min="0.01"
      :max="2"
      :step="0.01"
      @update:model-value="
        emit('updateEnvelope', 'modulationEnvelope', 'decay', $event)
      "
    />
    <SettingsRange
      :model-value="soundSettings.modulationEnvelope.sustain"
      :label="t('advancedDebug.sound.modSustain')"
      :min="0"
      :max="1"
      :step="0.05"
      @update:model-value="
        emit('updateEnvelope', 'modulationEnvelope', 'sustain', $event)
      "
    />
    <SettingsRange
      :model-value="soundSettings.modulationEnvelope.release"
      :label="t('advancedDebug.sound.modRelease')"
      :min="0.01"
      :max="5"
      :step="0.01"
      @update:model-value="
        emit('updateEnvelope', 'modulationEnvelope', 'release', $event)
      "
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsRange,
  SettingsSelect,
  SettingsToggle,
} from "@/components/Settings";

interface EnvelopeSettings {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface SoundSettings {
  volume: number;
  reverbAmount: number;
  reverbDecay: number;
  sustain: boolean;
  velocitySensitivity: boolean;
  harmonicity: number;
  modulationIndex: number;
  oscillatorType: string;
  envelope: EnvelopeSettings;
  modulationEnvelope: EnvelopeSettings;
}

interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  soundSettings: SoundSettings;
  oscillatorTypeOptions: SelectOption[];
  open?: boolean;
  sectionId?: string;
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "updateSound", key: string, value: unknown): void;
  (
    e: "updateEnvelope",
    envType: "envelope" | "modulationEnvelope",
    key: string,
    value: number,
  ): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.sound.title").toLowerCase().includes(q);
});

const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});
</script>
