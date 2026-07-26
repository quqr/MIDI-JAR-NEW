<template>
  <div>
    <main>
      <section class="space-y-4 p-6">
        <MotionStaggerList
          once
          once-key="home-modules"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr"
        >
          <MotionListItem
            v-for="module in settingsStore.settings.chordDisplay"
            :key="`chord-display/${module.id}`"
          >
            <ModuleCard
              :to="`/chords/${module.id}`"
              :settings-to="`/settings/chords/${module.id}`"
              :title="$t('nav.chordDisplayWithId', { moduleId: module.id })"
              :description="$t('home.moduleDescriptions.chordDisplay')"
              icon="mdi-piano"
            />
          </MotionListItem>
          <MotionListItem>
            <ModuleCard
              to="/chord-dictionary"
              settings-to="/settings/chord-dictionary"
              :title="$t('nav.chordDictionary')"
              :description="$t('home.moduleDescriptions.chordDictionary')"
              icon="mdi-book-open-page-variant"
            />
          </MotionListItem>
          <MotionListItem>
            <ModuleCard
              to="/waterfall-piano"
              settings-to="/settings/waterfall-piano"
              :title="$t('nav.WaterfallPiano')"
              :description="$t('home.moduleDescriptions.WaterfallPiano')"
              icon="mdi-piano"
            />
          </MotionListItem>
          <MotionListItem>
            <ModuleCard
              to="/sampler"
              :title="$t('nav.Sampler')"
              :description="$t('home.moduleDescriptions.Sampler')"
              icon="mdi-music-note"
            />
          </MotionListItem>
          <MotionListItem>
            <ModuleCard
              to="/settings/routing"
              settings-to="/settings/routing"
              :title="$t('nav.routing')"
              :description="$t('home.moduleDescriptions.routing')"
              icon="mdi-swap-horizontal"
            />
          </MotionListItem>
          <MotionListItem>
            <ModuleCard
              to="/settings/debug"
              settings-to="/settings/debug"
              :title="$t('nav.debugger')"
              :description="$t('home.moduleDescriptions.debugger')"
              icon="mdi-bug"
            />
          </MotionListItem>
        </MotionStaggerList>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/stores";
import ModuleCard from "./components/ModuleCard.vue";
import { MotionStaggerList, MotionListItem } from "@/components/motion";

const settingsStore = useSettingsStore();
</script>
