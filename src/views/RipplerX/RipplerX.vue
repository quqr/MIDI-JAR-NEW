<template>
  <div class="fixed inset-0 flex flex-col bg-base-300 overflow-hidden">
    <!-- ═══ Top Toolbar ═══ -->
    <div class="flex items-center gap-2 px-3 py-2 bg-base-200 border-b border-base-content/10 min-h-[44px]">
      <button
        class="btn btn-sm btn-circle btn-ghost tooltip tooltip-bottom"
        :data-tip="t('common.back')"
        :aria-label="t('common.back')"
        @click="$router.push('/home')"
      >
        <Icon name="arrow-left" :size="18" aria-hidden="true" />
      </button>
      <span class="font-bold text-base-content/90 text-sm tracking-wide">RipplerX</span>

      <div class="flex-1" />

      <!-- Preset selector -->
      <select
        v-model="store.state.currentPreset"
        class="select select-sm select-bordered w-36"
        @change="onPresetChange"
      >
        <option v-for="p in BUILTIN_PRESETS" :key="p" :value="p">{{ p }}</option>
      </select>

      <!-- Polyphony -->
      <div class="flex items-center gap-1">
        <span class="text-xs text-base-content/60">Poly</span>
        <select
          v-model.number="store.state.polyphony"
          class="select select-sm select-bordered w-16"
        >
          <option v-for="n in 16" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>

      <!-- Velocity mapping toggle -->
      <div class="flex items-center gap-1">
        <span class="text-xs text-base-content/60">Vel</span>
        <input
          type="checkbox"
          class="toggle toggle-xs toggle-primary"
          :checked="store.state.velocityMapping"
          @change="store.state.velocityMapping = ($event.target as HTMLInputElement).checked"
        />
      </div>

      <!-- Init button -->
      <button
        class="btn btn-xs btn-ghost"
        @click="onResetDefaults"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </div>

    <!-- ═══ Main Body (scrollable) ═══ -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      <!-- ── Noise Section ── -->
      <div class="card card-compact bg-base-200 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-sm">Noise</h3>
          <div class="flex flex-wrap gap-x-6 gap-y-2 items-end">
            <ParamSelect
              label="Filter"
              :options="NOISE_FILTER_TYPES"
              :model-value="store.state.noise.filterType"
              @update:model-value="updateParam('noise', 'filterType', $event)"
            />
            <ParamSlider label="Mix" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.mix"
              @update:model-value="updateParam('noise', 'mix', $event)" />
            <ParamSlider label="Res" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.resonance"
              @update:model-value="updateParam('noise', 'resonance', $event)" />
            <ParamSlider label="Freq" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.frequency"
              @update:model-value="updateParam('noise', 'frequency', $event)" />
            <ParamSlider label="Q" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.q"
              @update:model-value="updateParam('noise', 'q', $event)" />
          </div>
          <!-- ADSR + Tension -->
          <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-2">
            <ParamSlider label="A" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.attack"
              @update:model-value="updateParam('noise', 'attack', $event)" />
            <ParamSlider label="D" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.decay"
              @update:model-value="updateParam('noise', 'decay', $event)" />
            <ParamSlider label="S" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.sustain"
              @update:model-value="updateParam('noise', 'sustain', $event)" />
            <ParamSlider label="R" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.release"
              @update:model-value="updateParam('noise', 'release', $event)" />
            <div class="divider divider-horizontal mx-1" />
            <ParamSlider label="A Tns" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.attackTension"
              @update:model-value="updateParam('noise', 'attackTension', $event)" />
            <ParamSlider label="D Tns" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.decayTension"
              @update:model-value="updateParam('noise', 'decayTension', $event)" />
            <ParamSlider label="R Tns" :min="0" :max="1" :step="0.01"
              :model-value="store.state.noise.releaseTension"
              @update:model-value="updateParam('noise', 'releaseTension', $event)" />
          </div>
        </div>
      </div>

      <!-- ── Mallet Section ── -->
      <div class="card card-compact bg-base-200 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-sm">Mallet</h3>
          <div class="flex flex-wrap gap-x-6 gap-y-2 items-end">
            <ParamSelect
              label="Type"
              :options="MALLET_TYPES"
              :model-value="store.state.mallet.type"
              @update:model-value="updateParam('mallet', 'type', $event)"
            />
            <ParamSlider label="Mix" :min="0" :max="1" :step="0.01"
              :model-value="store.state.mallet.mix"
              @update:model-value="updateParam('mallet', 'mix', $event)" />
            <ParamSlider label="Res" :min="0" :max="1" :step="0.01"
              :model-value="store.state.mallet.resonance"
              @update:model-value="updateParam('mallet', 'resonance', $event)" />
            <ParamSlider label="Stiff" :min="0" :max="1" :step="0.01"
              :model-value="store.state.mallet.stiffness"
              @update:model-value="updateParam('mallet', 'stiffness', $event)" />
            <ParamSlider label="Pitch" :min="0" :max="1" :step="0.01"
              :model-value="store.state.mallet.pitch"
              @update:model-value="updateParam('mallet', 'pitch', $event)" />
            <ParamSlider label="Filter" :min="0" :max="1" :step="0.01"
              :model-value="store.state.mallet.filter"
              @update:model-value="updateParam('mallet', 'filter', $event)" />
            <ParamSlider label="Key Trk" :min="0" :max="1" :step="0.01"
              :model-value="store.state.mallet.keyTracking"
              @update:model-value="updateParam('mallet', 'keyTracking', $event)" />
          </div>
        </div>
      </div>

      <!-- ── Resonators A/B (side by side on wide, stacked on narrow) ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <!-- Resonator A -->
        <div class="card card-compact bg-base-200 shadow-sm" :class="{ 'opacity-50': !store.state.resonatorA.on }">
          <div class="card-body">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                class="toggle toggle-xs toggle-primary"
                :checked="store.state.resonatorA.on"
                @change="updateParam('resonatorA', 'on', ($event.target as HTMLInputElement).checked)"
              />
              <h3 class="card-title text-sm">Resonator A</h3>
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-1">
              <ParamSelect
                label="Model"
                :options="RESONATOR_MODELS"
                :model-value="store.state.resonatorA.model"
                @update:model-value="updateParam('resonatorA', 'model', $event)"
              />
              <ParamSelect
                label="Partials"
                :options="PARTIAL_COUNTS"
                :model-value="store.state.resonatorA.partials"
                @update:model-value="updateParam('resonatorA', 'partials', $event)"
              />
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-1">
              <ParamSlider label="Decay" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.decay"
                @update:model-value="updateParam('resonatorA', 'decay', $event)" />
              <ParamSlider label="Damp" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.damp"
                @update:model-value="updateParam('resonatorA', 'damp', $event)" />
              <ParamSlider label="Tone" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.tone"
                @update:model-value="updateParam('resonatorA', 'tone', $event)" />
              <ParamSlider label="Hit" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.hit"
                @update:model-value="updateParam('resonatorA', 'hit', $event)" />
              <ParamSlider label="Release" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.release"
                @update:model-value="updateParam('resonatorA', 'release', $event)" />
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-1">
              <ParamSlider label="Inharm" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.inharmonicity"
                @update:model-value="updateParam('resonatorA', 'inharmonicity', $event)" />
              <ParamSlider label="Ratio" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.ratio"
                @update:model-value="updateParam('resonatorA', 'ratio', $event)" />
              <ParamSlider label="Cut" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.cut"
                @update:model-value="updateParam('resonatorA', 'cut', $event)" />
              <ParamSlider label="Radius" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorA.radius"
                @update:model-value="updateParam('resonatorA', 'radius', $event)" />
              <ParamSlider label="Coarse" :min="-24" :max="24" :step="1"
                :model-value="store.state.resonatorA.coarse"
                @update:model-value="updateParam('resonatorA', 'coarse', $event)" />
              <ParamSlider label="Fine" :min="-100" :max="100" :step="1"
                :model-value="store.state.resonatorA.fine"
                @update:model-value="updateParam('resonatorA', 'fine', $event)" />
            </div>
          </div>
        </div>

        <!-- Resonator B -->
        <div class="card card-compact bg-base-200 shadow-sm" :class="{ 'opacity-50': !store.state.resonatorB.on }">
          <div class="card-body">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                class="toggle toggle-xs toggle-primary"
                :checked="store.state.resonatorB.on"
                @change="updateParam('resonatorB', 'on', ($event.target as HTMLInputElement).checked)"
              />
              <h3 class="card-title text-sm">Resonator B</h3>
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-1">
              <ParamSelect
                label="Model"
                :options="RESONATOR_MODELS"
                :model-value="store.state.resonatorB.model"
                @update:model-value="updateParam('resonatorB', 'model', $event)"
              />
              <ParamSelect
                label="Partials"
                :options="PARTIAL_COUNTS"
                :model-value="store.state.resonatorB.partials"
                @update:model-value="updateParam('resonatorB', 'partials', $event)"
              />
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-1">
              <ParamSlider label="Decay" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.decay"
                @update:model-value="updateParam('resonatorB', 'decay', $event)" />
              <ParamSlider label="Damp" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.damp"
                @update:model-value="updateParam('resonatorB', 'damp', $event)" />
              <ParamSlider label="Tone" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.tone"
                @update:model-value="updateParam('resonatorB', 'tone', $event)" />
              <ParamSlider label="Hit" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.hit"
                @update:model-value="updateParam('resonatorB', 'hit', $event)" />
              <ParamSlider label="Release" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.release"
                @update:model-value="updateParam('resonatorB', 'release', $event)" />
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end mt-1">
              <ParamSlider label="Inharm" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.inharmonicity"
                @update:model-value="updateParam('resonatorB', 'inharmonicity', $event)" />
              <ParamSlider label="Ratio" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.ratio"
                @update:model-value="updateParam('resonatorB', 'ratio', $event)" />
              <ParamSlider label="Cut" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.cut"
                @update:model-value="updateParam('resonatorB', 'cut', $event)" />
              <ParamSlider label="Radius" :min="0" :max="1" :step="0.01"
                :model-value="store.state.resonatorB.radius"
                @update:model-value="updateParam('resonatorB', 'radius', $event)" />
              <ParamSlider label="Coarse" :min="-24" :max="24" :step="1"
                :model-value="store.state.resonatorB.coarse"
                @update:model-value="updateParam('resonatorB', 'coarse', $event)" />
              <ParamSlider label="Fine" :min="-100" :max="100" :step="1"
                :model-value="store.state.resonatorB.fine"
                @update:model-value="updateParam('resonatorB', 'fine', $event)" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── Coupling Section ── -->
      <div class="card card-compact bg-base-200 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-sm">Coupling</h3>
          <div class="flex flex-wrap gap-x-6 gap-y-2 items-end">
            <ParamSelect
              label="Mode"
              :options="COUPLING_MODES"
              :model-value="store.state.coupling.mode"
              @update:model-value="updateParam('coupling', 'mode', $event)"
            />
            <ParamSlider label="Mix" :min="0" :max="1" :step="0.01"
              :model-value="store.state.coupling.mix"
              @update:model-value="updateParam('coupling', 'mix', $event)" />
            <ParamSlider label="Split" :min="0" :max="1" :step="0.01"
              :model-value="store.state.coupling.split"
              @update:model-value="updateParam('coupling', 'split', $event)" />
          </div>
        </div>
      </div>

      <!-- ── Pitch + Gain Section ── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <!-- Pitch -->
        <div class="card card-compact bg-base-200 shadow-sm">
          <div class="card-body">
            <h3 class="card-title text-sm">Pitch</h3>
            <div class="flex flex-wrap gap-x-6 gap-y-2 items-end">
              <ParamSlider label="A Coarse" :min="-24" :max="24" :step="1"
                :model-value="store.state.pitch.coarseA"
                @update:model-value="updateParam('pitch', 'coarseA', $event)" />
              <ParamSlider label="A Fine" :min="-100" :max="100" :step="1"
                :model-value="store.state.pitch.fineA"
                @update:model-value="updateParam('pitch', 'fineA', $event)" />
              <ParamSlider label="B Coarse" :min="-24" :max="24" :step="1"
                :model-value="store.state.pitch.coarseB"
                @update:model-value="updateParam('pitch', 'coarseB', $event)" />
              <ParamSlider label="B Fine" :min="-100" :max="100" :step="1"
                :model-value="store.state.pitch.fineB"
                @update:model-value="updateParam('pitch', 'fineB', $event)" />
              <ParamSlider label="Bend" :min="1" :max="24" :step="1"
                :model-value="store.state.pitch.bendRange"
                @update:model-value="updateParam('pitch', 'bendRange', $event)" />
            </div>
          </div>
        </div>

        <!-- Gain (dB) -->
        <div class="card card-compact bg-base-200 shadow-sm">
          <div class="card-body">
            <h3 class="card-title text-sm">Gain</h3>
            <div class="flex items-center gap-4">
              <div class="flex-1">
                <input
                  type="range"
                  :min="-24"
                  :max="24"
                  :step="0.1"
                  :value="store.state.gain.gain"
                  class="range range-sm range-primary w-full"
                  @input="updateParam('gain', 'gain', ($event.target as HTMLInputElement).valueAsNumber)"
                />
                <div class="flex justify-between text-xs text-base-content/50 mt-1">
                  <span>-24 dB</span>
                  <span>{{ store.state.gain.gain.toFixed(1) }} dB</span>
                  <span>+24 dB</span>
                </div>
              </div>
              <!-- VU Meter -->
              <div class="w-6 h-24 bg-base-300 rounded overflow-hidden relative">
                <div
                  class="absolute bottom-0 left-0 right-0 transition-all duration-75 rounded"
                  :class="modalSynth.rmsLevel.value > 0.8 ? 'bg-error' : modalSynth.rmsLevel.value > 0.5 ? 'bg-warning' : 'bg-success'"
                  :style="{ height: `${Math.min(100, modalSynth.rmsLevel.value * 200)}%` }"
                />
              </div>
              <div class="text-xs text-base-content/50 text-right min-w-[3rem]">
                <div>{{ (modalSynth.rmsLevel.value * 100).toFixed(0) }}%</div>
                <div class="text-base-content/30">RMS</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Load .ripx file ── -->
      <div class="card card-compact bg-base-200 shadow-sm">
        <div class="card-body flex-row items-center gap-4">
          <h3 class="card-title text-sm">Load Preset File</h3>
          <input
            type="file"
            accept=".ripx"
            class="file-input file-input-sm file-input-bordered w-full max-w-xs"
            @change="onRipxFileChange"
          />
        </div>
      </div>
    </div>

    <!-- ═══ Virtual Piano Keyboard ═══ -->
    <div class="bg-base-200 border-t border-base-content/10 px-2 py-1">
      <PianoKeyboard
        :played="midiInput.playedNotes.value"
        :clickable="true"
        :keyboard="{
          skin: 'flat',
          from: 'C3',
          to: 'C6',
          label: 'pitchClass',
          keyName: 'none',
          keyInfo: 'none',
          fadeOutDuration: 500,
          textOpacity: 0.5,
          displaySustained: false,
          wrap: false,
          sizes: { radius: 1, height: 5, ratio: 0.6, bevel: false },
          colors: { white: '#ffffff', black: '#000000', played: '#22c55e', wrapped: '#800000', sustained: '#777777' },
        }"
        @note-click="onPianoKeyClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import PianoKeyboard from "@/components/PianoKeyboard/PianoKeyboard.vue";
