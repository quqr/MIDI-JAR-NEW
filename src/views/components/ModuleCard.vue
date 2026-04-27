<template>
  <RouterLink
    :to="to"
    class="module-card-link block h-full rounded-box transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    role="link"
    :aria-label="title"
  >
    <div
      class="card bg-base-100 border border-base-200 h-full overflow-hidden group transition-colors hover:border-primary/30 hover:shadow-md"
    >
      <figure class="relative aspect-video overflow-hidden">
        <img
          :src="thumbnail"
          :alt="title"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div
          v-if="overlayEnabled"
          class="absolute inset-x-0 top-0 p-2.5 bg-gradient-to-b from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <a
            :href="overlayUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-sm btn-primary bg-primary/90 backdrop-blur-sm border-none shadow-md hover:bg-primary transition-all"
            @click.stop
            aria-label="Open overlay in new tab"
          >
            <Icon name="overlay" size="16" />
            {{ $t("common.overlay") }}
          </a>
        </div>
      </figure>

      <div class="card-body p-4 gap-3">
        <div class="flex items-center gap-3 w-full">
          <div
            class="icon-wrapper flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-content group-hover:rotate-12 group-hover:scale-110 flex-shrink-0"
            aria-hidden="true"
          >
            <Icon :name="icon" size="20" />
          </div>

          <h3 class="flex-1 text-base font-semibold text-base-content truncate">
            {{ title }}
          </h3>

          <RouterLink
            v-if="settingsTo"
            :to="settingsTo"
            class="btn btn-ghost btn-xs btn-circle opacity-60 transition-all duration-300 group-hover:opacity-100 hover:bg-primary/10"
            :aria-label="$t('common.settings')"
            @click.stop
          >
            <Icon name="settings" size="16" />
          </RouterLink>
        </div>
        <p v-if="description" class="text-xs text-base-content/80 line-clamp-2">{{ description }}</p>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import Icon from "@/components/Icon/Icon.vue";
import type { IconName } from "@/components/Icon/types";

defineProps<{
  to: string;
  settingsTo?: string;
  thumbnail: string;
  title: string;
  description?: string;
  icon: IconName;
  overlayEnabled?: boolean;
  overlayUrl?: string;
}>();
</script>
