/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enAdaptive from '@/../messages/en/adaptiveLearning.json';
import viAdaptive from '@/../messages/vi/adaptiveLearning.json';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import { HeroSection } from './HeroSection';
import { SubjectCard } from './Library';
import { CancelProcessingModal } from './CancelProcessingModal';

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const t = (key: string) => key;

function subjectStub(overrides: Partial<DashboardSubject> = {}): DashboardSubject {
  return {
    jobId: 'job-1',
    filename: 'calculus.pdf',
    subjectId: 'subject-1',
    status: 'extracting',
    conceptsExtracted: 0,
    conceptsAfterMerge: 0,
    relationsAccepted: 0,
    completedAt: null,
    masteredConcept: 0,
    allConcept: 0,
    progressPercent: 0,
    displayTitle: 'Calculus I',
    lastOpenedLabel: 'Recently added',
    progressLabel: '',
    ctaLabel: 'Start',
    metrics: { masteredConcepts: 0, allConcepts: 0, progressPercent: 0, remainingConcepts: 0 },
    runtime: { kind: 'processing', progressPercent: 30, stageLabel: 'Reading', etaSeconds: null },
    exercise: null,
    ...overrides,
  };
}

function renderHero(props: Partial<Parameters<typeof HeroSection>[0]> = {}) {
  const handlers = {
    onGoUpload: vi.fn(),
    onOpenSubject: vi.fn(),
    onCancel: vi.fn(),
    onViewProcessing: vi.fn(),
  };
  render(
    <HeroSection
      subject={subjectStub()}
      loading={false}
      loadingJobId={null}
      busyJobId={null}
      t={t}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function cancelButton() {
  return screen.getByRole('button', { name: /cancelProcessing|cancellingProcessing/ });
}

describe('processing Cancel on the /adaptive library (RIN-1005)', () => {
  afterEach(cleanup);

  it('hero Cancel uses the same ghost red-text style as the job cards', () => {
    renderHero();
    const heroCancel = cancelButton();
    cleanup();
    render(
      <SubjectCard
        subject={subjectStub()}
        loading={false}
        deleting={false}
        busy={false}
        onOpenSubject={vi.fn()}
        onCancel={vi.fn()}
        t={t}
      />,
    );
    const cardCancel = cancelButton();

    expect(heroCancel.className).not.toMatch(/\bbg-red-600\b/);
    expect(heroCancel.className).toMatch(/\btext-red-600\b/);
    expect(heroCancel.className).toBe(cardCancel.className);
  });

  it('hero keeps View progress as its main action and Cancel asks the parent', () => {
    const handlers = renderHero();

    fireEvent.click(screen.getByRole('button', { name: 'viewProcessing' }));
    expect(handlers.onViewProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1' }),
    );

    fireEvent.click(cancelButton());
    expect(handlers.onCancel).toHaveBeenCalledWith('job-1');
    expect(handlers.onOpenSubject).not.toHaveBeenCalled();
  });

  it('hero Cancel is disabled and says it is cancelling while the job is busy', () => {
    renderHero({ busyJobId: 'job-1' });

    expect(cancelButton()).toBeDisabled();
    expect(cancelButton()).toHaveTextContent('cancellingProcessing');
  });

  it('shows the reassurance line under the hero progress bar while processing only', () => {
    renderHero();
    expect(screen.getByText('processingReassurance')).toBeInTheDocument();

    cleanup();
    renderHero({ subject: subjectStub({ runtime: { kind: 'ready' } }) });
    expect(screen.queryByText('processingReassurance')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'continueLearning' })).toBeInTheDocument();
  });

  it('shows the reassurance line on a processing job card', () => {
    render(
      <SubjectCard
        subject={subjectStub()}
        loading={false}
        deleting={false}
        busy
        onOpenSubject={vi.fn()}
        onCancel={vi.fn()}
        t={t}
      />,
    );

    expect(screen.getByText('processingReassurance')).toBeInTheDocument();
    expect(cancelButton()).toBeDisabled();
    expect(cancelButton()).toHaveTextContent('cancellingProcessing');
  });

  it('has the reassurance and confirmation copy in en and vi', () => {
    const keys = [
      'processingReassurance',
      'cancellingProcessing',
      'cancelProcessingTitle',
      'cancelProcessingDescription',
      'cancelProcessingConfirm',
      'keepProcessing',
    ] as const;
    const en = enAdaptive.dashboard as Record<string, unknown>;
    const vi = viAdaptive.dashboard as Record<string, unknown>;

    for (const key of keys) {
      expect(typeof en[key], `en ${key}`).toBe('string');
      expect(typeof vi[key], `vi ${key}`).toBe('string');
      expect(vi[key], `vi ${key} is translated`).not.toBe(en[key]);
    }
    expect(en['processingReassurance']).toBe(
      'Usually takes a few minutes. You can leave this page, we keep working.',
    );
  });

  it('confirmation asks before cancelling and keeps a failure inline', () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <CancelProcessingModal
        isOpen
        isLoading={false}
        error="Could not reach Rinkuzu"
        onConfirm={onConfirm}
        onCancel={onCancel}
        t={t}
      />,
    );

    expect(screen.getByText('cancelProcessingTitle')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach Rinkuzu');
    fireEvent.click(screen.getByRole('button', { name: 'keepProcessing' }));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'cancelProcessingConfirm' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
