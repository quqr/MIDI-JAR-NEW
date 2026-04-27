<script setup lang="ts">
import { useThemeStore, themes, addRecentTheme } from "@/stores/theme";
import { useToast } from "@/composables/useToast";

const themeStore = useThemeStore();
const { show } = useToast();

function handleThemeClick(themeName: string) {
  themeStore.setTheme(themeName);
  addRecentTheme(themeName);
  show(themeName, "success");
}
</script>

<template>
  <div
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
  >
    <div
      v-for="theme in themes"
      :key="theme.name"
      class="border-base-content/20 hover:border-base-content/40 overflow-hidden rounded-lg border outline-2 outline-offset-2 outline-transparent outline-base-content!"
      :class="{
        '!outline-base-content': theme.name === themeStore.currentTheme,
      }"
      :data-act-class="
        theme.name === themeStore.currentTheme ? '!outline-base-content' : ''
      "
      :data-set-theme="theme.name"
      @click="handleThemeClick(theme.name)"
    >
      <div
        :data-theme="theme.name"
        class="bg-base-100 text-base-content w-full cursor-pointer font-sans"
      >
        <div class="grid grid-cols-5 grid-rows-3">
          <div class="bg-base-200 col-start-1 row-span-2 row-start-1" />
          <div class="bg-base-300 col-start-1 row-start-3" />
          <div
            class="bg-base-100 col-span-4 col-start-2 row-span-3 row-start-1 flex flex-col gap-1 p-2"
          >
            <p class="font-bold capitalize" data-imt-p="1">
              {{ theme.name }}
            </p>
            <div class="flex flex-wrap gap-1">
              <div
                class="bg-primary flex aspect-square w-5 items-center justify-center rounded lg:w-6"
              >
                <span class="text-primary-content text-sm font-bold">A</span>
              </div>
              <div
                class="bg-secondary flex aspect-square w-5 items-center justify-center rounded lg:w-6"
              >
                <span class="text-secondary-content text-sm font-bold">A</span>
              </div>
              <div
                class="bg-accent flex aspect-square w-5 items-center justify-center rounded lg:w-6"
              >
                <span class="text-accent-content text-sm font-bold">A</span>
              </div>
              <div
                class="bg-neutral flex aspect-square w-5 items-center justify-center rounded lg:w-6"
              >
                <span class="text-neutral-content text-sm font-bold">A</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
