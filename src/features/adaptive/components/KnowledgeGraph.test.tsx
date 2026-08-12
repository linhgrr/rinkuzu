/** @vitest-environment jsdom */

import type { MouseEvent, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConceptDetail } from '@/features/adaptive/lib/adaptive-api-methods';
import type { ConceptDetail, KnowledgeGraphData } from '@/features/adaptive/types/graph';
import { useKnowledgeGraph } from '@/hooks/useAdaptive';
import KnowledgeGraph from './KnowledgeGraph';

const { fitViewMock } = vi.hoisted(() => ({
  fitViewMock: vi.fn(),
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
  }: {
    nodes: Array<{ id: string; data: { label: string } }>;
    onNodeClick?: (event: MouseEvent<HTMLElement>, node: { id: string }) => void;
    children?: ReactNode;
  }) => (
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
  ),
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
