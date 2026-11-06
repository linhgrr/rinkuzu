/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enAdaptive from '@/../messages/en/adaptiveLearning.json';
import viAdaptive from '@/../messages/vi/adaptiveLearning.json';
import type { PipelinePartialGraph } from '@/features/adaptive/types/pipeline';
import { ProcessingGraphCard } from './ProcessingGraphCard';

vi.mock('next/dynamic', () => ({
  default: () =>
    function GraphPanelStub() {
      return <div data-testid="graph-panel" />;
    },
}));

const t = (key: string) => key;

const graph: PipelinePartialGraph = {
  nodes: [{ id: 'a', name: 'Limits' }],
  edges: [],
};

describe('ProcessingGraphCard (RIN-1003)', () => {
  afterEach(cleanup);

  it('shows one static line and no shimmer while no concepts exist', () => {
    render(<ProcessingGraphCard partialGraph={null} creatingSession={false} t={t} />);

    expect(screen.getByText('processing.graphPlaceholder')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('graph-panel')).not.toBeInTheDocument();
  });

  it('treats an empty graph like no graph', () => {
    render(
      <ProcessingGraphCard partialGraph={{ nodes: [], edges: [] }} creatingSession={false} t={t} />,
    );

    expect(screen.getByText('processing.graphPlaceholder')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-panel')).not.toBeInTheDocument();
  });

  it('says the session is being created at hand-off when no concepts arrived', () => {
    render(<ProcessingGraphCard partialGraph={null} creatingSession t={t} />);

    expect(screen.getByText('processing.creatingSession')).toBeInTheDocument();
    expect(screen.queryByText('processing.graphPlaceholder')).not.toBeInTheDocument();
  });

  it('renders the graph once concepts exist', () => {
    render(<ProcessingGraphCard partialGraph={graph} creatingSession={false} t={t} />);

    expect(screen.getByTestId('graph-panel')).toBeInTheDocument();
    expect(screen.queryByText('processing.graphPlaceholder')).not.toBeInTheDocument();
  });

  it('keeps the heading in normal flow, not absolutely positioned over the panel', () => {
    render(<ProcessingGraphCard partialGraph={null} creatingSession={false} t={t} />);

    const heading = screen.getByRole('heading', { name: 'processing.knowledgeGraph' });
    expect(heading.closest('.absolute')).toBeNull();
    expect(screen.getByText('processing.graphDescription')).toBeInTheDocument();
  });

  it('has en and vi copy for the new strings', () => {
    for (const messages of [enAdaptive, viAdaptive]) {
      expect(messages.processing.graphPlaceholder).toEqual(expect.any(String));
      expect(messages.processing.graphDescription).toEqual(expect.any(String));
    }
  });
});