import { useRipplerXStore, BUILTIN_PRESETS, RESONATOR_MODELS, PARTIAL_COUNTS, NOISE_FILTER_TYPES, MALLET_TYPES, COUPLING_MODES } from "./stores/ripplerx";
import { useModalSynth } from "./composables/useModalSynth";
import { useMidiInput } from "./composables/useMidiInput";
import type { RipplerXState } from "./stores/ripplerx";

const { t } = useI18n();
const store = useRipplerXStore();
const modalSynth = useModalSynth();
const midiInput = useMidiInput(modalSynth);

// ── Initialise synth on mount ──
onMounted(async () => {
  try {
    await modalSynth.init();
  } catch (e) {
    console.error("RipplerX: failed to init synth:", e);
  }
});

/**
 * 单参数变更：写回 store + 通过 `syncParam` 仅推送变更参数到 AudioWorklet。
 * 比每次拖动都 `syncAllParams` 轻量——无 JSON 序列化、消息只含一个字段。
 * @param section - store 顶层键（如 'mallet' / 'resonatorA' / 'gain'）
 * @param key - section 下的字段名
 * @param value - 新值（number 或 boolean）
 */
function updateParam<K extends keyof RipplerXState>(
  section: K,
  key: keyof RipplerXState[K],
  value: unknown,
) {
  store.setParam(section, key, value);
  modalSynth.syncParam(section, key as string);
}

