<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl mx-auto">
    <button
      v-for="(option, index) in options"
      :key="`${option}-${index}`"
      type="button"
      class="btn h-auto min-h-[3.25rem] py-2.5 px-4 justify-start gap-3 normal-case rounded-xl"
      :class="optionClass(index)"
      :tabindex="answered ? -1 : 0"
      :aria-label="`${letter(index)} ${option}`"
      @click="handleSelect(index)"
    >
      <span
        class="badge badge-sm shrink-0 font-bold"
        :class="letterBadgeClass(index)"
      >
        {{ letter(index) }}
      </span>
      <span class="font-mono text-lg leading-none tracking-wide">{{
        option
      }}</span>
      <span
        v-if="answered && index === correctIndex"
        class="ml-auto shrink-0 text-success"
      >
        <svg
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span
        v-else-if="answered && selectedIndex === index"
        class="ml-auto shrink-0 text-error"
      >
        <svg
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
// 四选一选项区：作答后即时反馈（正确绿 / 错选红 / 其余置灰），daisyUI 风格
// 注意：不用原生 disabled（会触发 .btn:disabled 的中性色覆盖，压制 success/error），
// 改用 pointer-events-none + aria-disabled + 点击守卫实现「作答后锁定」。
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    options: string[];
    correctIndex: number;
    answered: boolean;
    selectedIndex: number;
  }>(),
  {
    options: () => [],
    correctIndex: -1,
    answered: false,
    selectedIndex: -1,
  },
);

const emit = defineEmits<{
  select: [index: number];
}>();

const LETTERS = ["A", "B", "C", "D"] as const;

function letter(index: number): string {
  return LETTERS[index] ?? "";
}

/** 作答后锁定交互的公共类 */
const LOCK = "pointer-events-none";

const optionClass = computed(() => (index: number) => {
  if (!props.answered) {
    // 未答：描边按钮 + 主色 hover（避免实心跳变）
    return "btn-outline hover:border-primary/60 hover:text-primary";
  }
  if (index === props.correctIndex) return `btn-soft btn-success ${LOCK}`;
  if (index === props.selectedIndex) return `btn-soft btn-error ${LOCK}`;
  // 其余项：手动挂 btn-disabled 类（只作用于本按钮，不会压制上面的颜色）
  return `btn-disabled ${LOCK}`;
});

/** 字母徽章配色：作答后正确项随绿、错选随红，其余淡化，与按钮状态联动 */
const letterBadgeClass = computed(() => (index: number) => {
  if (!props.answered) return "badge-neutral";
  if (index === props.correctIndex) return "badge-success";
  if (index === props.selectedIndex) return "badge-error";
  return "badge-outline opacity-60";
});

/** 点击守卫：pointer-events-none 挡鼠标，这里兜底键盘 Enter/Space 触发的 click */
function handleSelect(index: number) {
  if (props.answered) return;
  emit("select", index);
}
</script>
