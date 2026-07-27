<template>
  <!-- Inline mode: always-visible input field -->
  <div v-if="mode === 'inline'" class="relative" ref="containerRef">
    <div class="relative">
      <Icon
        name="search"
        class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/70 pointer-events-none"
        :size="16"
      />
      <input
        ref="inputRef"
        v-model="search"
        type="text"
        class="input input-sm input-bordered w-48 pl-8 pr-8 focus:w-64 transition-all duration-hig-fast"
        :placeholder="t('chordDictionary.searchChord')"
        :aria-label="t('chordDictionary.searchChord')"
        @focus="menuOpen = true"
        @keydown.escape="menuOpen = false"
        @keydown="handleKeydown"
      />
      <button
        v-if="search"
        class="btn btn-xs btn-ghost btn-circle absolute right-1 top-1/2 -translate-y-1/2 tooltip tooltip-bottom"
        :data-tip="t('common.clear')"
        tabindex="-1"
        @click="clearSearch"
      >
        <Icon name="x" class="w-3 h-3" :size="12" />
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="
          menuOpen && (searchResults.length || previousChords.length || search)
        "
        ref="dropdownRef"
        class="fixed z-dropdown card bg-base-100 shadow-xl w-72"
        :style="dropdownStyle"
      >
        <ul class="menu bg-base-100 w-full max-h-72 overflow-y-auto p-0">
          <li class="menu-title">
            <span>
              {{
                search
                  ? t("chordDictionary.matches")
                  : t("chordDictionary.previousChords")
              }}
            </span>
          </li>

          <template v-if="search">
            <ChordSearchOption
              v-for="(option, i) in searchResults"
              :key="option.chord.tonic + option.chord.aliases[0]"
              :chord="option.chord"
              :active="i === activeIndex"
              @select="handleSelect"
              @mouseenter.native="activeIndex = i"
            />
            <li
              v-if="!searchResults.length"
              class="text-base-content/70 text-hig-sm px-3 py-2"
            >
              {{ t("chordDictionary.noChordsFound") }}
            </li>
          </template>

          <template v-else>
            <ChordSearchOption
              v-for="(chord, i) in previousChords"
              :key="chord.tonic + chord.aliases[0]"
              :chord="chord"
              :active="i === activeIndex"
              @select="handleSelect"
              @mouseenter.native="activeIndex = i"
            />
            <li
              v-if="!previousChords.length"
              class="text-base-content/70 text-hig-sm px-3 py-2"
            >
              {{ t("chordDictionary.noChordsInHistory") }}
            </li>
          </template>
        </ul>
      </div>
    </Teleport>
  </div>

  <!-- Button mode: original popup button -->
  <div v-else class="relative inline-block">
    <button class="btn btn-sm btn-outline" @click="menuOpen = !menuOpen">
      <Icon name="search" class="w-4 h-4 mr-1" :size="16" />
      <span class="truncate">
        {{ search || t("chordDictionary.searchChord") }}
      </span>
    </button>

    <div
      v-show="menuOpen"
      class="absolute top-full left-0 z-dropdown mt-1 card bg-base-100 shadow-xl w-72"
    >
      <div class="card-body p-3 pb-2">
        <div class="form-control w-full">
          <div class="relative">
            <Icon
              name="search"
              class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/70"
              :size="16"
            />
            <input
              v-model="search"
              type="text"
              class="input input-bordered input-sm w-full pl-9"
              :placeholder="t('chordDictionary.typeChord')"
              :aria-label="t('chordDictionary.typeChord')"
              @keydown.escape="menuOpen = false"
              @keydown="handleKeydown"
              autofocus
            />
            <button
              v-if="search"
              class="btn btn-xs btn-ghost btn-circle absolute right-1 top-1/2 -translate-y-1/2 tooltip tooltip-bottom"
              :data-tip="t('common.clear')"
              @click="search = ''"
            >
              <Icon name="x" class="w-3 h-3" :size="12" />
            </button>
          </div>
        </div>
      </div>

      <div class="divider my-0"></div>

      <ul class="menu bg-base-100 w-full max-h-72 overflow-y-auto p-0">
        <li class="menu-title">
          <span>
            {{
              search
                ? t("chordDictionary.matches")
                : t("chordDictionary.previousChords")
            }}
          </span>
        </li>

        <template v-if="search">
          <ChordSearchOption
            v-for="(option, i) in searchResults"
            :key="option.chord.tonic + option.chord.aliases[0]"
            :chord="option.chord"
            :active="i === activeIndex"
            @select="handleSelect"
            @mouseenter.native="activeIndex = i"
          />
          <li
            v-if="!searchResults.length"
            class="text-base-content/70 text-hig-sm px-3 py-2"
          >
            {{ t("chordDictionary.noChordsFound") }}
          </li>
        </template>

        <template v-else>
          <ChordSearchOption
            v-for="(chord, i) in previousChords"
            :key="chord.tonic + chord.aliases[0]"
            :chord="chord"
            :active="i === activeIndex"
            @select="handleSelect"
            @mouseenter.native="activeIndex = i"
          />
          <li
            v-if="!previousChords.length"
            class="text-base-content/70 text-hig-sm px-3 py-2"
          >
            {{ t("chordDictionary.noChordsInHistory") }}
          </li>
        </template>
      </ul>
    </div>

    <div
      v-show="menuOpen"
      class="fixed inset-0 z-overlay"
      @click="menuOpen = false"
    ></div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { Chord } from "tonal";
