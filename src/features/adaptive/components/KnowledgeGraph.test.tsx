/** @vitest-environment jsdom */

import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConceptDetail } from '@/features/adaptive/lib/adaptive-api-methods';
import type { ConceptDetail, KnowledgeGraphData } from '@/features/adaptive/types/graph';
import { useKnowledgeGraph } from '@/hooks/useAdaptive';
import KnowledgeGraph from './KnowledgeGraph';

const { fitViewMock, pushMock, reactFlowProps } = vi.hoisted(() => ({
  fitViewMock: vi.fn(),
  pushMock: vi.fn(),
  reactFlowProps: { current: null as Record<string, unknown> | null },
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
    reactFlowProps.current = rest;
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
  useReactFlow: () => ({ fitView: fitViewMock }),
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
  data: { label: string; status: string; mastery: number; direction: 'TB' | 'LR' };
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
