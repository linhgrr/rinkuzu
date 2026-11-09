/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MasteryMatrix from './MasteryMatrix';

const { matrix } = vi.hoisted(() => ({
  matrix: {
    session_id: 'session-1',
    bloom_labels: ['Remember', 'Understand'],
    matrix: [{ concept_id: 'c1', concept_name: 'Cell membrane', bloom_levels: [0.84, 0.79] }],
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/useAdaptive', () => ({
  useMasteryMatrix: () => ({ data: matrix, isLoading: false }),
  useKnowledgeGraph: () => ({ data: undefined, isLoading: false }),
}));

describe('MasteryMatrix', () => {
  it('shows the no-data state instead of predicted mastery before any answer', () => {
    render(<MasteryMatrix sessionId="session-1" answeredCount={0} />);

    expect(screen.getByText('masteryMatrix.noData')).toBeInTheDocument();
    expect(screen.getByText('masteryMatrix.noDataHint')).toBeInTheDocument();
    expect(screen.queryByText('Cell membrane')).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('shows the matrix once the learner has answered', () => {
    render(<MasteryMatrix sessionId="session-1" answeredCount={1} />);

    expect(screen.getByText('Cell membrane')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.queryByText('masteryMatrix.noData')).toBeNull();
  });
});
