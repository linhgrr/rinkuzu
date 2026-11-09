/** @vitest-environment jsdom */

import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConceptDetail } from '@/features/adaptive/lib/adaptive-api-methods';
import type { ConceptDetail, KnowledgeGraphData } from '@/features/adaptive/types/graph';
import { useKnowledgeGraph } from '@/hooks/useAdaptive';
import KnowledgeGraph from './KnowledgeGraph';

const { fitViewMock, pushMock, reactFlowProps, flowSize } = vi.hoisted(() => ({
  fitViewMock: vi.fn(),
  pushMock: vi.fn(),
  reactFlowProps: { current: null as Record<string, unknown> | null },
  flowSize: { width: 800, height: 600 },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/useAdaptive', () => ({
  useKnowledgeGraph: vi.fn(),
}));

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  getConceptDetail: vi.fn(),
}));

vi.mock('./ConceptDetail', () => ({
  default: () => <div data-testid="concept-detail">Concept detail</div>,
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    onNodeClick,
    children,
    ...rest
  }: {
    nodes: Array<{ id: string; data: { label: string } }>;
    onNodeClick?: (event: MouseEvent<HTMLElement>, node: { id: string }) => void;
    children?: ReactNode;
  } & Record<string, unknown>) => {
    reactFlowProps.current = { ...rest, nodes };
    return (
      <div data-testid="react-flow">
        {nodes.map((node) => (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            onClick={(event) => onNodeClick?.(event, node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click();
            }}
          >
            {node.data.label}
          </div>
        ))}
        {children}
      </div>
    );
  },
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  MarkerType: {
    ArrowClosed: 'arrowclosed',
  },
  useReactFlow: () => ({ fitView: fitViewMock, setViewport: vi.fn() }),
  useStore: (selector: (state: { width: number; height: number }) => number) => selector(flowSize),
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const graphData: KnowledgeGraphData = {
  nodes: [
    {
      id: 'concept-1',
      index: 0,
      name: 'Concept 1',
      status: 'available',
      mastery: 0.25,
      visited: false,
    },
  ],
  edges: [],
};

const conceptDetail: ConceptDetail = {
  id: 'concept-1',
  name: 'Concept 1',
  definition: 'Concept definition',
  mastery: 0.25,
  status: 'available',
  bloom_mastery: [],
  prerequisites: [],
  dependents: [],
  visited: false,
  visit_count: 0,
};

const useKnowledgeGraphMock = vi.mocked(useKnowledgeGraph);
const getConceptDetailMock = vi.mocked(getConceptDetail);

beforeEach(() => {
  vi.clearAllMocks();
  flowSize.width = 800;
  flowSize.height = 600;
  useKnowledgeGraphMock.mockReturnValue({
    data: graphData,
    isLoading: false,
    error: undefined,
  } as ReturnType<typeof useKnowledgeGraph>);
  getConceptDetailMock.mockResolvedValue(conceptDetail);
});

describe('KnowledgeGraph', () => {
  it('opens concept detail when a React Flow node is clicked', async () => {
    render(<KnowledgeGraph sessionId="session-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Concept 1' }));

    await waitFor(() => {
      expect(getConceptDetailMock).toHaveBeenCalledWith('session-1', 'concept-1');
    });
    expect(await screen.findByTestId('concept-detail')).toBeInTheDocument();
  });
});

type ConceptNodeProps = {
  data: {
    label: string;
    status: string;
    mastery: number;
    showMastery?: boolean;
    direction: 'TB' | 'LR';
    compact?: boolean;
    nodeWidth?: number;
  };
};

function renderConceptNode(data: ConceptNodeProps['data']) {
  const nodeTypes = reactFlowProps.current?.['nodeTypes'] as
    | Record<string, ComponentType<ConceptNodeProps>>
    | undefined;
  const ConceptNode = nodeTypes?.['concept'];
  if (!ConceptNode) throw new Error('concept node type missing');
  return render(<ConceptNode data={data} />);
}

describe('KnowledgeGraph readability (RIN-1010)', () => {
  it('never zooms out below 100% so 12px labels stay 12px', () => {
    render(<KnowledgeGraph sessionId="session-1" />);

    expect(reactFlowProps.current?.['minZoom']).toBeGreaterThanOrEqual(1);
    expect(
      (reactFlowProps.current?.['fitViewOptions'] as { minZoom?: number }).minZoom,
    ).toBeGreaterThanOrEqual(1);
    expect(fitViewMock).not.toHaveBeenCalledWith(expect.objectContaining({ minZoom: 0.2 }));
  });

  it('keeps locked node labels at full opacity and readable contrast', () => {
    render(<KnowledgeGraph sessionId="session-1" />);
    const { container } = renderConceptNode({
      label: 'Locked concept',
      status: 'locked',
      mastery: 0,
      direction: 'TB',
    });

    const node = container.firstElementChild as HTMLElement;
    expect(node.className).not.toMatch(/(?:^|\s)opacity-\d+/);
    const label = screen.getByText('Locked concept');
    expect(label.className).toContain('text-xs');
    expect(label.className).not.toMatch(/text-neutral-(?:300|400)/);
  });

  it('truncates long concept names and keeps the full name in a title', () => {
    render(<KnowledgeGraph sessionId="session-1" />);
    const longName = 'An extremely long concept name that does not fit the node';
    renderConceptNode({ label: longName, status: 'available', mastery: 0.5, direction: 'TB' });

    const label = screen.getByTitle(longName);
    expect(label.textContent).not.toBe(longName);
    expect(label.textContent?.endsWith('…')).toBe(true);
  });
});

describe('KnowledgeGraph before the first answer (RIN-1274)', () => {
  function nodeData() {
    const nodes = reactFlowProps.current?.['nodes'] as Array<{ data: { showMastery: boolean } }>;
    return nodes.map((node) => node.data.showMastery);
  }

  it('hides predicted node mastery when nothing has been answered', () => {
    render(<KnowledgeGraph sessionId="session-1" answeredCount={0} />);
    expect(nodeData().every((show) => show === false)).toBe(true);

    renderConceptNode({
      label: 'Fresh concept',
      status: 'available',
      mastery: 0.84,
      showMastery: false,
      direction: 'TB',
    });
    expect(screen.queryByText('84%')).toBeNull();
  });

  it('shows node mastery once the learner has answered', () => {
    render(<KnowledgeGraph sessionId="session-1" answeredCount={3} />);
    expect(nodeData().every((show) => show === true)).toBe(true);

    renderConceptNode({
      label: 'Practised concept',
      status: 'available',
      mastery: 0.84,
      showMastery: true,
      direction: 'TB',
    });
    expect(screen.getByText('84%')).toBeInTheDocument();
  });
});

describe('KnowledgeGraph load error (RIN-1010)', () => {
  it('shows the learning-path message with retry and back actions', () => {
    const mutate = vi.fn();
    useKnowledgeGraphMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isValidating: false,
      error: new Error('503'),
      mutate: async () => {
        mutate();
        return undefined;
      },
    });

    render(<KnowledgeGraph sessionId="session-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('knowledgeGraph.loadError');
    fireEvent.click(screen.getByRole('button', { name: 'exercise.tryAgain' }));
    expect(mutate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'exercise.backToDashboard' }));
    expect(pushMock).toHaveBeenCalledWith('/adaptive');
  });
});

