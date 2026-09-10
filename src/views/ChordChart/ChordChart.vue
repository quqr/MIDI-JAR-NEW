<script setup lang="ts">
/**
 * 和弦谱模块页面（Step 5：最小可渲染网格，只读）。
 *
 * 本步目标 = 把领域层与 store 真实渲染出来、验证接线；
 * 编辑交互（光标 / 输入面板 / 上下文面板）在 Step 6-9 逐步接入。
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { Icon } from "@/components/Icon";
import ChartGrid from "./components/ChartGrid.vue";
import ChartContextPanel from "./components/ChartContextPanel.vue";
import ChordInputPopover from "./components/ChordInputPopover.vue";
import ChartToolbar from "./components/ChartToolbar.vue";
import ChartMetaPanel from "./components/ChartMetaPanel.vue";
import { useChordChartStore } from "./stores/ChordChart";
import { useChartEditor } from "./composables/useChartEditor";
import { useChartKeyboard } from "./composables/useChartKeyboard";
import { parseChordUnit, formatChordUnit } from "./domain/chordText";
import { keySignature } from "./domain/keySignature";
import { isChordInSelection } from "./domain/editing";
import {
  createChart,
  loadLibraryIndex,
} from "./composables/useChartPersistence";
import { createEmptyChart, createMeasure } from "./domain/empty";

import type { ChordUnit, SectionMark } from "./domain/types";

const { t } = useI18n();
const store = useChordChartStore();
const editor = useChartEditor();

/** 每拍像素宽（工具条缩放档位控制） */
const cellWidth = ref(28);

/** 元信息编辑面板展开状态 */
const metaEditing = ref(false);

/** 全曲调号（谱面每行谱首渲染，iReal 行为） */
const keySig = computed(() => keySignature(store.chart.meta.key));

/* ── 排练记号 / 谱面文字 → 小节索引映射（渲染层读取） ── */

const sectionsByMeasure = computed<Record<number, SectionMark>>(() => {
  const map: Record<number, SectionMark> = {};
  for (const s of store.chart.sections) map[s.measureIndex] = s.mark;
  return map;
});

const textsByMeasure = computed<Record<number, string>>(() => {
  const map: Record<number, string> = {};
  for (const tx of store.chart.texts) map[tx.measureIndex] = tx.content;
  return map;
});

/* ── 输入浮层状态 ───────────────────────────────── */

/** 浮层锚点矩形；null = 关闭 */
const anchorRect = ref<DOMRect | null>(null);
/** 打开浮层时的初始和弦（新建则为 null） */
const editingUnit = ref<ChordUnit | null>(null);

/** 按 data 属性查锚点元素并取其视口矩形 */
function rectOf(measureIndex: number, chordIndex: number): DOMRect | null {
  const el = document.querySelector<HTMLElement>(
    `[data-chord-block="${measureIndex}-${chordIndex}"]`,
  );
  return el ? el.getBoundingClientRect() : null;
}

/** 打开输入浮层（编辑当前光标所在和弦） */
function openInput(initialText?: string): void {
  const { measureIndex, chordIndex } = editor.cursor.value;
  const measure = store.chart.measures[measureIndex];
  const existing =
    chordIndex !== null ? (measure?.chords[chordIndex] ?? null) : null;

  anchorRect.value = rectOf(measureIndex, chordIndex ?? 0);
  if (!anchorRect.value) return;

  // 直接输入：以用户敲下的字符为初值，否则回填现有和弦
  if (initialText !== undefined) {
    editingUnit.value = parseChordUnit(initialText, existing?.beats ?? 4);
  } else {
    editingUnit.value = existing;
  }
}

function closeInput(): void {
  anchorRect.value = null;
  editingUnit.value = null;
}

/** 确认输入：写入光标位置（空位则新建） */
function onInputConfirm(unit: ChordUnit): void {
  const { measureIndex, chordIndex } = editor.cursor.value;
  store.putChord(measureIndex, chordIndex ?? 0, unit);
  closeInput();
}

/** 删除当前和弦 */
function onInputDelete(): void {
  editor.deleteAtCursor();
  closeInput();
}

/* ── 上下文面板状态 ─────────────────────────────── */

/** 上下文面板锚点；null = 关闭 */
const contextRect = ref<DOMRect | null>(null);
/** 上下文面板打开时冻结的作用域（拖动光标不应半途换页签） */
const contextScope = ref<{
  measureIndex: number;
  chordIndex: number | null;
} | null>(null);

