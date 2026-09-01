<template>
  <div
    v-if="open"
    class="fixed inset-0 z-modal flex items-center justify-center bg-black/50"
  >
    <div class="card bg-base-100 shadow-xl w-full max-w-sm rounded-xl">
      <div class="card-body p-6">
        <h2 class="card-title text-base font-bold">
          {{ t("settings.chordDisplaySettings.newModule") }}
        </h2>
        <div class="fieldset w-full py-4">
          <label class="label">
            <span class="fieldset-legend">{{ t("common.name") }}</span>
          </label>
          <input
            type="text"
            class="input input w-full rounded-lg"
            :class="errors.name ? 'input-error' : ''"
            :value="name"
            @input="name = ($event.target as HTMLInputElement).value"
          />
          <label v-if="errors.name" class="label">
            <span class="label text-error">{{ errors.name }}</span>
          </label>
        </div>
        <div class="card-actions justify-end">
          <button class="btn btn-ghost" @click="$emit('cancel')">
            {{ t("common.cancel") }}
          </button>
          <button class="btn btn-success" @click="handleSave">
            {{ t("common.add") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { FieldError } from "./utils";

const { t } = useI18n();

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  save: [name: string];
}>();

const name = ref("");
const errors = ref<Record<string, string>>({});

watch(
  () => props.open,
  (val) => {
    if (!val) {
      name.value = "";
      errors.value = {};
    }
  },
);

const handleSave = () => {
  emit("save", name.value);
};

defineExpose({
  handleSaveError(err: unknown) {
    if (err instanceof FieldError) {
      // FieldError 携带 i18n key（如 cannotBeEmpty），在展示层翻译
      errors.value = Object.fromEntries(
        Object.entries(err.fields).map(([field, key]) => [
          field,
          t(`settings.chordDisplaySettings.${key}`),
        ]),
      );
    }
  },
});
</script>
