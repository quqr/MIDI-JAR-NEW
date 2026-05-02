import { ref } from "vue";
import type { Node } from "@vue-flow/core";

const SNAP_THRESHOLD = 5;

export interface HelperLine {
  type: "horizontal" | "vertical";
  position: number;
}

export function useHelperLines() {
  const helperLines = ref<HelperLine[]>([]);

  function onNodeDrag({ node, nodes }: { node: Node; nodes: Node[] }) {
    const lines: HelperLine[] = [];
    const otherNodes = nodes.filter((n) => n.id !== node.id);

    const nodeData = node as any;
    const nodeCenterX = node.position.x + (nodeData.dimensions?.width ?? 0) / 2;
    const nodeCenterY =
      node.position.y + (nodeData.dimensions?.height ?? 0) / 2;
    const nodeLeft = node.position.x;
    const nodeRight = node.position.x + (nodeData.dimensions?.width ?? 0);
    const nodeTop = node.position.y;
    const nodeBottom = node.position.y + (nodeData.dimensions?.height ?? 0);

    let snappedX: number | null = null;
    let snappedY: number | null = null;

    for (const other of otherNodes) {
      const otherData = other as any;
      const otherCenterX =
        other.position.x + (otherData.dimensions?.width ?? 0) / 2;
      const otherCenterY =
        other.position.y + (otherData.dimensions?.height ?? 0) / 2;
      const otherLeft = other.position.x;
      const otherRight = other.position.x + (otherData.dimensions?.width ?? 0);
      const otherTop = other.position.y;
      const otherBottom =
        other.position.y + (otherData.dimensions?.height ?? 0);

      if (Math.abs(nodeCenterY - otherCenterY) < SNAP_THRESHOLD) {
        lines.push({ type: "horizontal", position: otherCenterY });
        if (snappedY === null) snappedY = otherCenterY;
      }
      if (Math.abs(nodeTop - otherTop) < SNAP_THRESHOLD) {
        lines.push({ type: "horizontal", position: otherTop });
        if (snappedY === null) snappedY = otherTop;
      }
      if (Math.abs(nodeBottom - otherBottom) < SNAP_THRESHOLD) {
        lines.push({ type: "horizontal", position: otherBottom });
        if (snappedY === null) snappedY = otherBottom;
      }

      if (Math.abs(nodeCenterX - otherCenterX) < SNAP_THRESHOLD) {
        lines.push({ type: "vertical", position: otherCenterX });
        if (snappedX === null) snappedX = otherCenterX;
      }
      if (Math.abs(nodeLeft - otherLeft) < SNAP_THRESHOLD) {
        lines.push({ type: "vertical", position: otherLeft });
        if (snappedX === null) snappedX = otherLeft;
      }
      if (Math.abs(nodeRight - otherRight) < SNAP_THRESHOLD) {
        lines.push({ type: "vertical", position: otherRight });
        if (snappedX === null) snappedX = otherRight;
      }
    }

    helperLines.value = lines;

    if (snappedX !== null || snappedY !== null) {
      const width = nodeData.dimensions?.width ?? 0;
      const height = nodeData.dimensions?.height ?? 0;

      const newX = snappedX !== null ? snappedX - width / 2 : node.position.x;
      const newY = snappedY !== null ? snappedY - height / 2 : node.position.y;

      const nodeToUpdate = nodes.find((n) => n.id === node.id);
      if (nodeToUpdate) {
        nodeToUpdate.position = { x: newX, y: newY };
      }
    }
  }

  function onNodeDragStop() {
    helperLines.value = [];
  }

  return { helperLines, onNodeDrag, onNodeDragStop };
}
