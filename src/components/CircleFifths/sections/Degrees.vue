<template>
  <g class="degrees">
    <g class="degreeTitle">
      <path
        :id="`degree_${props.scale}_title_followpath`"
        class="followPath"
        :d="
          drawArc(
            CX,
            CY,
            section.middle,
            titleOffset / 12,
            (titleOffset + 5) / 12,
          )
        "
      />
      <path
        class="degreeSection"
        :d="
          drawSection(
            CX,
            CY,
            section.start - 0.25,
            section.end + 0.25,
            titleOffset / 12,
            (titleOffset + 5) / 12,
          )
        "
      />
      <text font-size="1.5" text-anchor="middle">
        <textPath
          :href="`#degree_${props.scale}_title_followpath`"
          start-offset="50%"
        >
          {{
            props.scale === "minor"
              ? t("circleOfFifths.minorScaleAeolianMode")
              : t("circleOfFifths.majorScaleIonianMode")
          }}
        </textPath>
      </text>
    </g>
    <g v-for="(offset, index) in offsets" class="degree" :key="index">
      <path
        :id="`degree_${props.scale}_${index}_followpath`"
        class="followPath"
        :d="
          drawArc(
            CX,
            CY,
            section.middle,
            (offset - 0.5) / 12,
            (offset + 0.5) / 12,
          )
        "
      />
      <path
        class="degreeSection"
        :d="
          drawSection(
            CX,
            CY,
            section.start - 0.25,
            section.end + 0.25,
            (offset - 0.5) / 12,
            (offset + 0.5) / 12,
          )
        "
        :fill="DEGREE_COLORS[index]"
      />
      <text font-size="1.5" text-anchor="middle">
        <textPath
          :href="`#degree_${props.scale}_${index}_followpath`"
          start-offset="50%"
        >
          {{ `${degreesList[index]} - ${DEGREE_NAMES[index]}` }}
        </textPath>
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Section } from "../types";
import {
  CX,
  CY,
  DEGREE_COLORS,
  DEGREES_MINOR,
  DEGREE_NAMES,
  DEGREES_MAJOR,
  DEGREE_OFFSETS_MAJOR,
  DEGREE_OFFSETS_MINOR,
  drawSection,
  drawArc,
} from "../utils";

const { t } = useI18n();

const props = defineProps<{
  scale: "major" | "minor";
  section: Section;
}>();

const offsets = computed(() =>
  props.scale === "minor" ? DEGREE_OFFSETS_MINOR : DEGREE_OFFSETS_MAJOR,
);
const degreesList = computed(() =>
  props.scale === "minor" ? DEGREES_MINOR : DEGREES_MAJOR,
);
const titleOffset = computed(() => (props.scale === "minor" ? 2.5 : 5.5));
</script>