/** 打开上下文面板：优先锚到当前和弦块，无块则锚到小节 */
function openContext(): void {
  const { measureIndex, chordIndex } = editor.cursor.value;
  const el =
    chordIndex !== null
      ? document.querySelector<HTMLElement>(
          `[data-chord-block="${measureIndex}-${chordIndex}"]`,
        )
      : null;
  const host =
    el ??
    document.querySelector<HTMLElement>(
      `[data-measure-index="${measureIndex}"]`,
    ) ??
    document.querySelector<HTMLElement>(
      `[data-system-measure="${measureIndex}"]`,
    );
  if (!host) return;
  contextScope.value = { measureIndex, chordIndex };
  contextRect.value = host.getBoundingClientRect();
}

function closeContext(): void {
  contextRect.value = null;
  contextScope.value = null;
}

const contextStyle = computed(() => {
  const rect = contextRect.value;
  if (!rect) return { display: "none" };

  const margin = 8;
  const width = 288; // w-72
  const height = 460; // 保守估计；内容可滚动
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left;
  if (left + width + margin > vw) left = Math.max(margin, vw - width - margin);

  let top = rect.bottom + 4;
  if (top + height + margin > vh) {
    top = Math.max(
      margin,
      Math.min(rect.top - height - 4, vh - height - margin),
    );
  }

  return { left: `${left}px`, top: `${top}px` };
});

/** 面板定位：锚点左下，右侧/下方放不下时翻转并夹取到视口内 */
/** 上下文提示：当前光标位置的可读描述 */
const cursorHint = computed(() => {
  const { measureIndex, chordIndex } = editor.cursor.value;
  const measure = store.chart.measures[measureIndex];
  if (!measure) return "";
  const chord = chordIndex !== null ? measure.chords[chordIndex] : undefined;
  const chordLabel = chord ? formatChordUnit(chord) : null;
  return chordLabel
    ? t("chordChart.cursor.hint", {
        measure: measureIndex + 1,
        chord: chordLabel,
      })
    : t("chordChart.cursor.hintMeasure", { measure: measureIndex + 1 });
});

/** 选区内和弦判定（传给渲染层） */
function selectedChord(measureIndex: number, chordIndex: number): boolean {
  return isChordInSelection(store.selection, measureIndex, chordIndex);
}

/** 键盘导航：Enter 或直接输入字符即打开输入浮层 */
useChartKeyboard({
  enabled: () => store.chartId !== null,
  onEnter: () => openInput(),
  onCharInput: (char) => openInput(char),
  onContext: () => openContext(),
});

const issuesBySeverity = computed(() => {
  const errors = store.issues.filter((i) => i.level === "error").length;
  const warnings = store.issues.filter((i) => i.level === "warning").length;
  return { errors, warnings };
});

function onSelect(measureIndex: number, chordIndex: number): void {
  store.setCursor({ measureIndex, chordIndex });
  // 单击即打开输入浮层（iReal 的交互：点格子直接编辑）
  openInput();
}

/**
 * 开发期种子曲目：让页面首次打开就有内容可看。
 * 用户曲库为空时自动建一张演示曲；正式曲库 UI 在 Step 9 接入。
 */
function seedIfEmpty(): void {
  if (store.chartId) return;

  const entries = loadLibraryIndex();
  if (entries.length > 0) {
    store.openChart(entries[0].id);
    return;
  }

  // 建空曲目
  // ⚠️ `createEmptyChart(0)` 会被 clamp 成 1 个小节，这里必须手动清空
  const id = createChart(t("chordChart.demo.title"));
  const blank = createEmptyChart(1);
  blank.measures = [];
  blank.meta = {
    title: t("chordChart.demo.title"),
    composer: "Demo",
    style: "Medium Swing",
    key: { tonic: "C", mode: "major" },
    tempo: 120,
    repeats: 1,
    notation: "symbol",
  };
  store.attachChart(id, blank);

  // 16 小节演示进行：Dm7 - G7 - Cmaj7 - A7 循环
  const progression = ["Dm7", "G7", "Cmaj7", "A7"];
  for (let i = 0; i < 16; i += 1) {
    const measure = createMeasure();
    measure.chords = [parseChordUnit(progression[i % progression.length], 4)];
    store.chart.measures.push(measure);
  }
  store.clearHistory();
  store.saveNow();
}

