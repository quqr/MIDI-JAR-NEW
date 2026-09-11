<template>
  <nav class="breadcrumbs text-sm w-max" :aria-label="t('common.breadcrumb')">
    <ul>
      <li v-for="(crumb, index) in allCrumbs" :key="crumb.to + index">
        <RouterLink
          v-if="!crumb.active"
          :to="crumb.to"
          class="flex items-center gap-1 whitespace-nowrap"
        >
          <Icon
            v-if="crumb.icon"
            :name="mapMdiToIcon(crumb.icon)"
            :size="14"
            class="shrink-0"
          />
          <span class="shrink-0 whitespace-nowrap">{{ crumb.title }}</span>
        </RouterLink>
        <span
          v-else
          class="flex items-center gap-1 whitespace-nowrap"
          aria-current="page"
        >
          <Icon
            v-if="crumb.icon"
            :name="mapMdiToIcon(crumb.icon)"
            :size="14"
            class="shrink-0"
          />
          <span class="shrink-0 whitespace-nowrap">{{ crumb.title }}</span>
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
  "mdi-circle-of-fifths": "circle-of-fifths",
  "mdi-lead-sheet": "lead-sheet",
  "mdi-metronome": "metronome",
  "mdi-plugin": "plugin",
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
/*
 * 空间策略（2026-09-10 第三轮，三层保险）：
 *  1. 模板 Utility：nav 加 w-max（width: max-content）—— 面包屑永远按内容
 *     取宽，不参与任何收缩/百分比解析；
 *  2. 本 scoped 规则：抹掉 daisyUI 的 max-width: 100%（flex 链条里百分比
 *     宽度可能被引擎按可用空间解析 → 明明有富余也被压窄）；
 *  3. AppNavbar：面包屑容器 shrink-0 + min-w-max，唯一 flex-1 是拖拽占位。
 * overflow-x: clip 兜底：窗口物理放不下时裁尾、不出滚动条。
 * 不要在条目上写 max-width / truncate —— 有空间也会截成省略号。
 */
nav.breadcrumbs {
  overflow-x: clip;
  max-width: none;
}
</style>
