<template>
  <div class="Home min-h-screen bg-base-200">
    <div class="max-w-7xl mx-auto px-page-x sm:px-6 lg:px-8 py-page">
      <h1 class="sr-only">{{ $t("nav.home") }}</h1>
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-base-content/80 mb-4 px-1">
          {{ $t("home.coreFeatures") }}
        </h2>
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <ModuleCard
            v-for="module in settingsStore.settings.chordDisplay"
            :key="`chord-display/${module.id}`"
            :to="`/chords/${module.id}`"
            :settings-to="`/settings/chords/${module.id}`"
            :thumbnail="thumbnailChordDisplay"
            :title="$t('nav.chordDisplayWithId', { moduleId: module.id })"
            :description="$t('home.chordDisplayPreview')"
            icon="piano"
            :overlay-enabled="overlayEnabled"
            :overlay-url="getOverlayUrl(`/chords/${module.id}`)"
          />
          <ModuleCard
            to="/quiz"
            settings-to="/settings/quiz"
            :thumbnail="thumbnailChordQuiz"
            :title="$t('nav.chordQuiz')"
            :description="$t('home.chordQuizPreview')"
            icon="help-circle"
            :overlay-enabled="overlayEnabled"
            :overlay-url="getOverlayUrl('/quiz')"
          />
          <ModuleCard
            to="/circle-of-fifths"
            settings-to="/settings/circle-of-fifths"
            :thumbnail="thumbnailCircleOfFifths"
            :title="$t('nav.circleOfFifths')"
            :description="$t('home.circleOfFifthsPreview')"
            icon="circle"
            :overlay-enabled="overlayEnabled"
            :overlay-url="getOverlayUrl('/circle-of-fifths')"
          />
          <ModuleCard
            to="/chord-dictionary"
            settings-to="/settings/chord-dictionary"
            :thumbnail="thumbnailChordDictionary"
            :title="$t('nav.chordDictionary')"
            :description="$t('home.chordDictionaryPreview')"
            icon="book"
            :overlay-enabled="overlayEnabled"
            :overlay-url="getOverlayUrl('/chord-dictionary')"
          />
        </div>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-base-content/80 mb-4 px-1">
          {{ $t("home.tools") }}
        </h2>
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <ModuleCard
            to="/settings/routing"
            settings-to="/settings/routing"
            :thumbnail="thumbnailRouting"
            :title="$t('nav.routing')"
            icon="swap"
          />
          <ModuleCard
            to="/settings/debug"
            settings-to="/settings/debug"
            :thumbnail="thumbnailDebugger"
            :title="$t('nav.debugger')"
            icon="bug"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore, useServerStateStore } from "@/stores";
import thumbnailChordDisplay from "@/assets/thumbnails/chord-display.jpg";
import thumbnailChordQuiz from "@/assets/thumbnails/chord-quiz.jpg";
import thumbnailCircleOfFifths from "@/assets/thumbnails/circle-of-fifths.jpg";
import thumbnailChordDictionary from "@/assets/thumbnails/chord-dictionary.jpg";
import thumbnailRouting from "@/assets/thumbnails/routing.jpg";
import thumbnailDebugger from "@/assets/thumbnails/debugger.jpg";
import ModuleCard from "./components/ModuleCard.vue";

const settingsStore = useSettingsStore();
const serverStateStore = useServerStateStore();

const state = computed(() => serverStateStore.state);

const overlayEnabled = computed(() => {
  const s = state.value;
  return s.started && s.addresses.length > 0;
});

function getOverlayUrl(path: string): string {
  const s = state.value;
  return `http://${s.addresses[0]}:${s.port}${path}`;
}
</script>
