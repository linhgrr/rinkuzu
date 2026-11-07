/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubjectDetailsState } from '@/features/adaptive/hooks/use-subject-details-state';
import SubjectDetails from './SubjectDetails';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function DynamicStub() {
      return null;
    },
}));

vi.mock('@/features/adaptive/hooks/use-subject-details-state', () => ({
  useSubjectDetailsState: vi.fn(),
}));

const useStateMock = vi.mocked(useSubjectDetailsState);
const backMock = vi.fn();

function mockState(overrides: Partial<ReturnType<typeof useSubjectDetailsState>> = {}) {
  useStateMock.mockReturnValue({
    activeTab: 'graph',
    filename: 'Biology notes',
    handleBackToDashboard: backMock,
    handlePrefetchStartLearning: vi.fn(),
    handleStartLearning: vi.fn(),
    historyDetail: null,
    historyLoading: false,
    loading: false,
    notFound: false,
    sessionNotice: null,
    setActiveTab: vi.fn(),
    startingSession: false,
    status: null,
    summary: 'summary',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState();
});

describe('SubjectDetails', () => {
  it('shows a not-found state with a way back and no start CTA for an unknown session', () => {
    mockState({ notFound: true, activeTab: 'history' });

    render(<SubjectDetails sessionId="unknown" />);

    expect(screen.getByText('subjectDetails.notFound')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subjectDetails\.startLearning/ })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /subjectDetails\.backToDashboard/ }));
    expect(backMock).toHaveBeenCalled();
  });

  it('keeps the start CTA for a known session', () => {
    render(<SubjectDetails sessionId="session-1" />);

    expect(
      screen.getByRole('button', { name: /subjectDetails\.startLearning/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('subjectDetails.notFound')).toBeNull();
  });

  it('uses learner copy for the empty and loading history states', () => {
    mockState({ activeTab: 'history' });
    const { rerender } = render(<SubjectDetails sessionId="session-1" />);
    expect(screen.getByText('history.empty')).toBeInTheDocument();

    mockState({ activeTab: 'history', historyLoading: true });
    rerender(<SubjectDetails sessionId="session-1" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('history.loading');
  });
});
