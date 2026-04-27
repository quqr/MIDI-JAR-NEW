<template>
  <div class="breadcrumbs text-sm">
    <ul>
      <li>
        <RouterLink
          v-if="home.active"
          :to="home.to"
          class="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          <span class="truncate max-w-xs" :title="home.title">{{ home.title }}</span>
        </RouterLink>
        <RouterLink
          v-else
          :to="home.to"
          class="flex items-center gap-1 px-2 py-1 rounded-lg text-base-content hover:bg-base-200 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          <span class="truncate max-w-xs" :title="home.title">{{ home.title }}</span>
        </RouterLink>
      </li>
      <li v-for="(crumb, index) in breadcrumbs" :key="index">
        <RouterLink
          v-if="!crumb.active"
          :to="crumb.to"
          class="flex items-center gap-1 px-2 py-1 rounded-lg text-base-content hover:bg-base-200 transition-colors"
        >
          <svg
            v-if="crumb.icon"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path :d="getIconPath(crumb.icon)" />
          </svg>
          <span class="truncate max-w-xs" :title="crumb.title">{{ crumb.title }}</span>
        </RouterLink>
        <span
          v-else
          class="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium"
        >
          <svg
            v-if="crumb.icon"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path :d="getIconPath(crumb.icon)" />
          </svg>
          <span class="truncate max-w-xs" :title="crumb.title">{{ crumb.title }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";

interface Crumb {
  title: string;
  icon?: string;
  to: string;
  active: boolean;
}

const route = useRoute();
const { t } = useI18n();

const home = computed<Crumb>(() => {
  return {
    title: "Home",
    icon: "mdi-home",
    to: "/home",
    active: route.path === "/home" || route.path === "/",
  };
});

const breadcrumbs = computed<Crumb[]>(() => {
  const matched = route.matched;
  const result: Crumb[] = [];

  for (let i = 0; i < matched.length; i++) {
    const record = matched[i];
    const meta = record.meta as Record<string, unknown>;
    const rawTitle = meta.title as string | undefined;
    const icon = meta.icon as string | undefined;

    if (!rawTitle) continue;
    if (i === 0) continue;

    let title: string;
    if (rawTitle.includes(".")) {
      title = t(rawTitle, { moduleId: route.params.moduleId as string });
    } else {
      title = rawTitle;
    }

    const fullPath = (() => {
      let accumulated = "";
      for (let j = 0; j <= i; j++) {
        const seg = matched[j].path;
        if (j === 0) {
          accumulated = seg === "/" ? "" : seg;
        } else {
          accumulated += (seg.startsWith("/") ? "" : "/") + seg;
        }
      }
      return accumulated || "/";
    })();

    result.push({
      title,
      icon,
      to: fullPath,
      active: i === matched.length - 1,
    });
  }

  return result;
});

const getIconPath = (icon: string): string => {
  const iconPaths: Record<string, string> = {
    "mdi-home": "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    "mdi-music-note":
      "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  };
  return iconPaths[icon] || iconPaths["mdi-home"];
};
</script>
