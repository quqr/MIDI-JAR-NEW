<template>
  <div class="py-2.5">
    <label v-if="label" class="text-sm block mb-2">{{ label }}</label>
    <div class="grid grid-cols-8 gap-1.5">
      <button
        v-for="option in themeColors"
        :key="option.value"
        type="button"
        class="group relative w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
        :class="
          modelValue === option.value
            ? 'border-primary ring-2 ring-primary/30'
            : 'border-base-300'
        "
        :style="{ backgroundColor: `var(--color-${option.value})` }"
        :title="option.label"
        :aria-label="option.label"
        @click="$emit('update:modelValue', option.value)"
      >
        <Icon
          v-if="modelValue === option.value"
          name="check"
          class="absolute inset-0 m-auto w-3 h-3"
          :class="isLightColor(option.value) ? 'text-black' : 'text-white'"
          :size="12"
        />
      </button>
    </div>
    <div v-if="selectedLabel" class="text-xs text-base-content/60 mt-1.5">
      {{ selectedLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

interface ThemeColorOption {
  value: string;
  label: string;
}

interface Props {
  modelValue: string;
  label?: string;
  options?: ThemeColorOption[];
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  options: () => [],
});

defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();

const defaultThemeColors: ThemeColorOption[] = [
  {
    value: "primary",
    label: t("settings.cursorSettings.themeColorOptions.primary"),
  },
  {
    value: "primary-content",
    label: t("settings.cursorSettings.themeColorOptions.primaryContent"),
  },
  {
    value: "secondary",
    label: t("settings.cursorSettings.themeColorOptions.secondary"),
  },
  {
    value: "secondary-content",
    label: t("settings.cursorSettings.themeColorOptions.secondaryContent"),
  },
  {
    value: "accent",
    label: t("settings.cursorSettings.themeColorOptions.accent"),
  },
  {
    value: "accent-content",
    label: t("settings.cursorSettings.themeColorOptions.accentContent"),
  },
  {
    value: "neutral",
    label: t("settings.cursorSettings.themeColorOptions.neutral"),
  },
  {
    value: "neutral-content",
    label: t("settings.cursorSettings.themeColorOptions.neutralContent"),
  },
  {
    value: "base-100",
    label: t("settings.cursorSettings.themeColorOptions.base100"),
  },
  {
    value: "base-200",
    label: t("settings.cursorSettings.themeColorOptions.base200"),
  },
  {
    value: "base-300",
    label: t("settings.cursorSettings.themeColorOptions.base300"),
  },
  {
    value: "base-content",
    label: t("settings.cursorSettings.themeColorOptions.baseContent"),
  },
  { value: "info", label: t("settings.cursorSettings.themeColorOptions.info") },
  {
    value: "success",
    label: t("settings.cursorSettings.themeColorOptions.success"),
  },
  {
    value: "warning",
    label: t("settings.cursorSettings.themeColorOptions.warning"),
  },
  {
    value: "error",
    label: t("settings.cursorSettings.themeColorOptions.error"),
  },
];

const themeColors = computed(() =>
  props.options.length > 0 ? props.options : defaultThemeColors,
);

const selectedLabel = computed(() => {
  const found = themeColors.value.find((c) => c.value === props.modelValue);
  return found ? found.label : "";
});

const lightColors = new Set([
  "primary-content",
  "secondary-content",
  "accent-content",
  "neutral-content",
  "base-100",
  "base-200",
  "base-content",
]);

function isLightColor(value: string): boolean {
  return lightColors.has(value);
}
</script>