/** 切换内置预置：store 更新 currentPreset 名 + 应用预置数据 + worklet 立即生效。 */
function onPresetChange() {
  modalSynth.loadPreset(store.state.currentPreset);
}

/** 重置为默认参数并全量同步到 worklet。 */
function onResetDefaults() {
  store.resetToDefaults();
  modalSynth.syncAllParams();
}

/**
 * 虚拟钢琴键盘点击：触发 noteOn，300ms 后自动 noteOff（模拟点击交互）。
 * @param midi - MIDI 音符号
 */
function onPianoKeyClick(midi: number) {
  modalSynth.noteOn(midi, 100);
  setTimeout(() => modalSynth.noteOff(midi), 300);
}

/**
 * .ripx 预置文件输入 change 事件：解析并应用到 store + worklet。
 * 失败时仅 console.error，不阻塞 UI。处理完毕重置 input.value 以便重选同一文件。
 */
async function onRipxFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    await modalSynth.loadRipxFile(file);
  } catch (err) {
    console.error("Failed to load .ripx file:", err);
  }

  // Reset input so the same file can be loaded again
  target.value = "";
}
</script>

<script lang="ts">
/**
 * Tiny sub-components for parameter sliders and selects.
 * Defined as inline renderless components for compactness.
 */
import { defineComponent, h } from "vue";

