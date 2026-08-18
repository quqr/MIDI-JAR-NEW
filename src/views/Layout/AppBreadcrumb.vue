<template>
  <nav class="breadcrumbs text-sm max-w-full" aria-label="Breadcrumb">
    <ul class="max-w-full">
      <li v-for="(crumb, index) in allCrumbs" :key="crumb.to + index">
        <RouterLink
          v-if="!crumb.active"
          :to="crumb.to"
          class="flex items-center gap-1 max-w-[180px]"
        >
          <Icon v-if="crumb.icon" :name="mapMdiToIcon(crumb.icon)" :size="14" />
          <span class="truncate">{{ crumb.title }}</span>
        </RouterLink>
        <span
          v-else
          class="flex items-center gap-1 max-w-[200px]"
          aria-current="page"
        >
          <Icon v-if="crumb.icon" :name="mapMdiToIcon(crumb.icon)" :size="14" />
          <span class="truncate">{{ crumb.title }}</span>
        </span>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import type { IconName } from "@/components/Icon/types";

interface Crumb {
  title: string;
  icon?: string;
  to: string;
  active: boolean;
}

const route = useRoute();
const { t } = useI18n();

const MDI_TO_ICON: Record<string, string> = {
  "mdi-home": "home",
  "mdi-music-note": "music",
  "mdi-piano": "piano",
  "mdi-dictionary": "dictionary",
  "mdi-settings": "settings",
};

function mapMdiToIcon(mdiName: string): IconName {
  return (MDI_TO_ICON[mdiName] || "home") as IconName;
}

const allCrumbs = computed<Crumb[]>(() => {
  const result: Crumb[] = [];

  result.push({
    title: t("nav.home"),
    icon: "mdi-home",
    to: "/home",
    active: route.path === "/home" || route.path === "/",
  });

  const matched = route.matched;
  for (let i = 1; i < matched.length; i++) {
    const record = matched[i];
    const meta = record.meta as Record<string, unknown>;
    const rawTitle = meta.title as string | undefined;
    const icon = meta.icon as string | undefined;

    if (!rawTitle) continue;

    let title: string;
    if (rawTitle.includes(".")) {
      title = t(rawTitle, { moduleId: route.params.moduleId as string });
    } else {
      title = rawTitle;
    }

    const fullPath = resolveFullPath(matched, i);

    const isLast = i === matched.length - 1;

    result.push({
      title,
      icon: icon ? `mdi-${icon}` : undefined,
      to: fullPath,
      active: isLast,
    });
  }

  if (result.length > 0) {
    result[result.length - 1].active = true;
    for (let i = 0; i < result.length - 1; i++) {
      result[i].active = false;
    }
  }

  return result;
});

function resolveFullPath(
  matched: typeof route.matched,
  upToIndex: number,
): string {
  let path = "";
  for (let j = 0; j <= upToIndex; j++) {
    const seg = matched[j].path;
    if (j === 0) {
      path = seg === "/" ? "" : seg;
    } else {
      if (seg.startsWith("/")) {
        path = seg;
      } else {
        path += (path && !path.endsWith("/") ? "/" : "") + seg;
      }
    }
  }

  if (route.params && Object.keys(route.params).length > 0) {
    for (const [key, value] of Object.entries(route.params)) {
      const paramValue = Array.isArray(value) ? value[0] : value;
      if (paramValue !== undefined) {
        path = path.replace(`:${key}`, paramValue);
      }
    }
  }

  return path || "/";
}
</script>
