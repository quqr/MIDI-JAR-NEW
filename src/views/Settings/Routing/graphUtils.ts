import type { Node, Edge, MarkerType, Position } from "@vue-flow/core";
import type { MidiInput, MidiOutput, MidiWire } from "@/types/midi";

export const NODE_VERTICAL_SPACING = 32;
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;

export function mapDevicesToNodes(
  inputs: MidiInput[],
  outputs: MidiOutput[],
  viewportWidth: number,
): Node[] {
  const nodes: Node[] = [];

  inputs.forEach((input, index) => {
    const y = 20 + index * (NODE_HEIGHT + NODE_VERTICAL_SPACING);
    nodes.push({
      id: `input-${input.name}`,
      type: "input",
      position: { x: 20, y },
      sourcePosition: "right" as Position,
      data: {
        label: input.name,
        status: input.connected ? "Connected" : "Disconnected",
        device: input,
      },
    });
  });

  outputs.forEach((output, index) => {
    const y = 20 + index * (NODE_HEIGHT + NODE_VERTICAL_SPACING);
    nodes.push({
      id: `output-${output.name}`,
      type: "output",
      position: { x: viewportWidth - NODE_WIDTH - 20, y },
      targetPosition: "left" as Position,
      data: {
        label: output.name,
        type: output.type,
        status: output.connected ? "Connected" : "Disconnected",
        device: output,
      },
    });
  });

  return nodes;
}

export function mapWiresToEdges(
  wires: MidiWire[],
  onDelete: (wire: MidiWire) => void,
): Edge[] {
  return wires.map((wire) => ({
    id: `edge-${wire.route.input}-${wire.route.output}`,
    source: `input-${wire.route.input}`,
    target: `output-${wire.route.output}`,
    type: "smoothstep",
    animated: wire.connected,
    markerEnd: {
      type: "arrowclosed" as MarkerType,
    },
    style: {
      stroke: wire.connected ? "hsl(var(--su))" : "hsl(var(--bc) / 0.4)",
      strokeWidth: 2,
    },
    data: {
      route: wire.route,
      wire,
      onDelete,
    },
  }));
}
