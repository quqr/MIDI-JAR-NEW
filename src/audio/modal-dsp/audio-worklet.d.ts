// AudioWorklet API type declarations
// These globals are available inside AudioWorkletProcessor scripts

/** Global sample rate available in AudioWorklet scope */
declare const sampleRate: number;

/** Register an AudioWorkletProcessor subclass */
declare function registerProcessor(
  name: string,
  processorCtor: typeof AudioWorkletProcessor
): void;

/** Automation rate for AudioParam */
type AudioParamAutomationRate = 'a-rate' | 'k-rate';

/** Descriptor for an AudioParam exposed by an AudioWorkletProcessor */
interface AudioParamDescriptor {
  name: string;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: AudioParamAutomationRate;
}

/** Base class for AudioWorklet processors */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;

  constructor(options?: AudioWorkletNodeOptions);

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;

  static get parameterDescriptors(): AudioParamDescriptor[];
}
