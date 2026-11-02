/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  captureAnalyticsEventMock,
  checkApiReadinessMock,
  trackAdaptivePipelineJobMock,
  uploadPdfMock,
} = vi.hoisted(() => ({
  captureAnalyticsEventMock: vi.fn(),
  checkApiReadinessMock: vi.fn(),
  trackAdaptivePipelineJobMock: vi.fn(),
  uploadPdfMock: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  checkApiReadiness: checkApiReadinessMock,
  uploadPdf: uploadPdfMock,
}));
vi.mock('@/features/adaptive/lib/session-storage', () => ({ saveSelectedPipelineJob: vi.fn() }));
vi.mock('@/features/adaptive/lib/pipeline-analytics', () => ({
  trackAdaptivePipelineJob: trackAdaptivePipelineJobMock,
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: captureAnalyticsEventMock,
  fileSizeBucket: () => 'lt_1mb',
}));
vi.mock('@/lib/pdf', () => ({ getPdfPageCount: vi.fn().mockResolvedValue(3) }));
vi.mock('@/hooks/usePdfUploadPolicy', () => ({
  usePdfUploadPolicy: () => ({ isLoading: false, maxBytes: 10 * 1024 * 1024, maxPages: 30 }),
}));

import AdaptiveLearningUpload from '@/features/adaptive/components/Upload';

async function submitUpload() {
  const user = userEvent.setup();
  const { container } = render(<AdaptiveLearningUpload />);
  await user.type(screen.getByLabelText(/uploadPage.subjectName/), 'Biology');
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' }));
  const submit = screen.getByRole('button', { name: 'uploadPage.createLearningPath' });
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);
}

function failedEventProps() {
  const call = captureAnalyticsEventMock.mock.calls.find(([name]) => name === 'pdf_upload_failed');
  return call?.[1];
}

describe('AdaptiveLearningUpload health gate', () => {
  beforeEach(() => {
    uploadPdfMock.mockResolvedValue({ job_id: 'job-1' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(['unauthorized', 'not_ready'] as const)(
    'does not retry %s and reports it as health_cause',
    async (cause) => {
      checkApiReadinessMock.mockResolvedValue({ ok: false, cause });

      await submitUpload();

      await waitFor(() => expect(failedEventProps()).toBeDefined());
      expect(failedEventProps()).toMatchObject({
        reason: 'service_unavailable',
        health_cause: cause,
      });
      expect(checkApiReadinessMock).toHaveBeenCalledTimes(1);
      expect(uploadPdfMock).not.toHaveBeenCalled();
    },
  );

  it('retries a transient failure once and proceeds to uploadPdf on success', async () => {
    checkApiReadinessMock
      .mockResolvedValueOnce({ ok: false, cause: 'network' })
      .mockResolvedValueOnce({ ok: true });

    await submitUpload();

    await waitFor(() => expect(uploadPdfMock).toHaveBeenCalledTimes(1), { timeout: 3_000 });
    expect(checkApiReadinessMock).toHaveBeenCalledTimes(2);
    expect(failedEventProps()).toBeUndefined();
    // The accepted job is tracked under the upload's journey so its terminal outcome can report.
    const accepted = captureAnalyticsEventMock.mock.calls.find(
      ([name]) => name === 'pdf_upload_completed',
    );
    expect(trackAdaptivePipelineJobMock).toHaveBeenCalledWith('job-1', accepted?.[1].journey_id);
  });

  it('reports the cause of the retry when a transient failure persists', async () => {
    checkApiReadinessMock
      .mockResolvedValueOnce({ ok: false, cause: 'upstream_error' })
      .mockResolvedValueOnce({ ok: false, cause: 'timeout' });

    await submitUpload();

    await waitFor(() => expect(failedEventProps()).toBeDefined(), { timeout: 3_000 });
    expect(failedEventProps()).toMatchObject({
      reason: 'service_unavailable',
      health_cause: 'timeout',
    });
    expect(checkApiReadinessMock).toHaveBeenCalledTimes(2);
    expect(uploadPdfMock).not.toHaveBeenCalled();
  });
});
