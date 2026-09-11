<template>
  <SettingsSection :show-reset="true" :on-reset="() => store.resetSettings()">
    <div class="flex flex-col gap-3 p-2">
      <SettingsFieldGroup
        v-for="(layer, i) in visibleLayers"
        :key="layer.id"
        :fields="layerFields[i]"
        :model="layerModels[i]"
        :title-key="layer.titleKey"
        :icon="layer.icon"
        i18n-prefix="WaterfallPiano"
        :section-id="`waterfall-${layer.id}`"
        @update="(key, value) => updateLayer(layer, key, value)"
      >
        <BackgroundImageSetting v-if="layer.id === 'background'" />
      </SettingsFieldGroup>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed, toRaw } from "vue";
import { useWaterfallPianoStore } from "../stores/WaterfallPiano";
import { setValueByPath } from "@/helpers";
import { SettingsFieldGroup, SettingsSection } from "@/components/Settings";
import { LAYERS, layerSectionOf, layerSections } from "../settingsSchema";
import type { LayerGroupSchema } from "../settingsSchema";
import BackgroundImageSetting from "./BackgroundImageSetting.vue";

const props = defineProps<{
  /**
   * 是否展示进阶字段（ADR 0024，如流体"随机扰动"干扰抖动组）：
   * 全局设置页传 true，侧边设置抽屉默认 false 过滤隐藏。
   */
  showAdvanced?: boolean;
}>();

const store = useWaterfallPianoStore();
const settings = computed(() => store.settings);

/** 过滤进阶字段后的层级清单（字段 schema 为常量，setup 内一次完成） */
const visibleLayers: readonly LayerGroupSchema[] = props.showAdvanced
  ? LAYERS
  : LAYERS.map((layer) => ({
      ...layer,
      fields: layer.fields.filter((e) => !e.advanced),
    }));

/**
 * 分组清单 = 渲染层级（LAYERS 常量数组，settingsSchema.ts）：
 * 数组顺序即渲染顺序（背景色 → 特殊效果 → 流体 → Note Block → 钢琴 → UI），
 * 新增层级只需向 LAYERS 追加一项。
 * 全部默认展开（非受控模式），不再做手风琴单开互斥。
 */
const layerFields = computed(() =>
  visibleLayers.map((layer) => layer.fields.map((entry) => entry.field)),
);

/**
 * 层级组的数据模型：层级可能跨多个设置段（如特殊效果层 = background.galaxy
 * + effects），合并相关 section 为一个平面 model 供字段 visibleWhen / 取值。
 */
const layerModels = computed<Record<string, unknown>[]>(() =>
  visibleLayers.map((layer) => {
    const model: Record<string, unknown> = {};
    for (const section of layerSections(layer)) {
      Object.assign(model, settings.value[section]);
    }
    return model;
  }),
);

type FieldValue = boolean | number | string | null | undefined;

/**
 * 字段写回：按字段 key 顶层段路由到所属设置段；平铺 key 直写；
 * 点路径 key（如 "hitLine.color"、"fluidParams.*.positionJitter"）浅拷贝
 * 外层对象后经 setValueByPath 深写入再整体写回，与迁移前各 section 的
 * spread 语义一致。
 */
function updateLayer(
  layer: LayerGroupSchema,
  key: string,
  value: FieldValue,
): void {
  const section = layerSectionOf(layer, key);
  if (!section) return;
  if (!key.includes(".")) {
    store.updateSetting(section, key as never, value);
    return;
  }
  const [outer, ...rest] = key.split(".");
  const base =
    (store.settings[section] as Record<string, unknown>)[outer] ?? {};
  // settings 是深层响应式 ref，这里拿到的 base 是 reactive Proxy；
  // structuredClone 无法克隆 Proxy（DataCloneError），先 toRaw 还原原始对象
  const clone = structuredClone(toRaw(base)) as Record<string, unknown>;
  setValueByPath(clone, rest.join("."), value);
  store.updateSetting(section, outer as never, clone);
}
</script>
