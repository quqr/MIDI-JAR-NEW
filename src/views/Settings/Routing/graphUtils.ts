import type { Node, Edge, MarkerType, Position } from "@vue-flow/core";
import type { MidiInput, MidiOutput, MidiWire } from "@/types/midi";

export function mapDevicesToNodes(
  inputs: MidiInput[],
  outputs: MidiOutput[],
): Node[] {
  const nodes: Node[] = [];

  inputs.forEach((input) => {
    nodes.push({
      id: `input-${input.name}`,
      type: "input",
      position: { x: 0, y: 0 },
      sourcePosition: "right" as Position,
      data: {
        label: input.name,
        device: input,
      },
    });
  });

  outputs.forEach((output) => {
    if (output.type === "internal") {
      nodes.push({
        id: `output-internal`,
        type: "internal-output",
        position: { x: 0, y: 0 },
        targetPosition: "left" as Position,
        data: {
          label: "internal",
          displayName: "Internal Modules",
          type: "internal",
          device: output,
        },
      });
    } else {
      nodes.push({
        id: `output-${output.name}`,
        type: "physical-output",
        position: { x: 0, y: 0 },
        targetPosition: "left" as Position,
        data: {
          label: output.name,
          displayName: output.name,
          type: "physical",
          device: output,
        },
      });
    }
  });

  return nodes;
}

export function mapWiresToEdges(
  wires: MidiWire[],
  onDelete: (wire: MidiWire) => void,
): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];

  for (const wire of wires) {
    const targetId =
      wire.route.type === "internal"
        ? "output-internal"
        : `output-${wire.route.output}`;

    const edgeId = `edge-${wire.route.input}-${targetId}`;
    if (seen.has(edgeId)) continue;
    seen.add(edgeId);

    edges.push({
      id: edgeId,
      source: `input-${wire.route.input}`,
      target: targetId,
      type: "wire",
      animated: wire.connected,
      markerEnd: {
        type: "arrowclosed" as MarkerType,
        color: "hsl(var(--color-base-content) / 0.5)",
      },
      style: {
        strokeWidth: wire.connected ? 4 : 2.5,
      },
      data: {
        route: wire.route,
        wire,
        onDelete,
      },
    });
  }

  return edges;
}