const ParamSlider = defineComponent({
  name: "ParamSlider",
  props: {
    label: { type: String, required: true },
    modelValue: { type: Number, required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 1 },
    step: { type: Number, default: 0.01 },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "flex flex-col items-center gap-0.5 w-20" }, [
        h("label", { class: "text-[10px] text-base-content/60 leading-none" }, props.label),
        h("input", {
          type: "range",
          min: props.min,
          max: props.max,
          step: props.step,
          value: props.modelValue,
          class: "range range-xs range-primary w-full",
          onInput: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLInputElement).valueAsNumber),
        }),
        h("span", { class: "text-[9px] text-base-content/40 leading-none" },
          typeof props.modelValue === "number" ? props.modelValue.toFixed(2) : props.modelValue,
        ),
      ]);
  },
});

const ParamSelect = defineComponent({
  name: "ParamSelect",
  props: {
    label: { type: String, required: true },
    options: { type: Array as () => readonly string[] | readonly number[], required: true },
    modelValue: { type: Number, required: true },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "flex flex-col items-center gap-0.5" }, [
        h("label", { class: "text-[10px] text-base-content/60 leading-none" }, props.label),
        h(
          "select",
          {
            class: "select select-xs select-bordered w-24",
            value: props.modelValue,
            onChange: (e: Event) =>
              emit("update:modelValue", (e.target as HTMLSelectElement).selectedIndex),
          },
          props.options.map((opt, i) =>
            h("option", { key: i, value: i, selected: i === props.modelValue }, String(opt)),
          ),
        ),
      ]);
  },
});

export { ParamSlider, ParamSelect };
export default {};
</script>
