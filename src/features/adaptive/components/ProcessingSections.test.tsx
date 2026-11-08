/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enAdaptive from '@/../messages/en/adaptiveLearning.json';
import viAdaptive from '@/../messages/vi/adaptiveLearning.json';
import enErrors from '@/../messages/en/errors.json';
import viErrors from '@/../messages/vi/errors.json';
import type { ProcessingErrorState } from '@/features/adaptive/hooks/use-processing-state';
import { ProcessingStatusCard } from './ProcessingSections';

const t = (key: string) => key;

const STEPS = [1, 2, 3, 4, 5, 6].map((id) => ({ id, label: `step-${id}` }));

type CardOptions = {
  canRetry?: boolean;
  failedStep?: number | null;
};

function renderCard(error: ProcessingErrorState, options: CardOptions = {}) {
  const handlers = { onRetry: vi.fn(), onUploadAgain: vi.fn(), onBackToLibrary: vi.fn() };
  render(
    <ProcessingStatusCard
      canRetry={options.canRetry ?? false}
      creatingSession={false}
      currentStep={-1}
      error={error}
      failedStep={options.failedStep ?? null}
      filename="notes.pdf"
      notice={null}
      progress={30}
      retrying={false}
      stats={null}
      statusLabel=""
      steps={STEPS}
      t={t}
      {...handlers}
    />,
  );
  return handlers;
}

const stalled: ProcessingErrorState = {
  message: 'errors.api.codes.pipelineStalled',
  retryable: true,
  code: 'pipeline_stalled',
  action: 'upload',
};

describe('ProcessingStatusCard failure actions (RIN-809, RIN-1004)', () => {
  afterEach(cleanup);

  it('offers Try again and Back to library when the job can be re-run', () => {
    const handlers = renderCard(stalled, { canRetry: true, failedStep: 3 });

    fireEvent.click(screen.getByRole('button', { name: 'processing.tryAgain' }));
    expect(handlers.onRetry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'processing.backToLibrary' }));
    expect(handlers.onBackToLibrary).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'processing.uploadAgain' })).toBeNull();
  });

  it('labels the upload action as re-uploading when the job cannot be re-run', () => {
    const handlers = renderCard({ ...stalled, retryable: false });

    const button = screen.getByRole('button', { name: 'processing.uploadAgain' });
    expect(screen.queryByRole('button', { name: 'processing.tryAgain' })).not.toBeInTheDocument();
    expect(button.querySelector('[data-icon="upload"]')).not.toBeNull();
    fireEvent.click(button);
    expect(handlers.onUploadAgain).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'processing.backToLibrary' })).toBeInTheDocument();
  });

  it('makes Back to library primary for dashboard-action errors', () => {
    renderCard({ ...stalled, action: 'dashboard' }, { canRetry: true });

    const button = screen.getByRole('button', { name: 'processing.backToLibrary' });
    expect(button.querySelector('[data-icon="back"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'processing.tryAgain' })).toBeNull();
    expect(screen.getByRole('button', { name: 'processing.uploadAgain' })).toBeInTheDocument();
  });

  it('keeps the step list with the failed step marked', () => {
    renderCard(stalled, { canRetry: true, failedStep: 6 });

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-step-state'))).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
      'failed',
    ]);
    expect(items[5]).toHaveTextContent('step-6 (processing.stepFailed)');
  });

  it('hides the step list when the failure is not tied to a step', () => {
    renderCard(stalled);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('has vi and en copy for the failure actions', () => {
    expect(viAdaptive.processing.uploadAgain).toBe('Tải lại tài liệu');
    expect(enAdaptive.processing.uploadAgain).toBe('Upload again');
    expect(enAdaptive.processing.tryAgain).toBe('Try again');
    expect(viAdaptive.processing.tryAgain).toBe('Thử lại');
    expect(enAdaptive.processing.backToLibrary).toBe('Back to library');
    expect(viAdaptive.processing.backToLibrary).toBe('Về thư viện');
  });

  it('never tells the learner to upload again for a step failure they can retry', () => {
    const locales = [
      { adaptive: enAdaptive, errors: enErrors },
      { adaptive: viAdaptive, errors: viErrors },
    ];
    for (const { adaptive, errors } of locales) {
      const { failedAtStep, pipelineTimeout, pipelineCancelled, pipelineUnavailable } =
        adaptive.processing.errors;
      // pipeline_stalled is retryable and shows Try again (QA RIN-1092).
      const { pipelineStalled } = errors.api.codes;
      for (const copy of [
        failedAtStep,
        pipelineTimeout,
        pipelineCancelled,
        pipelineUnavailable,
        pipelineStalled,
      ]) {
        expect(copy).not.toMatch(/upload|tải lại tài liệu|tải tài liệu lên|tải lên lại/i);
      }
    }
  });
});
