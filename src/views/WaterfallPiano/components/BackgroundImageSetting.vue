<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm">
        {{ t("WaterfallPiano.backgroundImage") }}
      </span>
      <div class="flex items-center gap-2">
        <button
          v-if="imageUrl"
          class="btn btn-xs btn-ghost"
          @click="clearImage"
        >
          {{ t("WaterfallPiano.bgImageClear") }}
        </button>
        <button class="btn btn-xs btn-neutral" @click="fileInput?.click()">
          {{ t("WaterfallPiano.bgImageChoose") }}
        </button>
      </div>
    </div>
    <img
      v-if="imageUrl"
      :src="imageUrl"
      class="w-28 h-16 object-cover rounded border border-base-content/20"
      alt=""
    />
    <p class="text-xs text-base-content/60">
      {{ t("WaterfallPiano.backgroundImageHint") }}
    </p>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/WaterfallPiano";

/**
 * 自定义背景图片设置项（背景色层的专属控件，不适用通用字段渲染器）：
 * 文件选择 → canvas 降采样（最长边 ≤ 1920）→ JPEG 0.75 → dataURL 存入
 * settings.background.backgroundImage，由 BackgroundRenderer 作为最底层绘制。
 */
const { t } = useI18n();
const store = useWaterfallPianoStore();
const fileInput = ref<HTMLInputElement | null>(null);

const imageUrl = computed(
  () => store.settings.background.backgroundImage ?? "",
);

/** 清除自定义背景图，回退到纯色底 */
function clearImage(): void {
  store.updateSetting("background", "backgroundImage", undefined);
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // 允许重复选择同一文件
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX_SIDE = 1920;
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      store.updateSetting("background", "backgroundImage", dataUrl);
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}
</script>
