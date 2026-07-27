<template>
  <div class="key-switcher-wrapper">
    <button
      type="button"
      class="key-switcher-btn"
      :aria-label="t('settings.notationSettings.key')"
      :aria-expanded="dropdownOpen"
      :title="t('settings.notationSettings.key')"
      @click="dropdownOpen = !dropdownOpen"
    >
      <Icon name="music" :size="14" aria-hidden="true" />
      <span class="key-switcher-label">{{ currentKeyLabel }}</span>
      <Icon
        name="chevron-down"
        :size="12"
        class="key-switcher-chevron"
        aria-hidden="true"
      />
    </button>

    <Transition name="key-dropdown">
      <div v-if="dropdownOpen" class="key-switcher-dropdown">
        <ul class="key-switcher-list">
          <li v-for="choice in keyChoices" :key="choice.value">
            <button
              type="button"
              class="key-switcher-item"
              :class="{ 'is-selected': keySignature === choice.value }"
              @click="selectKey(choice.value)"
            >
              {{ choice.title }}
            </button>
          </li>
        </ul>
      </div>
    </Transition>

    <div
      v-if="dropdownOpen"
      class="key-switcher-overlay"
      @click="dropdownOpen = false"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/components/Icon/Icon.vue";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const dropdownOpen = ref(false);

const keySignature = computed({
  get: () => settingsStore.settings.notation.key,
  set: (value: string) => settingsStore.updateSetting("notation.key", value),
});

const keyChoices = computed(() => [
  { title: t("settings.notationSettings.keySignatures.C"), value: "C" },
  { title: t("settings.notationSettings.keySignatures.G"), value: "G" },
  { title: t("settings.notationSettings.keySignatures.D"), value: "D" },
  { title: t("settings.notationSettings.keySignatures.A"), value: "A" },
  { title: t("settings.notationSettings.keySignatures.E"), value: "E" },
  { title: t("settings.notationSettings.keySignatures.B"), value: "B" },
  { title: t("settings.notationSettings.keySignatures.F#"), value: "F#" },
  { title: t("settings.notationSettings.keySignatures.Db"), value: "Db" },
  { title: t("settings.notationSettings.keySignatures.Ab"), value: "Ab" },
  { title: t("settings.notationSettings.keySignatures.Eb"), value: "Eb" },
  { title: t("settings.notationSettings.keySignatures.Bb"), value: "Bb" },
  { title: t("settings.notationSettings.keySignatures.F"), value: "F" },
]);

const currentKeyLabel = computed(() => {
  const match = keyChoices.value.find((c) => c.value === keySignature.value);
  return match ? match.title : keySignature.value;
});

function selectKey(value: string) {
  keySignature.value = value;
  dropdownOpen.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && dropdownOpen.value) {
    dropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<style scoped>
.key-switcher-wrapper {
  position: relative;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.key-switcher-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 28px;
  padding: 0 0.5rem;
  border-radius: var(--radius-hig-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-base-content);
  background-color: color-mix(
    in oklch,
    var(--color-base-content) 6%,
    transparent
  );
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 10%, transparent);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color var(--hig-duration-fast) var(--ease-hig-standard),
    border-color var(--hig-duration-fast) var(--ease-hig-standard);
}

.key-switcher-btn:hover {
  background-color: color-mix(
    in oklch,
    var(--color-primary) 8%,
    var(--color-base-content) 6%,
    transparent
  );
  border-color: color-mix(
    in oklch,
    var(--color-primary) 30%,
    var(--color-base-content) 10%,
    transparent
  );
}

.key-switcher-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px
    color-mix(in oklch, var(--color-primary) 40%, transparent);
}

.key-switcher-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.key-switcher-chevron {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
  flex-shrink: 0;
}

.key-switcher-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: var(--z-index-dropdown);
  min-width: 140px;
  padding: 4px;
  border-radius: var(--radius-hig-md);
  background-color: var(--color-base-100);
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 10%, transparent);
  box-shadow: 0 4px 12px
    color-mix(in oklch, var(--color-base-content) 12%, transparent);
  max-height: 320px;
  overflow-y: auto;
}

.key-switcher-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.key-switcher-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-hig-sm);
  font-size: 0.8125rem;
  color: var(--color-base-content);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--hig-duration-fast) var(--ease-hig-standard);
}

.key-switcher-item:hover {
  background-color: color-mix(
    in oklch,
    var(--color-base-content) 8%,
    transparent
  );
}

.key-switcher-item.is-selected {
  color: var(--color-primary);
  background-color: color-mix(in oklch, var(--color-primary) 10%, transparent);
  font-weight: 600;
}

.key-switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-overlay);
}

/* Dropdown transition */
.key-dropdown-enter-active,
.key-dropdown-leave-active {
  transition:
    opacity var(--hig-duration-fast) var(--ease-hig-standard),
    transform var(--hig-duration-fast) var(--ease-hig-standard);
}

.key-dropdown-enter-from,
.key-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .key-switcher-label {
    max-width: 60px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .key-dropdown-enter-active,
  .key-dropdown-leave-active {
    transition: none;
  }
}
</style>
