import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { LoadProgress } from "smplr";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";

const SAMPLER_STORAGE_KEY = "midi-jar-sampler-state";

/** 音色工厂类型 */
export type InstrumentFactoryType =
  | "soundfont"
  | "splendid-grand-piano"
  | "electric-piano"
  | "mallet"
  | "mellotron"
  | "drum-machine"
  | "smolken"
  | "versilian"
  | "drum-abuse";

/** 音色注册信息 */
export type InstrumentInfo = {
  id: string;
  name: string;
  category: InstrumentCategory;
  factory: InstrumentFactoryType;
  /** smplr instrument 选项 (传给工厂的额外参数) */
  factoryOptions?: Record<string, unknown>;
  loaded?: boolean;
  loading?: boolean;
  error?: string;
};

/** GM 音色分类 */
export type InstrumentCategory =
  | "Piano"
  | "Chromatic Percussion"
  | "Organ"
  | "Guitar"
  | "Bass"
  | "Strings"
  | "Ensemble"
  | "Brass"
  | "Reed"
  | "Pipe"
  | "Synth Lead"
  | "Synth Pad"
  | "Synth Effects"
  | "Ethnic"
  | "Percussive"
  | "Sound Effects"
  | "Drums";

/** GM 音色列表 (128 个标准音色 + 鼓组) */
const GM_INSTRUMENTS: InstrumentInfo[] = [
  // Piano
  {
    id: "acoustic_grand_piano",
    name: "Acoustic Grand Piano",
    category: "Piano",
    factory: "splendid-grand-piano",
  },
  {
    id: "bright_acoustic_piano",
    name: "Bright Acoustic Piano",
    category: "Piano",
    factory: "soundfont",
  },
  {
    id: "electric_grand_piano",
    name: "Electric Grand Piano",
    category: "Piano",
    factory: "electric-piano",
    factoryOptions: { instrument: "CP80" },
  },
  {
    id: "honkytonk_piano",
    name: "Honkytonk Piano",
    category: "Piano",
    factory: "soundfont",
  },
  {
    id: "electric_piano_1",
    name: "Electric Piano 1",
    category: "Piano",
    factory: "soundfont",
  },
  {
    id: "electric_piano_2",
    name: "Electric Piano 2",
    category: "Piano",
    factory: "soundfont",
  },
  {
    id: "harpsichord",
    name: "Harpsichord",
    category: "Piano",
    factory: "soundfont",
  },
  { id: "clavinet", name: "Clavinet", category: "Piano", factory: "soundfont" },
  // Chromatic Percussion
  {
    id: "celesta",
    name: "Celesta",
    category: "Chromatic Percussion",
    factory: "soundfont",
  },
  {
    id: "glockenspiel",
    name: "Glockenspiel",
    category: "Chromatic Percussion",
    factory: "soundfont",
  },
  {
    id: "music_box",
    name: "Music Box",
    category: "Chromatic Percussion",
    factory: "soundfont",
  },
  {
    id: "vibraphone",
    name: "Vibraphone",
    category: "Chromatic Percussion",
    factory: "mallet",
  },
  {
    id: "marimba",
    name: "Marimba",
    category: "Chromatic Percussion",
    factory: "mallet",
  },
  {
    id: "xylophone",
    name: "Xylophone",
    category: "Chromatic Percussion",
    factory: "mallet",
  },
  {
    id: "tubular_bells",
    name: "Tubular Bells",
    category: "Chromatic Percussion",
    factory: "soundfont",
  },
  {
    id: "dulcimer",
    name: "Dulcimer",
    category: "Chromatic Percussion",
    factory: "soundfont",
  },
  // Organ
  {
    id: "drawbar_organ",
    name: "Drawbar Organ",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "percussive_organ",
    name: "Percussive Organ",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "rock_organ",
    name: "Rock Organ",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "church_organ",
    name: "Church Organ",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "reed_organ",
    name: "Reed Organ",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "accordion",
    name: "Accordion",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "harmonica",
    name: "Harmonica",
    category: "Organ",
    factory: "soundfont",
  },
  {
    id: "tango_accordion",
    name: "Tango Accordion",
    category: "Organ",
    factory: "soundfont",
  },
  // Guitar
  {
    id: "acoustic_guitar_nylon",
    name: "Acoustic Guitar Nylon",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "acoustic_guitar_steel",
    name: "Acoustic Guitar Steel",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "electric_guitar_jazz",
    name: "Electric Guitar Jazz",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "electric_guitar_clean",
    name: "Electric Guitar Clean",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "electric_guitar_muted",
    name: "Electric Guitar Muted",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "overdriven_guitar",
    name: "Overdriven Guitar",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "distortion_guitar",
    name: "Distortion Guitar",
    category: "Guitar",
    factory: "soundfont",
  },
  {
    id: "guitar_harmonics",
    name: "Guitar Harmonics",
    category: "Guitar",
    factory: "soundfont",
  },
  // Bass
  {
    id: "acoustic_bass",
    name: "Acoustic Bass",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "electric_bass_finger",
    name: "Electric Bass Finger",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "electric_bass_pick",
    name: "Electric Bass Pick",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "fretless_bass",
    name: "Fretless Bass",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "slap_bass_1",
    name: "Slap Bass 1",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "slap_bass_2",
    name: "Slap Bass 2",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "synth_bass_1",
    name: "Synth Bass 1",
    category: "Bass",
    factory: "soundfont",
  },
  {
    id: "synth_bass_2",
    name: "Synth Bass 2",
    category: "Bass",
    factory: "soundfont",
  },
  // Strings
  { id: "violin", name: "Violin", category: "Strings", factory: "soundfont" },
  { id: "viola", name: "Viola", category: "Strings", factory: "soundfont" },
  { id: "cello", name: "Cello", category: "Strings", factory: "soundfont" },
  {
    id: "contrabass",
    name: "Contrabass",
    category: "Strings",
    factory: "soundfont",
  },
  {
    id: "tremolo_strings",
    name: "Tremolo Strings",
    category: "Strings",
    factory: "soundfont",
  },
  {
    id: "pizzicato_strings",
    name: "Pizzicato Strings",
    category: "Strings",
    factory: "soundfont",
  },
  {
    id: "orchestral_harp",
    name: "Orchestral Harp",
    category: "Strings",
    factory: "soundfont",
  },
  { id: "timpani", name: "Timpani", category: "Strings", factory: "soundfont" },
  // Ensemble
  {
    id: "string_ensemble_1",
    name: "String Ensemble 1",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "string_ensemble_2",
    name: "String Ensemble 2",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "synth_strings_1",
    name: "Synth Strings 1",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "synth_strings_2",
    name: "Synth Strings 2",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "choir_aahs",
    name: "Choir Aahs",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "voice_oohs",
    name: "Voice Oohs",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "synth_choir",
    name: "Synth Choir",
    category: "Ensemble",
    factory: "soundfont",
  },
  {
    id: "orchestra_hit",
    name: "Orchestra Hit",
    category: "Ensemble",
    factory: "soundfont",
  },
  // Brass
  { id: "trumpet", name: "Trumpet", category: "Brass", factory: "soundfont" },
  { id: "trombone", name: "Trombone", category: "Brass", factory: "soundfont" },
  { id: "tuba", name: "Tuba", category: "Brass", factory: "soundfont" },
  {
    id: "muted_trumpet",
    name: "Muted Trumpet",
    category: "Brass",
    factory: "soundfont",
  },
  {
    id: "french_horn",
    name: "French Horn",
    category: "Brass",
    factory: "soundfont",
  },
  {
    id: "brass_section",
    name: "Brass Section",
    category: "Brass",
    factory: "soundfont",
  },
  {
    id: "synth_brass_1",
    name: "Synth Brass 1",
    category: "Brass",
    factory: "soundfont",
  },
  {
    id: "synth_brass_2",
    name: "Synth Brass 2",
    category: "Brass",
    factory: "soundfont",
  },
  // Reed
  {
    id: "soprano_sax",
    name: "Soprano Sax",
    category: "Reed",
    factory: "soundfont",
  },
  { id: "alto_sax", name: "Alto Sax", category: "Reed", factory: "soundfont" },
  {
    id: "tenor_sax",
    name: "Tenor Sax",
    category: "Reed",
    factory: "soundfont",
  },
  {
    id: "baritone_sax",
    name: "Baritone Sax",
    category: "Reed",
    factory: "soundfont",
  },
  { id: "oboe", name: "Oboe", category: "Reed", factory: "soundfont" },
  {
    id: "english_horn",
    name: "English Horn",
    category: "Reed",
    factory: "soundfont",
  },
  { id: "bassoon", name: "Bassoon", category: "Reed", factory: "soundfont" },
  { id: "clarinet", name: "Clarinet", category: "Reed", factory: "soundfont" },
  // Pipe
  { id: "piccolo", name: "Piccolo", category: "Pipe", factory: "soundfont" },
  { id: "flute", name: "Flute", category: "Pipe", factory: "soundfont" },
  { id: "recorder", name: "Recorder", category: "Pipe", factory: "soundfont" },
  {
    id: "pan_flute",
    name: "Pan Flute",
    category: "Pipe",
    factory: "soundfont",
  },
  {
    id: "blown_bottle",
    name: "Blown Bottle",
    category: "Pipe",
    factory: "soundfont",
  },
  {
    id: "shakuhachi",
    name: "Shakuhachi",
    category: "Pipe",
    factory: "soundfont",
  },
  { id: "whistle", name: "Whistle", category: "Pipe", factory: "soundfont" },
  { id: "ocarina", name: "Ocarina", category: "Pipe", factory: "soundfont" },
  // Synth Lead
  {
    id: "lead_1_square",
    name: "Lead 1 (Square)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_2_sawtooth",
    name: "Lead 2 (Sawtooth)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_3_calliope",
    name: "Lead 3 (Calliope)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_4_chiff",
    name: "Lead 4 (Chiff)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_5_charang",
    name: "Lead 5 (Charang)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_6_voice",
    name: "Lead 6 (Voice)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_7_fifths",
    name: "Lead 7 (Fifths)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  {
    id: "lead_8_bass_lead",
    name: "Lead 8 (Bass + Lead)",
    category: "Synth Lead",
    factory: "soundfont",
  },
  // Synth Pad
  {
    id: "pad_1_new_age",
    name: "Pad 1 (New Age)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_2_warm",
    name: "Pad 2 (Warm)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_3_polysynth",
    name: "Pad 3 (Polysynth)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_4_choir",
    name: "Pad 4 (Choir)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_5_bowed",
    name: "Pad 5 (Bowed)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_6_metallic",
    name: "Pad 6 (Metallic)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_7_halo",
    name: "Pad 7 (Halo)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  {
    id: "pad_8_sweep",
    name: "Pad 8 (Sweep)",
    category: "Synth Pad",
    factory: "soundfont",
  },
  // Synth Effects
  {
    id: "fx_1_rain",
    name: "FX 1 (Rain)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_2_soundtrack",
    name: "FX 2 (Soundtrack)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_3_crystal",
    name: "FX 3 (Crystal)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_4_atmosphere",
    name: "FX 4 (Atmosphere)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_5_brightness",
    name: "FX 5 (Brightness)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_6_goblins",
    name: "FX 6 (Goblins)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_7_echoes",
    name: "FX 7 (Echoes)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  {
    id: "fx_8_sci-fi",
    name: "FX 8 (Sci-fi)",
    category: "Synth Effects",
    factory: "soundfont",
  },
  // Ethnic
  { id: "sitar", name: "Sitar", category: "Ethnic", factory: "soundfont" },
  { id: "banjo", name: "Banjo", category: "Ethnic", factory: "soundfont" },
  {
    id: "shamisen",
    name: "Shamisen",
    category: "Ethnic",
    factory: "soundfont",
  },
  { id: "koto", name: "Koto", category: "Ethnic", factory: "soundfont" },
  { id: "kalimba", name: "Kalimba", category: "Ethnic", factory: "soundfont" },
  { id: "bagpipe", name: "Bagpipe", category: "Ethnic", factory: "soundfont" },
  { id: "fiddle", name: "Fiddle", category: "Ethnic", factory: "soundfont" },
  { id: "shanai", name: "Shanai", category: "Ethnic", factory: "soundfont" },
  // Percussive
  {
    id: "tinkle_bell",
    name: "Tinkle Bell",
    category: "Percussive",
    factory: "soundfont",
  },
  { id: "agogo", name: "Agogo", category: "Percussive", factory: "soundfont" },
  {
    id: "steel_drums",
    name: "Steel Drums",
    category: "Percussive",
    factory: "soundfont",
  },
  {
    id: "woodblock",
    name: "Woodblock",
    category: "Percussive",
    factory: "soundfont",
  },
  {
    id: "taiko_drum",
    name: "Taiko Drum",
    category: "Percussive",
    factory: "soundfont",
  },
  {
    id: "melodic_tom",
    name: "Melodic Tom",
    category: "Percussive",
    factory: "soundfont",
  },
  {
    id: "synth_drum",
    name: "Synth Drum",
    category: "Percussive",
    factory: "soundfont",
  },
  {
    id: "reverse_cymbal",
    name: "Reverse Cymbal",
    category: "Percussive",
    factory: "soundfont",
  },
  // Sound Effects
  {
    id: "guitar_fret_noise",
    name: "Guitar Fret Noise",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "breath_noise",
    name: "Breath Noise",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "seashore",
    name: "Seashore",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "bird_tweet",
    name: "Bird Tweet",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "telephone_ring",
    name: "Telephone Ring",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "helicopter",
    name: "Helicopter",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "applause",
    name: "Applause",
    category: "Sound Effects",
    factory: "soundfont",
  },
  {
    id: "gunshot",
    name: "Gunshot",
    category: "Sound Effects",
    factory: "soundfont",
  },
  // Drums
  {
    id: "drum-kit",
    name: "Drum Kit",
    category: "Drums",
    factory: "drum-machine",
  },
];

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  "Piano",
  "Chromatic Percussion",
  "Organ",
  "Guitar",
  "Bass",
  "Strings",
  "Ensemble",
  "Brass",
  "Reed",
  "Pipe",
  "Synth Lead",
  "Synth Pad",
  "Synth Effects",
  "Ethnic",
  "Percussive",
  "Sound Effects",
  "Drums",
];

