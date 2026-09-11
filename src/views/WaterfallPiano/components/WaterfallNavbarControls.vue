<template>
  <!-- 瀑布流导航栏控制条（ADR 0024 / 0025）：经 Teleport 注入 AppNavbar 插拔区，
       播放传输 + 录制 + 合并面板开关全部收入导航栏，页面内无悬浮控件 -->
  <!-- 限宽居中：在导航栏插拔区（面包屑与右侧控件簇之间）水平居中，
       过窄时 range 先收缩（min-w-0），时间显示逐级隐藏（sm/md 断点），
       不与面包屑、延迟圆点、音源标签、主题切换、窗口控制按钮争抢空间 -->
  <div class="mx-auto flex items-center gap-1.5 w-full max-w-xl min-w-0">
    <!-- 播放/暂停 -->
    <button
      class="btn btn-sm btn-circle shrink-0"
      :class="isPlaying ? 'btn-warning' : 'btn-primary'"
      :disabled="!hasContent || exporting"
      :title="
        isPlaying
          ? t('WaterfallPiano.transport.pause')
          : t('WaterfallPiano.transport.play')
      "
      :aria-label="
        isPlaying
          ? t('WaterfallPiano.transport.pause')
          : t('WaterfallPiano.transport.play')
      "
      @click="isPlaying ? $emit('pause') : $emit('play')"
    >
      <Icon
        :name="isPlaying ? 'pause' : 'play'"
        :size="14"
        aria-hidden="true"
      />
    </button>
    <!-- 停止 -->
    <button
      class="btn btn-sm btn-circle btn-ghost shrink-0"
      :disabled="(!isPlaying && !isPaused) || exporting"
      :title="t('WaterfallPiano.transport.stop')"
      :aria-label="t('WaterfallPiano.transport.stop')"
      @click="$emit('stop')"
    >
      <Icon name="stop" :size="13" aria-hidden="true" />
    </button>

    <!-- 进度：当前时间 + 拖拽条 + 总时长 -->
    <span
      class="text-xs tabular-nums text-base-content/70 w-9 text-right shrink-0 hidden sm:inline"
    >
      {{ formatTime(currentTime) }}
    </span>
    <input
      type="range"
      class="range range-primary range-xs flex-1 min-w-6"
      min="0"
      :max="duration || 0"
      step="0.01"
      :value="currentTime"
      :disabled="duration <= 0 || exporting"
      :aria-label="t('WaterfallPiano.transport.progress')"
      @input="onSeekInput"
    />
    <span
      class="text-xs tabular-nums text-base-content/50 w-9 shrink-0 hidden md:inline"
    >
      {{ formatTime(duration) }}
    </span>

    <!-- 录制 -->
    <button
      class="btn btn-sm btn-circle shrink-0"
      :class="isRecording ? 'btn-error' : 'btn-ghost'"
      :disabled="exporting"
      :title="t('WaterfallPiano.midiDrawer.record')"
      :aria-label="t('WaterfallPiano.midiDrawer.record')"
      @click="$emit('toggle-record')"
    >
      <Icon name="circle" :size="12" aria-hidden="true" />
    </button>
    <!-- 资料 + 设置合并面板（ADR 0025）：单一入口 -->
    <button
      class="btn btn-sm btn-circle shrink-0"
      :class="panelOpen ? 'btn-primary' : 'btn-ghost'"
      :title="t('WaterfallPiano.sidePanel.title')"
      :aria-label="t('WaterfallPiano.sidePanel.title')"
      :aria-expanded="panelOpen"
      @click="$emit('toggle-panel')"
    >
      <Icon name="layout" :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * 瀑布流导航栏控制条（ADR 0024 / 0025）：由 WaterfallPiano 经
 * <Teleport defer to="#app-navbar-page-zone"> 注入全局导航栏。
 * 包含播放/暂停/停止、进度拖拽与时间显示、录制、以及合并面板开关
 * （资料 + 设置收在同一抽屉里，导航栏只留一个入口）。
 *
 * 导出期间（exporting）传输类控件全部禁用：前台渲染循环已停，
 * 此时再启动播放会与离屏导出争抢 CPU/GPU（ADR 0026）。
 * 面板入口不禁用——导出进度与取消按钮在那里。
 */
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

defineProps<{
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isPaused: boolean;
  isRecording: boolean;
  hasContent: boolean;
  panelOpen: boolean;
  /** 视频导出进行中：禁用传输控件（ADR 0026） */
  exporting: boolean;
}>();

const emit = defineEmits<{
  (e: "play"): void;
  (e: "pause"): void;
  (e: "stop"): void;
  (e: "seek", seconds: number): void;
  (e: "toggle-record"): void;
  (e: "toggle-panel"): void;
}>();

const { t } = useI18n();

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function onSeekInput(e: Event): void {
  const value = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(value)) emit("seek", value);
}
</script>
