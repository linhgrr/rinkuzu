/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enAdaptive from '@/../messages/en/adaptiveLearning.json';
import viAdaptive from '@/../messages/vi/adaptiveLearning.json';
import type { ProcessingErrorState } from '@/features/adaptive/hooks/use-processing-state';
import { ProcessingStatusCard } from './ProcessingSections';

const t = (key: string) => key;

function renderCard(error: ProcessingErrorState, onAction = vi.fn()) {
  render(
    <ProcessingStatusCard
      creatingSession={false}
      currentStep={-1}
      error={error}
      filename="notes.pdf"
      handleErrorAction={onAction}
      notice={null}
      progress={30}
      stats={null}
      statusLabel=""
      steps={[]}
      t={t}
    />,
  );
  return onAction;
}

const stalled: ProcessingErrorState = {
  message: 'errors.api.codes.pipelineStalled',
  retryable: true,
  code: 'pipeline_stalled',
  action: 'upload',
};

describe('ProcessingStatusCard failure action (RIN-809)', () => {
  afterEach(cleanup);

  it('labels the upload action as re-uploading, not as a retry', () => {
    const onAction = renderCard(stalled);

    const button = screen.getByRole('button', { name: 'processing.uploadAgain' });
    expect(screen.queryByRole('button', { name: 'processing.tryAgain' })).not.toBeInTheDocument();
    expect(button.querySelector('[data-icon="upload"]')).not.toBeNull();
    expect(button.querySelector('[data-icon="back"]')).toBeNull();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('keeps the back arrow on the go-to-dashboard action', () => {
    renderCard({ ...stalled, action: 'dashboard' });

    const button = screen.getByRole('button', { name: 'processing.goToDashboard' });
    expect(button.querySelector('[data-icon="back"]')).not.toBeNull();
  });

  it('has vi and en copy for the re-upload label', () => {
    expect(viAdaptive.processing.uploadAgain).toBe('Tải lại tài liệu');
    expect(enAdaptive.processing.uploadAgain).toBe('Upload again');
    expect(viAdaptive.processing).not.toHaveProperty('tryAgain');
    expect(enAdaptive.processing).not.toHaveProperty('tryAgain');
  });
});
