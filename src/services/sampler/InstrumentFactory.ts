import * as smplr from "smplr";
import type { InstrumentInfo, InstrumentFactoryType } from "@/stores/sampler";
import type { SmplrInstance } from "./types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("InstrumentFactory");

type FactoryFn = (
  ctx: BaseAudioContext,
  options: Record<string, unknown>,
) => SmplrInstance;

interface CommonOptions {
  volume: number;
  loader: unknown;
  scheduler: unknown;
}

interface FactoryConfig {
  /** smplr 构造函数 */
  build: FactoryFn;
  /** 组装该乐器的完整 options（合并 commonOptions） */
  options: (
    info: InstrumentInfo,
    common: CommonOptions,
  ) => Record<string, unknown>;
}

/** 任意 smplr 构造函数的最宽泛签名（用于抹平各 options 类型差异） */
type SmplrCtor<TOpts> = (ctx: BaseAudioContext, options: TOpts) => unknown;

/**
 * 包装 smplr 构造函数，统一以 Record<string, unknown> 接收 options，
 * 内部一次性完成类型断言，避免在每个 case 重复 as unknown as 样板。
 */
function wrapCtor<TOpts>(ctor: SmplrCtor<TOpts>): FactoryFn {
  return (ctx, options) =>
    ctor(ctx, options as unknown as TOpts) as unknown as SmplrInstance;
}

/** 从 factoryOptions.instrument 或 info.id 解析乐器名 */
function factoryInstrument(info: InstrumentInfo): string {
  return (info.factoryOptions?.instrument as string) ?? info.id;
}

const FACTORY_CONFIGS: Record<InstrumentFactoryType, FactoryConfig> = {
  "splendid-grand-piano": {
    build: wrapCtor(smplr.SplendidGrandPiano),
    options: (_info, common) => ({ ...common, decayTime: 0.5 }),
  },
  soundfont: {
    build: wrapCtor(smplr.Soundfont),
    options: (info, common) => ({ ...common, instrument: info.id }),
  },
  "electric-piano": {
    build: wrapCtor(smplr.ElectricPiano),
    options: (info, common) => ({
      ...common,
      instrument: factoryInstrument(info),
    }),
  },
  mallet: {
    build: wrapCtor(smplr.Mallet),
    options: (info, common) => ({
      ...common,
      instrument: factoryInstrument(info),
    }),
  },
  mellotron: {
    build: wrapCtor(smplr.Mellotron),
    options: (info, common) => ({
      ...common,
      instrument: factoryInstrument(info),
    }),
  },
  "drum-machine": {
    build: wrapCtor(smplr.DrumMachine),
    options: (_info, common) => ({ ...common, instrument: "TR-808" }),
  },
  smolken: {
    build: wrapCtor(smplr.Smolken),
    options: (info, common) => ({
      ...common,
      instrument: factoryInstrument(info),
    }),
  },
  versilian: {
    build: wrapCtor(smplr.Versilian),
    options: (info, common) => ({
      ...common,
      instrument: factoryInstrument(info),
    }),
  },
  "drum-abuse": {
    // drum-abuse 在 smplr 中无专用工厂，按原实现回退到 Soundfont
    build: wrapCtor(smplr.Soundfont),
    options: (info, common) => ({ ...common, instrument: info.id }),
  },
};

/**
 * 创建 smplr 乐器实例（配置驱动，消除 switch-case）
 *
 * @param ctx AudioContext（由 AudioContextService 提供）
 * @param loader 共享 SampleLoader
 * @param scheduler 共享 Scheduler
 * @param info 乐器注册信息（含 factory 类型与可选 factoryOptions）
 */
export function createInstrument(
  ctx: BaseAudioContext,
  loader: unknown,
  scheduler: unknown,
  info: InstrumentInfo,
): SmplrInstance {
  const config = FACTORY_CONFIGS[info.factory] ?? FACTORY_CONFIGS.soundfont;
  const common: CommonOptions = { volume: 100, loader, scheduler };
  const options = config.options(info, common);
  logger.debug("[InstrumentFactory] Creating %s via %s", info.id, info.factory);
  return config.build(ctx, options);
}
