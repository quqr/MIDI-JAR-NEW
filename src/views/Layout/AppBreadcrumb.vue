<template>
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <ol class="breadcrumb-nav__list">
      <li
        v-for="(crumb, index) in allCrumbs"
        :key="crumb.to + index"
        class="breadcrumb-nav__item"
        :class="{ 'breadcrumb-nav__item--active': crumb.active }"
      >
        <span v-if="index > 0" class="breadcrumb-nav__separator" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <RouterLink
          v-if="!crumb.active"
          :to="crumb.to"
          class="breadcrumb-nav__link"
        >
          <svg
            v-if="crumb.icon"
            class="breadcrumb-nav__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path :d="getIconPath(crumb.icon)" />
          </svg>
          <span class="breadcrumb-nav__text">{{ crumb.title }}</span>
        </RouterLink>
        <span v-else class="breadcrumb-nav__current" aria-current="page">
          <svg
            v-if="crumb.icon"
            class="breadcrumb-nav__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path :d="getIconPath(crumb.icon)" />
          </svg>
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

interface Crumb {
  title: string;
  icon?: string;
  to: string;
  active: boolean;
}

const route = useRoute();
const { t } = useI18n();

const ICON_PATHS: Record<string, string> = {
  "mdi-home":
    "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  "mdi-music-note":
    "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  "mdi-piano":
    "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  "mdi-circle-of-fifths":
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z",
  "mdi-quiz":
    "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
  "mdi-dictionary":
    "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  "mdi-settings":
    "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
};

const getIconPath = (icon: string): string => {
  return ICON_PATHS[icon] || ICON_PATHS["mdi-home"];
};

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

function resolveFullPath(matched: typeof route.matched, upToIndex: number): string {
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
  transition: background-color 0.15s, color 0.15s;
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
