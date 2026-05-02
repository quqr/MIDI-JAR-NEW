<template>
  <RouterLink
    :to="to"
    class="module-card-link block h-full rounded-box transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    role="link"
    :aria-label="title"
  >
    <div
      class="card bg-base-100 border border-base-200 h-full group transition-colors hover:border-primary/50 hover:shadow-md"
    >
      <div class="card-body p-5 gap-4">
        <div class="flex items-start gap-4 w-full">
          <div
            class="icon-wrapper flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-content group-hover:scale-110 flex-shrink-0"
            aria-hidden="true"
          >
            <svg
              class="w-7 h-7"
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

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-lg font-semibold text-base-content truncate">
                {{ title }}
              </h3>

              <RouterLink
                v-if="settingsTo"
                :to="settingsTo"
                class="btn btn-ghost btn-xs btn-circle opacity-60 transition-all duration-300 group-hover:opacity-100 hover:bg-primary/10 flex-shrink-0"
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
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import { getIconPath } from "@/constants/icon-paths";

defineProps<{
  to: string;
  settingsTo?: string;
  title: string;
  description?: string;
  icon: string;
}>();
</script>
