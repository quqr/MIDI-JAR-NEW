<template>
  <div class="breadcrumbs text-sm">
    <ul>
      <li>
        <RouterLink
          v-if="home.active"
          :to="home.to"
          class="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium"
        >
          <Icon v-if="home.icon" :name="home.icon" size="16" />
          <span class="truncate max-w-xs" :title="home.title">{{
            home.title
          }}</span>
        </RouterLink>
        <RouterLink
          v-else
          :to="home.to"
          class="flex items-center gap-1 px-2 py-1 rounded-lg text-base-content hover:bg-base-200 transition-colors"
        >
          <Icon v-if="home.icon" :name="home.icon" size="16" />
          <span class="truncate max-w-xs" :title="home.title">{{
            home.title
          }}</span>
        </RouterLink>
      </li>
      <li v-for="(crumb, index) in breadcrumbs" :key="index">
        <RouterLink
          v-if="!crumb.active"
          :to="crumb.to"
          class="flex items-center gap-1 px-2 py-1 rounded-lg text-base-content hover:bg-base-200 transition-colors"
        >
          <Icon v-if="crumb.icon" :name="crumb.icon" size="16" />
          <span class="truncate max-w-xs" :title="crumb.title">{{
            crumb.title
          }}</span>
        </RouterLink>
        <span
          v-else
          class="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium"
        >
          <Icon v-if="crumb.icon" :name="crumb.icon" size="16" />
          <span class="truncate max-w-xs" :title="crumb.title">{{
            crumb.title
          }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import type { IconName } from "@/components/Icon/types";

interface Crumb {
  title: string;
  icon?: IconName;
  to: string;
  active: boolean;
}

const route = useRoute();
const { t } = useI18n();

const home = computed<Crumb>(() => {
  return {
    title: "Home",
    icon: "home",
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
    const icon = meta.icon as IconName | undefined;

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
</script>
