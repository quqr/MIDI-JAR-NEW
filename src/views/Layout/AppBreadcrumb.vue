<template>
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <ol class="breadcrumb-nav__list">
      <li
        v-for="(crumb, index) in allCrumbs"
        :key="crumb.to + index"
        class="breadcrumb-nav__item"
        :class="{ 'breadcrumb-nav__item--active': crumb.active }"
      >
        <span
          v-if="index > 0"
          class="breadcrumb-nav__separator"
          aria-hidden="true"
        >
          <Icon name="angle-right" :size="12" />
        </span>
        <RouterLink
          v-if="!crumb.active"
          :to="crumb.to"
          class="breadcrumb-nav__link"
        >
          <Icon v-if="crumb.icon" :name="mapMdiToIcon(crumb.icon)" :size="14" />
          <span class="breadcrumb-nav__text">{{ crumb.title }}</span>
        </RouterLink>
        <span v-else class="breadcrumb-nav__current" aria-current="page">
          <Icon v-if="crumb.icon" :name="mapMdiToIcon(crumb.icon)" :size="14" />
          <span class="breadcrumb-nav__text">{{ crumb.title }}</span>
        </span>
      </li>
    </ol>
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

<style scoped>
.breadcrumb-nav {
  display: flex;
  align-items: center;
  min-width: 0;
}

.breadcrumb-nav__list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.breadcrumb-nav__item {
  display: flex;
  align-items: center;
  min-width: 0;
  flex-shrink: 0;
}

.breadcrumb-nav__item:last-child {
  flex-shrink: 1;
  min-width: 0;
}

.breadcrumb-nav__separator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: oklch(var(--bc) / 0.3);
  margin: 0 2px;
  flex-shrink: 0;
}

.breadcrumb-nav__link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: oklch(var(--bc) / 0.7);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color 0.15s,
    color 0.15s;
  min-width: 0;
}

.breadcrumb-nav__link:hover {
  background-color: oklch(var(--b2));
  color: oklch(var(--bc));
}

.breadcrumb-nav__current {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: oklch(var(--p));
  background-color: oklch(var(--p) / 0.1);
  white-space: nowrap;
  min-width: 0;
}

.breadcrumb-nav__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.breadcrumb-nav__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.breadcrumb-nav__item:not(:last-child) .breadcrumb-nav__text {
  max-width: 120px;
}

.breadcrumb-nav__item:last-child .breadcrumb-nav__text {
  max-width: 200px;
}

@media (max-width: 768px) {
  .breadcrumb-nav__item:not(:last-child) .breadcrumb-nav__text {
    max-width: 60px;
  }

  .breadcrumb-nav__item:last-child .breadcrumb-nav__text {
    max-width: 120px;
  }

  .breadcrumb-nav__link,
  .breadcrumb-nav__current {
    padding: 3px 6px;
    font-size: 0.75rem;
  }

  .breadcrumb-nav__separator {
    margin: 0 1px;
  }

  .breadcrumb-nav__icon {
    width: 12px;
    height: 12px;
  }
}

@media (max-width: 480px) {
  .breadcrumb-nav__item:not(:first-child):not(:last-child) {
    display: none;
  }

  .breadcrumb-nav__item:not(:last-child) .breadcrumb-nav__text {
    max-width: 40px;
  }

  .breadcrumb-nav__item:last-child .breadcrumb-nav__text {
    max-width: 80px;
  }
}
</style>