import type { Chord as TChord } from "@tonaljs/chord";
import { isSameChord } from "@/helpers";
import { searchChords } from "./utils";
import ChordSearchOption from "./ChordSearchOption.vue";
import Icon from "@/components/Icon/Icon.vue";

interface Props {
  onSelect: (value: string | null) => void;
  mode?: "inline" | "button";
}

const props = withDefaults(defineProps<Props>(), {
  mode: "button",
});

const { t } = useI18n();

const search = ref("");
const previousChords = ref<TChord[]>([]);
const menuOpen = ref(false);
const activeIndex = ref(-1);
const inputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref<Record<string, string>>({});

const searchResults = computed(() => searchChords(search.value));

// 搜索结果变化时重置 active 到首项（标准搜索行为：首项默认 active）
watch(searchResults, () => {
  activeIndex.value = searchResults.value.length ? 0 : -1;
});

// menuOpen 打开时立即定位下拉（修复首次打开位置错乱）
watch(menuOpen, (open) => {
  if (open && props.mode === "inline") {
    nextTick(updateDropdownPosition);
  }
});

// activeIndex 变化时滚动到可见区（修复键盘导航时高亮项跑出视口）
watch(activeIndex, () => {
  if (activeIndex.value < 0) return;
  nextTick(() => {
    dropdownRef.value
      ?.querySelector("[data-active]")
      ?.scrollIntoView({ block: "nearest" });
  });
});

function updateDropdownPosition() {
  if (!containerRef.value || props.mode !== "inline") return;
  const rect = containerRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  };
}

function handleScrollResize() {
  if (menuOpen.value && props.mode === "inline") {
    updateDropdownPosition();
  }
}

function clearSearch() {
  search.value = "";
  nextTick(() => inputRef.value?.focus());
}

function handleKeydown(e: KeyboardEvent) {
  if (!menuOpen.value) return;
  const len = searchResults.value.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!len) return;
    // 不循环：到末项停止
    if (activeIndex.value < len - 1) activeIndex.value += 1;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!len) return;
    // 不循环：到首项停止
    if (activeIndex.value > 0) activeIndex.value -= 1;
  } else if (e.key === "Enter") {
    if (activeIndex.value >= 0 && activeIndex.value < len) {
      e.preventDefault();
      const opt = searchResults.value[activeIndex.value];
      handleSelect(opt.chord.tonic + opt.chord.aliases[0]);
    } else if (len > 0) {
      e.preventDefault();
      const first = searchResults.value[0];
      handleSelect(first.chord.tonic + first.chord.aliases[0]);
    }
  }
}

// 修复点击 bug：teleport 后的 dropdown 不在 containerRef 内，
// 需要同时检查 dropdownRef，否则点击候选项时 mousedown 先关闭菜单，click 永远到不了 <li>
function handleClickOutside(e: MouseEvent) {
  if (!menuOpen.value) return;
  const target = e.target as Node;
  if (containerRef.value?.contains(target)) return;
  if (dropdownRef.value?.contains(target)) return;
  menuOpen.value = false;
}

onMounted(() => {
  if (props.mode === "inline") {
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    const observer = new MutationObserver(updateDropdownPosition);
    if (containerRef.value) {
      observer.observe(containerRef.value, { attributes: true, subtree: true });
    }
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  window.removeEventListener("scroll", handleScrollResize, true);
  window.removeEventListener("resize", handleScrollResize);
});

function handleSelect(val: string | null) {
  if (val) {
    props.onSelect(val);
    const chord = Chord.get(val);
    const existingIndex = previousChords.value.findIndex((c) =>
      isSameChord(c, chord),
    );
    if (existingIndex >= 0) {
      previousChords.value.splice(existingIndex, 1);
    }
    previousChords.value.unshift(chord);
    if (previousChords.value.length > 10) {
      previousChords.value = previousChords.value.slice(0, 10);
    }
  }
  search.value = "";
  menuOpen.value = false;
}
</script>