export const useSamplerStore = defineStore("sampler", () => {
  // --- State ---
  const currentInstrumentId = ref<string | null>(null);
  const instruments = ref<Record<string, InstrumentInfo>>({});
  const isLoading = ref(false);
  const isReady = ref(false);
  const loadProgress = ref<LoadProgress>({ loaded: 0, total: 0 });
  const error = ref<string | null>(null);
  /** 全局声音开关 — 控制所有页面是否使用采样器发声 */
  const soundEnabled = ref(true);

  // --- 持久化：仅保存 currentInstrumentId 和 soundEnabled ---
  const savedState = loadFromStorage<{
    currentInstrumentId: string | null;
    soundEnabled: boolean;
  }>({
    key: SAMPLER_STORAGE_KEY,
    defaultValue: { currentInstrumentId: null, soundEnabled: true },
  });
  if (savedState.currentInstrumentId) {
    currentInstrumentId.value = savedState.currentInstrumentId;
  }
  if (typeof savedState.soundEnabled === "boolean") {
    soundEnabled.value = savedState.soundEnabled;
  }

  // 自动持久化关键状态
  watch(
    [currentInstrumentId, soundEnabled],
    ([id, enabled]) => {
      saveToStorage(SAMPLER_STORAGE_KEY, {
        currentInstrumentId: id,
        soundEnabled: enabled,
      });
    },
    { deep: true },
  );

  /** 获取上次成功加载的乐器 ID（供 Sampler 页面 onMounted 恢复用） */
  const savedInstrumentId = computed(() => {
    const id = loadFromStorage<{ currentInstrumentId: string | null }>({
      key: SAMPLER_STORAGE_KEY,
      defaultValue: { currentInstrumentId: null },
    }).currentInstrumentId;
    return id;
  });

  // --- Getters ---
  const currentInstrument = computed<InstrumentInfo | null>(() => {
    if (!currentInstrumentId.value) return null;
    return instruments.value[currentInstrumentId.value] ?? null;
  });

  const gmInstrumentCatalog = computed<InstrumentInfo[]>(() => {
    return GM_INSTRUMENTS;
  });

  const instrumentsByCategory = computed<
    Record<InstrumentCategory, InstrumentInfo[]>
  >(() => {
    const result: Record<string, InstrumentInfo[]> = {};
    for (const inst of GM_INSTRUMENTS) {
      if (!result[inst.category]) result[inst.category] = [];
      result[inst.category].push(inst);
    }
    return result as Record<InstrumentCategory, InstrumentInfo[]>;
  });

  // --- Actions ---
  function registerInstrument(info: InstrumentInfo) {
    instruments.value[info.id] = { ...info };
  }

  function setCurrentInstrument(id: string) {
    currentInstrumentId.value = id;
  }

  function setLoading(value: boolean) {
    isLoading.value = value;
  }

  function setReady(value: boolean) {
    isReady.value = value;
  }

  function setLoadProgress(progress: LoadProgress) {
    loadProgress.value = progress;
  }

  function setError(msg: string | null) {
    error.value = msg;
  }

  function updateInstrumentStatus(
    id: string,
    status: { loaded?: boolean; loading?: boolean; error?: string },
  ) {
    const inst = instruments.value[id];
    if (inst) {
      if (status.loaded !== undefined) inst.loaded = status.loaded;
      if (status.loading !== undefined) inst.loading = status.loading;
      if (status.error !== undefined) inst.error = status.error;
    }
  }

  return {
    // state
    currentInstrumentId,
    instruments,
    isLoading,
    isReady,
    loadProgress,
    error,
    soundEnabled,
    // getters
    currentInstrument,
    gmInstrumentCatalog,
    instrumentsByCategory,
    savedInstrumentId,
    // actions
    registerInstrument,
    setCurrentInstrument,
    setLoading,
    setReady,
    setLoadProgress,
    setError,
    updateInstrumentStatus,
  };
});
