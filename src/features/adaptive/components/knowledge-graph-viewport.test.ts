import { describe, expect, it } from 'vitest';
import { getReadableViewport } from './knowledge-graph-viewport';

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

  it('keeps the top-down cross axis centred even when the graph is wider than the view', () => {
    const nodes = [at(0, 0), at(900, 0), at(450, 600)];

    const viewport = getReadableViewport(nodes, 'TB', 375, 600);

    expect(viewport).toEqual({ zoom: 1, x: (375 - 1050) / 2, y: 88 });
  });

  it('returns null without nodes or a measured viewport', () => {
    expect(getReadableViewport([], 'TB', 800, 600)).toBeNull();
    expect(getReadableViewport([at(0, 0), at(0, 900)], 'TB', 0, 0)).toBeNull();
  });
});