const siblingGraph: KnowledgeGraphData = {
  nodes: ['root', 'left', 'right'].map((id, index) => ({
    id,
    index,
    name: id,
    status: 'available' as const,
    mastery: 0,
    visited: false,
  })),
  edges: [
    { source: 'root', target: 'left' },
    { source: 'root', target: 'right' },
  ],
};

type LaidOutNode = { id: string; position: { x: number; y: number }; data: { compact?: boolean } };

function renderGraphAt(width: number) {
  flowSize.width = width;
  useKnowledgeGraphMock.mockReturnValue({
    data: siblingGraph,
    isLoading: false,
    error: undefined,
  } as ReturnType<typeof useKnowledgeGraph>);
  render(<KnowledgeGraph sessionId="session-1" />);
  const nodes = reactFlowProps.current?.['nodes'] as LaidOutNode[];
  const find = (id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node) throw new Error(`node ${id} missing`);
    return node;
  };
  return { left: find('left'), right: find('right') };
}

describe('KnowledgeGraph on a phone (RIN-1116)', () => {
  it('keeps the legend in the card flow below the canvas on mobile and floating from sm up', () => {
    render(<KnowledgeGraph sessionId="session-1" />);

    const legend = screen.getByTestId('knowledge-graph-legend');
    // Static on mobile, so it never covers the graph, the zoom controls or the help button.
    expect(legend.className).not.toMatch(/(?:^|\s)absolute(?:\s|$)/);
    expect(legend.className).toContain('sm:absolute');
    expect(legend.className).toContain('sm:left-1/2');
    expect(legend.className).toContain('sm:-translate-x-1/2');
    expect(legend.className).not.toContain('sm:right-5');
    expect(
      screen.getByTestId('react-flow').compareDocumentPosition(legend) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('outlines the Available and Locked swatches in the strong node border, Locked dashed (RIN-1119)', () => {
    render(<KnowledgeGraph sessionId="session-1" />);

    const legend = screen.getByTestId('knowledge-graph-legend');
    const swatch = (label: string) => {
      const item = within(legend).getByText(label).parentElement;
      const dot = item?.querySelector('[data-legend-swatch]');
      if (!dot) throw new Error(`swatch for ${label} missing`);
      return dot.className;
    };
    expect(swatch('knowledgeGraph.legend.available')).toMatch(/border-line-blue/);
    expect(swatch('knowledgeGraph.legend.available')).not.toMatch(/border-dashed/);
    expect(swatch('knowledgeGraph.legend.locked')).toMatch(/border-line-blue/);
    expect(swatch('knowledgeGraph.legend.locked')).toMatch(/border-dashed/);
  });

  it('lays two sibling concepts out side by side within a 375px canvas', () => {
    const { left, right } = renderGraphAt(341);

    expect(left.data.compact).toBe(true);
    const span =
      Math.max(left.position.x, right.position.x) +
      128 -
      Math.min(left.position.x, right.position.x);
    expect(span + 48).toBeLessThanOrEqual(341);
  });

  it('keeps the desktop spacing at 1280px', () => {
    const { left, right } = renderGraphAt(1000);

    expect(left.data.compact).toBe(false);
    expect(Math.abs(right.position.x - left.position.x)).toBe(150 + 80);
  });

  it('gives compact nodes a fixed width that matches the layout', () => {
    render(<KnowledgeGraph sessionId="session-1" />);
    const { container } = renderConceptNode({
      label: 'Phone concept',
      status: 'available',
      mastery: 0,
      direction: 'TB',
      compact: true,
      nodeWidth: 128,
    });

    expect((container.firstElementChild as HTMLElement).style.width).toBe('128px');
  });
});