onMounted(() => {
  seedIfEmpty();
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div
      class="w-full max-w-6xl mx-auto px-4 py-5 sm:px-6 flex flex-col gap-4 sm:gap-5"
    >
      <!-- ===== 标题行 ===== -->
      <header class="flex flex-wrap items-center gap-3">
        <div
          class="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon name="lead-sheet" :size="22" />
        </div>
        <div class="min-w-0">
          <h1 class="text-xl font-bold leading-tight">
            {{ $t("nav.chordChart") }}
          </h1>
          <p class="text-xs text-base-content/50 mt-1">
            {{ $t("chordChart.subtitle") }}
          </p>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <!-- 问题计数 -->
          <span
            v-if="issuesBySeverity.errors > 0"
            class="badge badge-error badge-sm gap-1"
          >
            <Icon name="error" :size="11" />
            {{ issuesBySeverity.errors }}
          </span>
          <span
            v-if="issuesBySeverity.warnings > 0"
            class="badge badge-warning badge-sm gap-1"
          >
            <Icon name="warning" :size="11" />
            {{ issuesBySeverity.warnings }}
          </span>
        </div>
      </header>

      <!-- ===== 谱面 ===== -->
      <section
        class="bg-base-100 rounded-2xl border border-base-content/10 p-4 sm:p-6 shadow-sm"
      >
        <!-- 曲目元信息条 -->
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
          <h2 class="text-lg font-semibold">
            {{ store.chart.meta.title || $t("chordChart.untitled") }}
          </h2>
          <span
            v-if="store.chart.meta.composer"
            class="text-xs text-base-content/50"
          >
            {{ store.chart.meta.composer }}
          </span>
          <span
            v-if="store.chart.meta.style"
            class="text-xs text-base-content/40 italic"
          >
            {{ store.chart.meta.style }}
          </span>
          <span class="ml-auto flex items-center gap-1.5">
            <span class="badge badge-sm badge-ghost font-medium">
              {{ store.chart.meta.key.tonic }}
              {{ store.chart.meta.key.mode === "minor" ? "m" : "" }}
            </span>
            <span class="badge badge-sm badge-ghost tabular-nums">
              {{ store.chart.meta.tempo }} BPM
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square"
              :class="{ 'btn-active': metaEditing }"
              :title="$t('chordChart.metaPanel.edit')"
              :aria-label="$t('chordChart.metaPanel.edit')"
              @click="metaEditing = !metaEditing"
            >
              <Icon name="pencil" :size="12" />
            </button>
          </span>
        </div>

        <!-- 元信息编辑面板（铅笔展开） -->
        <ChartMetaPanel v-if="metaEditing" class="mb-4" />

        <!-- 编辑工具条 -->
        <div class="mb-4 pb-3 border-b border-base-content/10">
          <ChartToolbar
            v-model:cell-width="cellWidth"
          />
        </div>

        <ChartGrid
          :systems="store.systems"
          :measures="store.chart.measures"
          :cell-width="cellWidth"
          :system-spacing="store.chart.systemSpacing"
          :key-sig="keySig"
          :sections-by-measure="sectionsByMeasure"
          :texts-by-measure="textsByMeasure"
          :cursor-measure="editor.cursor.value.measureIndex"
          :cursor-chord="editor.cursor.value.chordIndex"
          :is-selected="selectedChord"
          @select="onSelect"
        />
      </section>

      <!-- ===== 光标状态条 ===== -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span class="text-base-content/45 tabular-nums">
          {{ cursorHint }}
        </span>
        <span
          v-if="store.selection"
          class="badge badge-primary badge-sm badge-outline"
        >
          {{ $t("chordChart.cursor.selection") }}
        </span>
        <span class="ml-auto flex items-center gap-2">
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            @click="openContext"
          >
            <Icon name="file-text" :size="12" />
            {{ $t("chordChart.context.titleMeasure") }}
          </button>
        </span>
      </div>

      <!-- ===== 统计条 ===== -->
      <p class="text-xs text-base-content/40 text-center pb-1">
        {{
          $t("chordChart.stats", {
            measures: store.measureCount,
            chords: store.chart.measures.reduce(
              (sum, m) => sum + m.chords.length,
              0,
            ),
          })
        }}
        ·
        {{ $t("chordChart.keyboardHint") }}
      </p>
    </div>

    <!-- ===== 和弦输入浮层 ===== -->
    <ChordInputPopover
      :anchor-rect="anchorRect"
      :model-value="editingUnit"
      :tonic="store.chart.meta.key.tonic"
      @confirm="onInputConfirm"
      @cancel="closeInput"
      @delete="onInputDelete"
    />

    <!-- ===== 上下文属性浮层 ===== -->
    <!-- 点面板外任意处关闭：遮罩置于面板之下（overlay 40 < popover 55） -->
    <Teleport to="body">
      <div
        v-if="contextRect"
        class="fixed inset-0 z-dropdown"
        @pointerdown="closeContext"
      />
      <div
        v-if="contextRect && contextScope"
        class="fixed z-popover"
        :style="contextStyle"
      >
        <ChartContextPanel
          :measure-index="contextScope.measureIndex"
          :chord-index="contextScope.chordIndex"
          @close="closeContext"
        />
      </div>
    </Teleport>
  </div>
</template>
