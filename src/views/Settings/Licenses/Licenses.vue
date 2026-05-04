<template>
  <div class="h-full flex flex-col gap-4 p-4">
    <h1 class="text-xl font-bold uppercase mb-4">
      {{ t("settings.licenses.title") || "Licenses" }}
    </h1>
    <div v-if="loading" class="flex items-center justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <template v-else>
      <input
        v-model="search"
        type="text"
        placeholder="Search packages..."
        class="input input-bordered input-sm w-full"
      />
      <div v-if="filteredPackages.length === 0" class="alert alert-info">
        No license packages found
      </div>
      <div v-else class="flex flex-col gap-2 overflow-y-auto flex-1">
        <div
          v-for="pkg in filteredPackages"
          :key="pkg.id"
          class="collapse collapse-arrow bg-base-200/50"
        >
          <input
            type="checkbox"
            :checked="openId === pkg.id"
            @change="toggleOpen(pkg.id)"
          />
          <div class="collapse-title">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <span class="font-semibold">{{ pkg.name }}</span>
              <div class="flex items-center gap-2">
                <span class="badge badge-sm">{{ pkg.license }}</span>
                <span class="text-sm opacity-60">{{ pkg.version }}</span>
              </div>
              <a
                v-if="pkg.url"
                :href="pkg.url"
                target="_blank"
                rel="noreferrer"
                class="btn btn-xs btn-ghost ml-auto"
                @click.stop
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="mr-1"
                >
                  <path
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 2.945 1.084.855-.239 1.775-.358 2.694-.362.919.004 1.839.123 2.694.362 1.937-1.406 2.945-1.084 2.945-1.084.652 1.652.241 2.873.117 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                  />
                </svg>
                GitHub
              </a>
            </div>
          </div>
          <div class="collapse-content" v-if="openId === pkg.id">
            <pre
              class="text-xs bg-base-300 rounded p-4 whitespace-pre-wrap overflow-auto max-h-60"
              >{{ pkg.text }}</pre
            >
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { logger } from "@/utils/logger";

const { t } = useI18n();

type Package = {
  id: string;
  name: string;
  version: string;
  url?: string;
  license: string;
  text: string;
};

const packages = ref<Package[]>([]);
const loading = ref(true);
const search = ref("");
const openId = ref<string | null>(null);

const filteredPackages = computed(() => {
  const q = search.value.toLowerCase();
  return packages.value
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.license.toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
});

const toggleOpen = (id: string) => {
  openId.value = openId.value === id ? null : id;
};

onMounted(async () => {
  try {
    const res = await fetch("/licenses.json");
    packages.value = await res.json();
  } catch (e) {
    logger.error("Failed to load licenses: " + e);
  } finally {
    loading.value = false;
  }
});
</script>
