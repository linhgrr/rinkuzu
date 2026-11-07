import { describe, expect, it } from 'vitest';
import { getGraphLayout, getReadableViewport } from './knowledge-graph-viewport';

const at = (x: number, y: number) => ({ position: { x, y } });

describe('getReadableViewport', () => {
  it('leaves a graph that fits at 100% to fitView', () => {
    expect(getReadableViewport([at(0, 0), at(200, 170)], 'TB', 800, 600)).toBeNull();
  });

  it('anchors a tall top-down graph at its first rank and centres it horizontally', () => {
    const nodes = [at(100, 0), at(0, 170), at(200, 340), at(100, 510), at(100, 680)];

    const viewport = getReadableViewport(nodes, 'TB', 1000, 600);

    expect(viewport).toEqual({ zoom: 1, x: (1000 - 350) / 2, y: 88 });
  });

  it('anchors a wide left-right graph at its first rank and centres it vertically', () => {
    const nodes = [at(0, 100), at(250, 0), at(500, 200), at(750, 100), at(1000, 100)];

    const viewport = getReadableViewport(nodes, 'LR', 700, 500);

    expect(viewport).toEqual({ zoom: 1, x: 24, y: (500 - 270) / 2 });
  });

  it('centres a graph wider than the view on its first two ranks, not on the whole graph', () => {
    // Rank 0 at x=150, rank 1 spans 150..422, rank 2 spans 0..1050 (RIN-1116).
    const nodes = [at(150, 0), at(150, 170), at(294, 170), at(0, 340), at(922, 340)];

    const viewport = getReadableViewport(nodes, 'TB', 341, 500, 128);

    expect(viewport).toEqual({ zoom: 1, x: (341 - 272) / 2 - 150, y: 88 });
  });

  it('anchors the first two ranks at the left edge when even they are wider than the view', () => {
    const nodes = [at(300, 0), at(0, 170), at(300, 170), at(600, 170), at(300, 340)];

    const viewport = getReadableViewport(nodes, 'TB', 341, 500);

    expect(viewport).toEqual({ zoom: 1, x: 24, y: 88 });
  });

  it('returns null without nodes or a measured viewport', () => {
    expect(getReadableViewport([], 'TB', 800, 600)).toBeNull();
    expect(getReadableViewport([at(0, 0), at(0, 900)], 'TB', 0, 0)).toBeNull();
  });
});

describe('getGraphLayout', () => {
  it('keeps the desktop layout at 1280px and wider', () => {
    expect(getGraphLayout('TB', 1000)).toEqual({
      compact: false,
      nodeWidth: 150,
      nodeSeparation: 80,
    });
    expect(getGraphLayout('LR', 341)).toEqual({
      compact: false,
      nodeWidth: 150,
      nodeSeparation: 80,
    });
  });

  it('narrows a top-down graph on a phone so two sibling concepts fit at 100% (RIN-1116)', () => {
    for (const width of [326, 341]) {
      const layout = getGraphLayout('TB', width);
      expect(layout.compact).toBe(true);
      // Two siblings plus 24px on each side fit the canvas of a 360px and a 375px phone.
      expect(2 * layout.nodeWidth + layout.nodeSeparation + 48).toBeLessThanOrEqual(width);
    }
  });
});
