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
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
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
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path :d="getIconPath(icon)" />
            </svg>
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
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </RouterLink>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";

defineProps<{
  to: string;
  settingsTo?: string;
  thumbnail: string;
  title: string;
  icon: string;
  overlayEnabled?: boolean;
  overlayUrl?: string;
}>();

const iconPaths: Record<string, string> = {
  "mdi-piano":
    "M2 8V20h20V8H2zm2 0h3v5H4V8zm5 0h3v5H9V8zm5 0h3v5h-3V8zm5 0h3v5h-3V8z",
  "mdi-help-circle-outline":
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
  "mdi-circle-outline":
    "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
  "mdi-book-open-page-variant":
    "M21 4H3a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM4 6h7v12H4V6zm9 0h7v12h-7V6z",
  "mdi-swap-horizontal": "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
  "mdi-bug":
    "M12 22c4.97 0 9-2.69 9-6v-2c0-3.31-4.03-6-9-6s-9 2.69-9 6v2c0 3.31 4.03 6 9 6zM12 8V2m-3 2l3-2 3 2M7 10l-3 2m16 0l-3-2M8 16l-4 2m16 0l-4-2",
  "mdi-cog":
    "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
  "mdi-layers": "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
};

function getIconPath(name: string): string {
  return iconPaths[name] || iconPaths["mdi-circle-outline"];
}
</script>
