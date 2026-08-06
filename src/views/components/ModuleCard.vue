<template>
  <div class="h-full">
    <RouterLink
      :to="to"
      class="module-card-link block h-full rounded-box group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      role="link"
      :aria-label="title"
    >
      <div
        class="card bg-base-100 border border-base-300 h-full transition-[color,background-color,border-color,box-shadow] duration-hig-normal group-hover:border-primary/50 group-hover:shadow-[var(--shadow-hig-md)]"
      >
        <div class="card-body p-5 gap-4">
          <div class="flex items-start gap-4 w-full">
            <div
              class="icon-wrapper flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary transition-all duration-hig-normal group-hover:bg-primary group-hover:text-primary-content group-hover:scale-110 flex-shrink-0"
              aria-hidden="true"
            >
              <Icon :name="mapMdiToIcon(icon)" class="w-7 h-7" :size="28" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-lg font-semibold text-base-content truncate">
                  {{ title }}
                </h3>

                <RouterLink
                  v-if="settingsTo"
                  :to="settingsTo"
                  class="btn btn-ghost btn-sm btn-circle opacity-60 transition-all duration-hig-normal group-hover:opacity-100 hover:bg-primary/10 flex-shrink-0 tooltip tooltip-bottom"
                  :data-tip="$t('common.settings')"
                  :aria-label="$t('common.settings')"
                  @click.stop
                >
                  <Icon name="settings" :size="16" aria-hidden="true" />
                </RouterLink>
              </div>

              <p
                v-if="description"
                class="mt-2 text-sm text-base-content/70 line-clamp-2 leading-relaxed"
              >
                {{ description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import Icon from "@/components/Icon/Icon.vue";
import type { IconName } from "@/components/Icon/types";

defineProps<{
  to: string;
  settingsTo?: string;
  title: string;
  description?: string;
  icon: string;
}>();

const MDI_TO_ICON: Record<string, string> = {
  "mdi-piano": "piano",
  "mdi-help-circle-outline": "help-circle",
  "mdi-circle-outline": "circle",
  "mdi-book-open-page-variant": "book",
  "mdi-swap-horizontal": "swap",
  "mdi-bug": "bug",
};

function mapMdiToIcon(mdiName: string): IconName {
  return (MDI_TO_ICON[mdiName] || "home") as IconName;
}
</script>
