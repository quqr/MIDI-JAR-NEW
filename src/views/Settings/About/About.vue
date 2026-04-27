<template>
  <div class="max-w-7xl mx-auto px-4 py-4 space-y-6">
    <div class="card bg-base-100 shadow-sm w-full">
      <div class="card-body items-center text-center p-6">
        <img class="w-24" :src="logoSrc" alt="" />
        <h1 class="text-2xl font-bold inline-flex items-center gap-2">
          MIDI Jar
          <span class="badge badge-primary">{{ `v${APP_VERSION}` }}</span>
        </h1>
        <p class="text-base-content/70">
          {{ t("settings.aboutSettings.byAuthor") }}
          <a
            href="https://ljas.fr"
            target="_blank"
            rel="noreferrer"
            class="text-primary hover:underline"
          >
            {{ t("settings.aboutSettings.laJarreASon") }}
          </a>
        </p>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm w-full">
      <div class="card-body p-6">
        <p class="text-base-content/70">
          {{ t("settings.aboutSettings.windowsNote") }}
          <a
            href="https://www.tobias-erichsen.de/software/loopmidi.html"
            target="_blank"
            rel="noreferrer"
            class="text-primary hover:underline"
          >
            {{ t("settings.aboutSettings.loopMidi") }}
          </a>
          {{ t("settings.aboutSettings.loopMidiNote") }}
        </p>
        <div class="card-actions justify-end mt-4">
          <a
            target="_blank"
            rel="noreferrer"
            href="https://www.tobias-erichsen.de/software/loopmidi.html"
            class="btn btn-outline"
          >
            <Icon name="midi" size="16" />
            {{ t("settings.aboutSettings.downloadLoopMidi") }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

const { t } = useI18n();
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.0.0";
const logoSrc = "/src/assets/logo.svg";
</script>
