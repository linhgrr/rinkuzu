/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionStatus } from '@/features/adaptive/types/learning';
import { SubjectDetailsHero } from './SubjectDetailsSections';

vi.mock('next/dynamic', () => ({
  default: () =>
    function DynamicStub() {
      return null;
    },
}));

const t = (key: string) => key;

function makeStatus(overrides: Partial<SessionStatus> = {}): SessionStatus {
  return {
    session_id: 'session-1',
    status: 'active',
    step: 0,
    max_steps: 20,
    concepts_visited: 0,
    total_concepts: 12,
    unlocked_concepts: 3,
    locked_concepts: 9,
    mastered_concepts: 0,
    avg_mastery: 0.84,
    progress_percent: 0,
    coverage: 0,
    total_correct: 0,
    total_answered: 0,
    accuracy: 0,
    exercises: [],
    ...overrides,
  } as SessionStatus;
}

function renderHero(status: SessionStatus) {
  return render(
    <SubjectDetailsHero
      filename="Biology notes"
      loading={false}
      onPrefetchStartLearning={vi.fn()}
      onStartLearning={vi.fn()}
      sessionNotice={null}
      startingSession={false}
      status={status}
      summary="summary"
      t={t}
    />,
  );
}

function statCard(label: string) {
  const card = screen.getByText(label).closest('[data-stat-card]');
  if (!(card instanceof HTMLElement)) throw new Error(`No stat card for ${label}`);
  return card;
}

describe('SubjectDetailsHero stats', () => {
  it('shows no predicted mastery or accuracy before the first answer', () => {
    renderHero(makeStatus({ total_answered: 0, avg_mastery: 0.84 }));

    expect(within(statCard('stats.accuracyRate')).getByText('—')).toBeInTheDocument();
    expect(within(statCard('stats.averageMastery')).getByText('—')).toBeInTheDocument();
    expect(screen.getAllByText('stats.afterFirstExercise')).toHaveLength(2);
    expect(within(statCard('stats.correctTotal')).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('shows the measured percentages once the learner has answered', () => {
    renderHero(
      makeStatus({ total_answered: 4, total_correct: 3, accuracy: 0.75, avg_mastery: 0.62 }),
    );

    expect(within(statCard('stats.accuracyRate')).getByText('75%')).toBeInTheDocument();
    expect(within(statCard('stats.averageMastery')).getByText('62%')).toBeInTheDocument();
    expect(within(statCard('stats.correctTotal')).getByText('3/4')).toBeInTheDocument();
    expect(screen.queryByText('stats.afterFirstExercise')).toBeNull();
  });
});
