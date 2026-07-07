import type { Node, Edge, MarkerType, Position } from "@vue-flow/core";
import type {
  MidiInput,
  MidiOutput,
  MidiRoute,
  MidiWire,
} from "@/stores/midiRouting";

export function mapDevicesToNodes(
  inputs: MidiInput[],
  outputs: MidiOutput[],
  savedPositions?: Record<string, { x: number; y: number }>,
): Node[] {
  const nodes: Node[] = [];
  const verticalGap = 80;
  const positions = savedPositions ?? {};
  const inputX = 500;
  const outputX = 50;

  inputs.forEach((input, index) => {
    const id = `input-${input.name}`;
    nodes.push({
      id,
      type: "input",
      position: positions[id] ?? { x: inputX, y: index * verticalGap + 40 },
      sourcePosition: "left" as Position,
      data: {
        label: input.name,
        device: input,
      },
    });
  });

  outputs.forEach((output, index) => {
    if (output.type === "internal") {
      const id = `output-internal`;
      nodes.push({
        id,
        type: "internal-output",
        position: positions[id] ?? { x: outputX, y: index * verticalGap + 40 },
        targetPosition: "right" as Position,
        data: {
          label: "internal",
          displayName: "Internal Modules",
          type: "internal",
          device: output,
        },
      });
    } else {
      const id = `output-${output.name}`;
      nodes.push({
        id,
        type: "physical-output",
        position: positions[id] ?? { x: outputX, y: index * verticalGap + 40 },
        targetPosition: "right" as Position,
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

export function mapRoutesToEdges(
  routes: MidiRoute[],
  wires: MidiWire[],
): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];

  for (const route of routes) {
    const targetId =
      route.type === "internal" ? "output-internal" : `output-${route.output}`;

    const edgeId = `edge-${route.input}-${targetId}`;
    if (seen.has(edgeId)) continue;
    seen.add(edgeId);

    const wire = wires.find(
      (w) =>
        w.route.input === route.input &&
        w.route.output === route.output &&
        w.route.type === route.type,
    );
    const connected = wire?.connected ?? false;

    edges.push({
      id: edgeId,
      source: `input-${route.input}`,
      target: targetId,
      type: "wire",
      animated: connected,
      markerEnd: {
        type: "arrowclosed" as MarkerType,
        color: "color-mix(in oklch, var(--color-base-content) 50%, transparent)",
      },
      style: {
        strokeWidth: connected ? 4 : 2.5,
      },
      data: {
        route,
      },
    });
  }

  return edges;
}
