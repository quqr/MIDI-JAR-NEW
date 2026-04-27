<template>
  <div
    :class="[
      'circle-fifths-root',
      { interactive: !!props.onChange },
      props.className,
    ]"
  >
    <svg
      ref="svgRef"
      class="circle-fifths-svg"
      :style="{ width: `${size}px`, height: `${size}px` }"
      :viewBox="`0 0 ${SIZE} ${SIZE}`"
    >
      <template v-if="size">
        <g
          :class="{ 'wheel--isRotating': isRotating }"
          :transform="`rotate(${-rotation}, ${CX}, ${CY})`"
          @transitionend="handleTransitionEnd"
        >
          <!-- ALTERATIONS -->
          <SectionAlteration
            v-if="config.displayAlterations"
            v-for="value in FIFTHS_INDEXES"
            :key="value"
            :value="value"
            :current="current"
            :tonic="props.keySignature?.tonic"
            :label="FIFTHS_ALTERATIONS[value]"
            :section="sections.alt"
          />

          <!-- MAJOR -->
          <SectionMajor
            v-if="config.displayMajor"
            v-for="value in FIFTHS_INDEXES"
            :key="`major_${value}`"
            :label="FIFTHS_MAJOR[value]"
            :value="value"
            :current="current"
            :rotation="rotation"
            :section="sections.major"
            :on-click="handleClick"
            :config="config"
            :chord="props.chord"
            :notes="props.notes"
            :key-signature="props.keySignature"
          />

          <!-- SUSPENDED MAJOR -->
          <template v-if="config.displayMajor && config.displaySuspended">
            <g v-for="value in FIFTHS_INDEXES" :key="`sus_maj_${value}`">
              <SectionSuspended
                :value="value"
                :current="current"
                quality="sus4"
                :section="sections.major"
                section-type="major"
                :on-click="handleClick"
                :chord="props.chord"
                :key-signature="props.keySignature"
                :config="config"
              />
              <SectionSuspended
                :value="value"
                :current="current"
                quality="sus2"
                :section="sections.major"
                section-type="major"
                :on-click="handleClick"
                :chord="props.chord"
                :key-signature="props.keySignature"
                :config="config"
              />
            </g>
          </template>

          <!-- DOMINANTS -->
          <SectionDominants
            v-if="config.displayDominants"
            v-for="value in FIFTHS_INDEXES"
            :key="`dom_${value}`"
            :value="value"
            :current="current"
            :label="FIFTHS_DOMINANTS[value]"
            :section="sections.dom"
            :chord="props.chord"
            :key-signature="props.keySignature"
            :config="config"
          />

          <!-- SUSPENDED MINOR -->
          <template v-if="config.displayMinor && config.displaySuspended">
            <g v-for="value in FIFTHS_INDEXES" :key="`sus_min_${value}`">
              <SectionSuspended
                :value="value"
                :current="current"
                quality="sus4"
                :section="sections.minor"
                section-type="minor"
                :on-click="handleClick"
                :chord="props.chord"
                :key-signature="props.keySignature"
                :config="config"
              />
              <SectionSuspended
                :value="value"
                :current="current"
                quality="sus2"
                :section="sections.minor"
                section-type="minor"
                :on-click="handleClick"
                :chord="props.chord"
                :key-signature="props.keySignature"
                :config="config"
              />
            </g>
          </template>

          <!-- MINOR -->
          <SectionMinor
            v-if="config.displayMinor"
            v-for="value in FIFTHS_INDEXES"
            :key="`minor_${value}`"
            :label="FIFTHS_MINOR[value]"
            :value="value"
            :current="current"
            :rotation="rotation"
            :section="sections.minor"
            :on-click="handleClick"
            :config="config"
            :chord="props.chord"
            :notes="props.notes"
            :key-signature="props.keySignature"
          />

          <!-- DIMINISHED -->
          <SectionDiminished
            v-if="config.displayDiminished"
            v-for="value in FIFTHS_INDEXES"
            :key="`diminished_${value}`"
            :label="FIFTHS_DIMINISHED[value]"
            :value="value"
            :current="current"
            :rotation="rotation"
            :section="sections.dim"
            :on-click="handleClick"
            :config="config"
            :chord="props.chord"
            :notes="props.notes"
            :key-signature="props.keySignature"
          />
        </g>

        <!-- DEGREES -->
        <Degrees
          v-if="config.displayDegrees && config.displayMajor"
          scale="major"
          :section="sections.degreesMajor"
        />
        <Degrees
          v-if="config.displayDegrees && config.displayMinor"
          scale="minor"
          :section="sections.degreesMinor"
        />
        <Modes
          v-if="config.displayModes"
          :section="sections.modes"
          :config="config"
        />
        <DegreeLabels
          v-if="config.displayDegreeLabels"
          scale="major"
          :sections="sections"
          :config="config"
        />
        <DegreeLabels
          v-if="config.displayDegreeLabels"
          scale="minor"
          :sections="sections"
          :config="config"
        />
        <Arrow :section="sections.arrow" />
      </template>
    </svg>
    <div class="circle-fifths-children">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { debounce } from "@/helpers/debounce";
