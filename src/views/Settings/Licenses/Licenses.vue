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
                <Icon name="github" :size="14" class="mr-1" />
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
import Icon from "@/components/Icon/Icon.vue";

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
