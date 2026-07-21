<template>
  <dialog
    :open="open"
    class="modal modal-bottom sm:modal-middle"
    @click.self="$emit('close')"
  >
    <div class="modal-box max-w-2xl">
      <header class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <Icon name="bookmark" :size="20" class="text-primary" />
          {{ t("advancedDebug.presets.title") }}
        </h3>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          @click="$emit('close')"
          :aria-label="t('common.close')"
        >
          <Icon name="x" :size="16" />
        </button>
      </header>

      <!-- 错误提示 -->
      <div v-if="error" class="alert alert-error alert-sm mb-4 py-2">
        <Icon name="alert-circle" :size="16" class="stroke-current" />
        <span class="text-sm">{{ error }}</span>
      </div>

      <!-- 保存当前配置 -->
      <section class="mb-5">
        <h4 class="text-sm font-semibold mb-2 text-base-content/70">
          {{ t("advancedDebug.presets.saveCurrent") }}
        </h4>
        <div class="flex gap-2">
          <input
            v-model="newName"
            type="text"
            class="input input-bordered input-sm flex-1"
            :placeholder="t('advancedDebug.presets.namePlaceholder')"
            :aria-label="t('advancedDebug.presets.namePlaceholder')"
            @keydown.enter="handleSave"
          />
          <button
            class="btn btn-sm btn-primary"
            :disabled="!newName.trim()"
            @click="handleSave"
          >
            <Icon name="plus" :size="14" />
            {{ t("advancedDebug.presets.save") }}
          </button>
        </div>
      </section>

      <!-- 预设列表 -->
      <section class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-semibold text-base-content/70">
            {{ t("advancedDebug.presets.list") }}
            <span class="badge badge-sm badge-ghost ml-1">
              {{ presets.length }}
            </span>
          </h4>
          <div class="flex gap-1">
            <button
              class="btn btn-xs btn-ghost"
              @click="handleExport"
              :disabled="presets.length === 0"
              :title="t('advancedDebug.presets.export')"
            >
              <Icon name="download" :size="14" />
              {{ t("advancedDebug.presets.export") }}
            </button>
            <label
              class="btn btn-xs btn-ghost cursor-pointer"
              :title="t('advancedDebug.presets.import')"
            >
              <Icon name="upload" :size="14" />
              {{ t("advancedDebug.presets.import") }}
              <input
                type="file"
                accept=".json"
                class="hidden"
                @change="handleImport"
              />
            </label>
          </div>
        </div>

        <div
          v-if="presets.length === 0"
          class="text-center py-8 text-base-content/40"
        >
          <Icon
            name="bookmark-outline"
            :size="32"
            class="mx-auto mb-2 opacity-50"
          />
          <p class="text-sm">{{ t("advancedDebug.presets.empty") }}</p>
        </div>

        <ul v-else class="space-y-2 max-h-72 overflow-y-auto pr-1">
          <li
            v-for="preset in presets"
            :key="preset.name"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-base-200/60 group"
          >
            <div class="flex-1 min-w-0">
              <div v-if="renamingName === preset.name" class="flex gap-1">
                <input
                  v-model="renameValue"
                  type="text"
                  class="input input-bordered input-xs flex-1"
                  @keydown.enter="confirmRename(preset.name)"
                  @keydown.esc="cancelRename"
                />
                <button
                  class="btn btn-xs btn-primary btn-square"
                  @click="confirmRename(preset.name)"
                >
                  <Icon name="check" :size="12" />
                </button>
                <button
                  class="btn btn-xs btn-ghost btn-square"
                  @click="cancelRename"
                >
                  <Icon name="x" :size="12" />
                </button>
              </div>
              <template v-else>
                <div class="text-sm font-medium truncate">
                  {{ preset.name }}
                </div>
                <div class="text-xs text-base-content/50">
                  {{ formatDate(preset.createdAt) }}
                  <span v-if="preset.description" class="ml-2">
                    · {{ preset.description }}
                  </span>
                </div>
              </template>
            </div>
            <div
              v-if="renamingName !== preset.name"
              class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                class="btn btn-xs btn-primary"
                @click="$emit('apply', preset.name)"
              >
                <Icon name="play" :size="12" />
                {{ t("advancedDebug.presets.apply") }}
              </button>
              <button
                class="btn btn-xs btn-ghost btn-square"
                @click="startRename(preset.name)"
                :title="t('advancedDebug.presets.rename')"
              >
                <Icon name="pencil" :size="12" />
              </button>
              <button
                class="btn btn-xs btn-ghost btn-square text-error"
                @click="handleDelete(preset.name)"
                :title="t('advancedDebug.presets.delete')"
              >
                <Icon name="trash" :size="12" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <footer class="modal-action">
        <button class="btn btn-sm btn-ghost" @click="$emit('close')">
          {{ t("common.close") }}
        </button>
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import type { AdvancedDebugPreset } from "../composables/useAdvancedDebugPresets";

interface Props {
  open: boolean;
  presets: AdvancedDebugPreset[];
  error: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", name: string): void;
  (e: "apply", name: string): void;
  (e: "rename", oldName: string, newName: string): void;
  (e: "delete", name: string): void;
  (e: "export"): void;
  (e: "import", file: File): void;
  (e: "clear-error"): void;
}>();

const { t } = useI18n();

const newName = ref("");
const renamingName = ref<string | null>(null);
const renameValue = ref("");

function handleSave(): void {
  const name = newName.value.trim();
  if (!name) return;
  emit("save", name);
  newName.value = "";
}

function startRename(name: string): void {
  renamingName.value = name;
  renameValue.value = name;
}

function confirmRename(oldName: string): void {
  const newName = renameValue.value.trim();
  if (newName && newName !== oldName) {
    emit("rename", oldName, newName);
  }
  cancelRename();
}

function cancelRename(): void {
  renamingName.value = null;
  renameValue.value = "";
}

function handleDelete(name: string): void {
  if (window.confirm(t("advancedDebug.presets.confirmDelete", { name }))) {
    emit("delete", name);
  }
}

function handleExport(): void {
  emit("export");
}

async function handleImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  emit("import", file);
  input.value = "";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
</script>