import {
  SIZE,
  CX,
  CY,
  FIFTHS_INDEXES,
  FIFTHS_MAJOR,
  FIFTHS_MINOR,
  FIFTHS_DOMINANTS,
  FIFTHS_DIMINISHED,
  FIFTHS_ALTERATIONS,
  getCurrentKey,
  getSections,
} from "./utils";
import {
  SectionAlteration,
  SectionDominants,
  SectionMajor,
  SectionMinor,
  SectionDiminished,
  SectionSuspended,
  Degrees,
  DegreeLabels,
  Modes,
  Arrow,
} from "./sections";
import { CircleFifthsProps, CircleOfFifthsConfig } from "./types";

const defaultConfig: Required<CircleOfFifthsConfig> = {
  scale: "major",
  displayMajor: true,
  displayMinor: true,
  displayDiminished: true,
  displayDominants: true,
  displaySuspended: true,
  displayAlterations: true,
  displayModes: true,
  displayDegrees: true,
  displayDegreeLabels: true,
  highlightSector: "chord",
  highlightInScale: false,
};

const props = withDefaults(defineProps<CircleFifthsProps>(), {
  className: undefined,
  keySignature: undefined,
  chord: undefined,
  notes: undefined,
  onChange: undefined,
  config: undefined,
});

const svgRef = ref<SVGSVGElement | null>(null);
const size = ref<number | null>(null);
const current = ref(getCurrentKey(props.keySignature?.alteration || 0));
const rotation = ref(((current.value * 1) / 12) * 360);
const isRotating = ref(false);
const hasCompletedRotation = ref(false);

const config = computed<CircleOfFifthsConfig>(() => ({
  ...defaultConfig,
  ...props.config,
}));

const sections = computed(() => getSections(config.value));

const handleClick = (newValue: number) => {
  if (props.onChange) {
    if (
      FIFTHS_MAJOR[newValue].length > 1 &&
      props.keySignature?.tonic === FIFTHS_MAJOR[newValue][0]
    ) {
      props.onChange(FIFTHS_MAJOR[newValue][1]);
    } else {
      props.onChange(FIFTHS_MAJOR[newValue][0]);
    }
  }
};

watch(
  () => props.keySignature,
  (newKey) => {
    debouncedRotation(newKey);
  },
);

const handleTransitionEnd = (e: TransitionEvent) => {
  if ((e.target as SVGElement).nodeName === "g") {
    isRotating.value = false;
  }
};

const resize = () => {
  if (svgRef.value) {
    const s = Math.min(
      svgRef.value.parentElement?.clientHeight || 100,
      svgRef.value.parentElement?.clientWidth || 100,
    );
    size.value = s;
  }
};

const debouncedResize = debounce(resize, 60);

const debouncedRotation = debounce(
  (newKey: { alteration?: number } | undefined) => {
    const newValue = getCurrentKey(newKey?.alteration || 0);
    const previousValue = current.value;

    let diff = newValue - previousValue;
    if (diff < -6) diff += 12;
    if (diff > 6) diff -= 12;

    rotation.value = rotation.value + ((diff * 1) / 12) * 360;

    if (diff) {
      isRotating.value = true;
      hasCompletedRotation.value = false;
    }

    current.value = newValue;
  },
  50,
);

onMounted(() => {
  window.addEventListener("resize", debouncedResize);
  setTimeout(resize, 0);
});

onUnmounted(() => {
  window.removeEventListener("resize", debouncedResize);
});
</script>

<style src="./CircleFifths.css"></style>
