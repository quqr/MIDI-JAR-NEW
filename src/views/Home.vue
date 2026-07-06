<template>
  <div>
    <main>
      <section class="space-y-4 p-4">
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr"
        >
          <ModuleCard
            v-for="module in settingsStore.settings.chordDisplay"
            :key="`chord-display/${module.id}`"
            :to="`/chords/${module.id}`"
            :settings-to="`/settings/chords/${module.id}`"
            :title="$t('nav.chordDisplayWithId', { moduleId: module.id })"
            :description="$t('home.moduleDescriptions.chordDisplay')"
            icon="mdi-piano"
          />
          <ModuleCard
            to="/waterfall-piano"
            :title="$t('nav.waterfallPiano')"
            :description="$t('home.moduleDescriptions.waterfallPiano')"
            icon="mdi-piano"
          />
          <ModuleCard
            to="/chord-dictionary"
            settings-to="/settings/chord-dictionary"
            :title="$t('nav.chordDictionary')"
            :description="$t('home.moduleDescriptions.chordDictionary')"
            icon="mdi-book-open-page-variant"
          />
          <ModuleCard
            to="/settings/routing"
            settings-to="/settings/routing"
            :title="$t('nav.routing')"
            :description="$t('home.moduleDescriptions.routing')"
            icon="mdi-swap-horizontal"
          />
          <ModuleCard
            to="/settings/debug"
            settings-to="/settings/debug"
            :title="$t('nav.debugger')"
            :description="$t('home.moduleDescriptions.debugger')"
            icon="mdi-bug"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/stores";
import ModuleCard from "./components/ModuleCard.vue";

const settingsStore = useSettingsStore();
</script>
