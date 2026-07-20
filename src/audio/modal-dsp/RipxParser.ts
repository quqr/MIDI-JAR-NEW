// Parser for .ripx preset files (JUCE copyXmlToBinary format)
// Format:
//   Bytes 0-3:  Magic number 0x21324356 (little-endian), hex: 56 43 32 21
//   Bytes 4-7:  XML string length N (little-endian uint32)
//   Bytes 8 to 8+N-1: UTF-8 XML string
//   Byte 8+N:  Null terminator (0x00)
//
// The XML contains <PARAMETERS><PARAM id="xxx" value="yyy"/>...</PARAMETERS>
// Values in .ripx are stored as the actual parameter values (denormalized),
// not the 0-1 normalized values used by JUCE internally.

import { normalizeParam, PARAM_DEF_MAP } from './ParamDefs';

const RIPX_MAGIC = 0x21324356;

/** Parse a .ripx binary buffer into a parameter map (actual values) */
export function parseRipx(buffer: ArrayBuffer): Record<string, number> {
  const view = new DataView(buffer);

  if (buffer.byteLength < 8) {
    throw new Error('Invalid .ripx file: too short');
  }

  const magic = view.getUint32(0, true); // little-endian
  if (magic !== RIPX_MAGIC) {
    throw new Error(`Invalid .ripx file: bad magic number 0x${magic.toString(16)}`);
  }

  const xmlLength = view.getUint32(4, true);
  if (8 + xmlLength > buffer.byteLength) {
    throw new Error('Invalid .ripx file: XML length exceeds buffer');
  }

  const xmlBytes = new Uint8Array(buffer, 8, xmlLength);
  const xmlString = new TextDecoder('utf-8').decode(xmlBytes);

  return parseRipxXml(xmlString);
}

/** Parse the XML string from a .ripx file into a parameter map (actual values) */
export function parseRipxXml(xml: string): Record<string, number> {
  const params: Record<string, number> = {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const paramNodes = doc.querySelectorAll('PARAM');
  paramNodes.forEach(node => {
    const id = node.getAttribute('id');
    const valueAttr = node.getAttribute('value');
    if (id && valueAttr !== null) {
      params[id] = parseFloat(valueAttr);
    }
  });

  // Migrate legacy a_cut/b_cut values (old format stored Hz, new format is normalized -1 to 1)
  for (const cutId of ['a_cut', 'b_cut']) {
    if (cutId in params && params[cutId] >= 20.0) {
      // Old value was in Hz, convert to new normalized range
      params[cutId] = Math.log(params[cutId] / 20.0) / Math.log(20000.0 / 20.0);
    }
  }

  return params;
}

/** Convert actual parameter values from .ripx XML to 0-1 normalized values for the synth */
export function ripxParamsToNormalized(params: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [id, value] of Object.entries(params)) {
    const def = PARAM_DEF_MAP.get(id);
    if (!def) continue;

    // For choice/bool params, the stored value is already the choice index
    if (def.type === 'choice' || def.type === 'bool') {
      if (def.choices) {
        normalized[id] = def.choices.length > 1 ? value / (def.choices.length - 1) : 0;
      } else if (def.type === 'bool') {
        normalized[id] = value >= 0.5 ? 1 : 0;
      } else {
        normalized[id] = value;
      }
    } else {
      // For float params, convert from actual value to 0-1 normalized
      normalized[id] = normalizeParam(id, value);
    }
  }
  return normalized;
}

/** Load and parse a .ripx file from a File object */
export async function loadPresetFromRipx(file: File): Promise<Record<string, number>> {
  const buffer = await file.arrayBuffer();
  return parseRipx(buffer);
}

/** Load and parse a .ripx file, returning normalized values */
export async function loadPresetFromRipxNormalized(file: File): Promise<Record<string, number>> {
  const params = await loadPresetFromRipx(file);
  return ripxParamsToNormalized(params);
}
