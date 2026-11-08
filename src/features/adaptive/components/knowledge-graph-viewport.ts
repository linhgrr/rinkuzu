/** Laid-out node size used by the dagre layout in KnowledgeGraph. */
const GRAPH_NODE_WIDTH = 150;
export const GRAPH_NODE_HEIGHT = 70;

/** Below this canvas width a top-down graph uses narrower nodes and gaps (a phone, RIN-1116). */
const COMPACT_MAX_WIDTH = 480;
const COMPACT_NODE_WIDTH = 128;
const COMPACT_NODE_SEPARATION = 16;
const NODE_SEPARATION = 80;

export interface GraphLayout {
  compact: boolean;
  nodeWidth: number;
  nodeSeparation: number;
}

/**
 * Node width and sibling gap for the dagre layout. On a phone two 150px siblings
 * 80px apart are wider than the canvas, so the second rank opened clipped
 * (RIN-1116); narrower nodes keep two siblings in view at 100% zoom.
 */
export function getGraphLayout(direction: 'TB' | 'LR', viewportWidth: number): GraphLayout {
  if (direction === 'TB' && viewportWidth > 0 && viewportWidth < COMPACT_MAX_WIDTH) {
    return {
      compact: true,
      nodeWidth: COMPACT_NODE_WIDTH,
      nodeSeparation: COMPACT_NODE_SEPARATION,
    };
  }
  return { compact: false, nodeWidth: GRAPH_NODE_WIDTH, nodeSeparation: NODE_SEPARATION };
}

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

/** Nodes of the first two ranks: the start of the path, which must open unclipped. */
function getLeadingRanks<T extends PositionedNode>(
  nodes: readonly T[],
  rankAxis: 'x' | 'y',
): readonly T[] {
  const ranks = [...new Set(nodes.map((node) => node.position[rankAxis]))].sort((a, b) => a - b);
  const lastLeadingRank = ranks[Math.min(1, ranks.length - 1)] ?? 0;
  return nodes.filter((node) => node.position[rankAxis] <= lastLeadingRank);
}

/**
 * Cross-axis offset when the whole graph is wider (or taller) than the view:
 * centre the first two ranks, or start them at the edge if even they do not fit.
 */
function placeCrossAxis(
  nodes: readonly PositionedNode[],
  crossAxis: 'x' | 'y',
  nodeSize: number,
  available: number,
) {
  const leading = getLeadingRanks(nodes, crossAxis === 'x' ? 'y' : 'x');
  const starts = leading.map((node) => node.position[crossAxis]);
  const start = Math.min(...starts);
  const size = Math.max(...starts) + nodeSize - start;
  return placeAxis(start, size, available, EDGE_PADDING);
}

/**
 * Viewport for a graph that cannot fit at 100% zoom (RIN-1010).
 *
 * React Flow's fitView would shrink it until the 12px labels are unreadable,
 * and clamping the zoom alone centres it, which cuts off the first concepts.
 * Instead keep 100% zoom, centre each axis that fits, and anchor the rank axis
 * (top-down: y, left-right: x) at the first rank so learners pan forward from
 * the start. A cross axis that does not fit is centred on the first two ranks
 * rather than the whole graph, so their concepts open unclipped (RIN-1116).
 * Returns null when the whole graph fits; fitView handles that.
 */
export function getReadableViewport(
  nodes: readonly PositionedNode[],
  direction: 'TB' | 'LR',
  viewportWidth: number,
  viewportHeight: number,
  nodeWidth: number = GRAPH_NODE_WIDTH,
): ReadableViewport | null {
  if (nodes.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) + nodeWidth - minX;
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
        : placeCrossAxis(nodes, 'x', nodeWidth, viewportWidth),
    y:
      direction === 'TB' || fitsHeight
        ? placeAxis(minY, height, viewportHeight, yPadding)
        : placeCrossAxis(nodes, 'y', GRAPH_NODE_HEIGHT, viewportHeight),
    zoom: 1,
  };
}
