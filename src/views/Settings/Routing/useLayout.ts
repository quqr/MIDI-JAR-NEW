import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@vue-flow/core";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 64;

export function useLayout() {
  function layout(
    nodes: Node[],
    edges: Edge[],
    direction: "LR" | "TB" = "LR",
  ): Node[] {
    const g = new dagre.graphlib.Graph();

    g.setGraph({
      rankdir: direction,
      nodesep: 50,
      ranksep: 250,
      edgesep: 30,
      marginx: 40,
      marginy: 40,
    });

    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) {
      const nodeData = node as any;
      g.setNode(node.id, {
        width: nodeData.dimensions?.width ?? NODE_WIDTH,
        height: nodeData.dimensions?.height ?? NODE_HEIGHT,
      });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    return nodes.map((node) => {
      const dagreNode = g.node(node.id);
      if (!dagreNode) return node;

      const nodeData = node as any;
      const width = nodeData.dimensions?.width ?? NODE_WIDTH;
      const height = nodeData.dimensions?.height ?? NODE_HEIGHT;

      return {
        ...node,
        position: {
          x: dagreNode.x - width / 2,
          y: dagreNode.y - height / 2,
        },
      };
    });
  }

  return { layout };
}
