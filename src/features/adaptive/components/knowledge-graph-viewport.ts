/** Laid-out node size used by the dagre layout in KnowledgeGraph. */
export const GRAPH_NODE_WIDTH = 150;
export const GRAPH_NODE_HEIGHT = 70;

/** Space kept clear at the start of the rank axis (the embedded title sits top-left). */
const START_PADDING = { TB: 88, LR: 24 } as const;
const EDGE_PADDING = 24;

interface PositionedNode {
  position: { x: number; y: number };
}

export interface ReadableViewport {
  x: number;
  y: number;
  zoom: number;
}

function placeAxis(start: number, size: number, available: number, startPadding: number) {
  if (size + startPadding + EDGE_PADDING <= available) {
    return (available - size) / 2 - start;
  }
  return startPadding - start;
}

/**
 * Viewport for a graph that cannot fit at 100% zoom (RIN-1010).
 *
 * React Flow's fitView would shrink it until the 12px labels are unreadable,
 * and clamping the zoom alone centres it, which cuts off the first concepts.
 * Instead keep 100% zoom, centre each axis that fits, and anchor the rank axis
 * (top-down: y, left-right: x) at the first rank so learners pan forward from
 * the start. Returns null when the whole graph fits; fitView handles that.
 */
export function getReadableViewport(
  nodes: readonly PositionedNode[],
  direction: 'TB' | 'LR',
  viewportWidth: number,
  viewportHeight: number,
): ReadableViewport | null {
  if (nodes.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) + GRAPH_NODE_WIDTH - minX;
  const height = Math.max(...ys) + GRAPH_NODE_HEIGHT - minY;
  const startPadding = START_PADDING[direction];
  const xPadding = direction === 'LR' ? startPadding : EDGE_PADDING;
  const yPadding = direction === 'TB' ? startPadding : EDGE_PADDING;

  const fitsWidth = width + xPadding + EDGE_PADDING <= viewportWidth;
  const fitsHeight = height + yPadding + EDGE_PADDING <= viewportHeight;
  if (fitsWidth && fitsHeight) return null;

  return {
    x:
      direction === 'LR' || fitsWidth
        ? placeAxis(minX, width, viewportWidth, xPadding)
        : (viewportWidth - width) / 2 - minX,
    y:
      direction === 'TB' || fitsHeight
        ? placeAxis(minY, height, viewportHeight, yPadding)
        : (viewportHeight - height) / 2 - minY,
    zoom: 1,
  };
}
