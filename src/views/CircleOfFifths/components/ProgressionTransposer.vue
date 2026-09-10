<script setup lang="ts">
/**
 * 五度循环圈 — 移调。
 *
 * 交互模型：先「固定源调」（取当下圈上的选中调），此后**圈上选中调即为目标调**，
 * 结果实时跟随 —— 圈本身就是目标调选择器，不另立一套调选择控件
 * （也避免违反 ADR 0014「select/radio 一律换 RangeSlider」的约定）。
 *
 * 语义：按目标主音的**音高**整体平移，保持各和弦的性质与级数关系不变；
 * 目标调为小调时同样只按主音音高移调。
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { Icon } from "@/components/Icon";
import {
  keyDisplayName,
  parseProgression,
  transposeProgression,
  type AccidentalPreference,
  type KeyMode,
  type TransposedToken,
} from "../circleOfFifths";

const props = defineProps<{
  /** 已固定的源调主音；null 表示尚未固定 */
  sourceTonic: string | null;
  sourceMode: KeyMode | null;
  /** 目标调 = 圈上当前选中调 */
  targetTonic: string;
  targetMode: KeyMode;
  /** 音名记法偏好 */
  accidentals: AccidentalPreference;
}>();

const emit = defineEmits<{
  (e: "pin-source"): void;
  (e: "clear-source"): void;
}>();

const { t } = useI18n();

/** 和弦进行输入（组件内状态；「进行」不属于领域模型，不必上抛） */
const progression = ref("C Am F G");

const tokens = computed<string[]>(() => parseProgression(progression.value));

const result = computed<TransposedToken[] | null>(() => {
  if (!props.sourceTonic) return null;
  if (!tokens.value.length) return null;
  return transposeProgression(
    progression.value,
    props.sourceTonic,
    props.targetTonic,
    props.accidentals,
  );
});

const hasInvalid = computed(
  () => result.value?.some((token) => !token.valid) ?? false,
);

const sourceLabel = computed(() =>
  props.sourceTonic
    ? keyDisplayName(props.sourceTonic, props.sourceMode ?? "major")
    : null,
);

const targetLabel = computed(() =>
  keyDisplayName(props.targetTonic, props.targetMode),
);

/** 源调与目标调是否同位置同调式（此时移调是恒等变换） */
const isIdentity = computed(
  () =>
    !!props.sourceTonic &&
    props.sourceTonic === props.targetTonic &&
    props.sourceMode === props.targetMode,
);

/* ── 复制 ─────────────────────────────────────────────── */

const copied = ref(false);
let copiedTimer: number | undefined;

async function copyResult(): Promise<void> {
  const text = result.value
    ?.filter((token) => token.valid)
    .map((token) => token.output)
    .join(" ");
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => {
      copied.value = false;
    }, 1400);
  } catch {
    // 剪贴板不可用（无权限 / 非安全上下文）时静默失败，不打断用户
  }
}

/** 结果可跳和弦词典 */
function dictionaryTo(symbol: string): string {
  return `/chord-dictionary/${encodeURIComponent(symbol)}`;
}
</script>

<template>
  <section class="card bg-base-100 border border-base-300">
    <div class="card-body p-4 gap-3">
      <div class="flex items-center justify-between gap-2">
        <h3
          class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
        >
          {{ t("circleOfFifths.transpose.title") }}
        </h3>
        <button
          v-if="sourceTonic"
          type="button"
          class="btn btn-ghost btn-xs"
          @click="emit('clear-source')"
        >
          <Icon name="reset" :size="12" />
          {{ t("circleOfFifths.transpose.clear") }}
        </button>
      </div>

      <label class="input input-sm w-full">
        <span class="label text-xs text-base-content/50 shrink-0">
          {{ t("circleOfFifths.transpose.inputLabel") }}
        </span>
        <input
          v-model="progression"
          type="text"
          class="grow"
          :placeholder="t('circleOfFifths.transpose.placeholder')"
          spellcheck="false"
          autocomplete="off"
        />
      </label>

      <!-- 源调：由圈上选中调快照固定 -->
      <div class="flex items-center gap-2 flex-wrap">
        <template v-if="sourceLabel">
          <span class="badge badge-sm badge-outline gap-1">
            {{ t("circleOfFifths.transpose.source") }}
            <span class="font-semibold">{{ sourceLabel }}</span>
          </span>
          <Icon name="arrow-right" :size="14" class="text-base-content/40" />
          <span class="badge badge-sm badge-primary gap-1">
            {{ t("circleOfFifths.transpose.target") }}
            <span class="font-semibold">{{ targetLabel }}</span>
          </span>
        </template>
        <button
          v-else
          type="button"
          class="btn btn-sm btn-outline"
          @click="emit('pin-source')"
        >
          <Icon name="pin" :size="14" />
          {{ t("circleOfFifths.transpose.pinSource", { key: targetLabel }) }}
        </button>
      </div>

      <!-- 结果 -->
      <div v-if="result" class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <template
            v-for="(token, index) in result"
            :key="`${token.input}-${index}`"
          >
            <RouterLink
              v-if="token.valid && token.output"
              :to="dictionaryTo(token.output)"
              class="badge badge-sm transition-opacity duration-150 hover:opacity-75"
              :class="isIdentity ? 'badge-ghost' : 'badge-primary badge-soft'"
            >
              {{ token.output }}
            </RouterLink>
            <span
              v-else
              class="badge badge-sm badge-error badge-soft tooltip"
              :data-tip="t('circleOfFifths.transpose.invalid')"
            >
              {{ token.input }}
            </span>
          </template>

          <button
            v-if="!isIdentity"
            type="button"
            class="btn btn-ghost btn-xs ml-auto gap-1"
            :class="copied ? 'text-success' : ''"
            @click="copyResult"
          >
            <Icon :name="copied ? 'check' : 'save'" :size="12" />
            {{
              copied
                ? t("circleOfFifths.transpose.copied")
                : t("circleOfFifths.transpose.copy")
            }}
          </button>
        </div>

        <p v-if="hasInvalid" class="text-xs text-error">
          {{ t("circleOfFifths.transpose.invalid") }}
        </p>

        <p
          v-else-if="!isIdentity"
          class="text-xs text-base-content/50 leading-relaxed"
        >
          {{ t("circleOfFifths.transpose.semantics") }}
        </p>
      </div>

      <p
        v-else-if="!sourceTonic"
        class="text-xs text-base-content/50 leading-relaxed"
      >
        {{ t("circleOfFifths.transpose.hint") }}
      </p>

      <ul v-else class="flex flex-wrap gap-1.5">
        <li
          v-for="(token, index) in tokens"
          :key="`${token}-${index}`"
          class="badge badge-sm badge-ghost"
        >
          {{ token }}
        </li>
      </ul>

      <RouterLink
        v-if="result"
        to="/chord-dictionary"
        class="btn btn-ghost btn-xs self-start"
      >
        <Icon name="book" :size="12" />
        {{ t("circleOfFifths.actions.openInDictionary") }}
      </RouterLink>
    </div>
  </section>
</template>
