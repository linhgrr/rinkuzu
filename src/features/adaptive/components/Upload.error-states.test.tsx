/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import viAdaptive from '@/../messages/vi/adaptiveLearning.json';
import viCommon from '@/../messages/vi/common.json';
import viErrors from '@/../messages/vi/errors.json';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';

// RIN-754: upload failures read as learner copy picked by kind/code, never the server's text.

const { checkApiReadinessMock, uploadPdfMock, toastErrorMock } = vi.hoisted(() => ({
  checkApiReadinessMock: vi.fn(),
  uploadPdfMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => '/adaptive-learning/upload',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));
vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  checkApiReadiness: checkApiReadinessMock,
  uploadPdf: uploadPdfMock,
}));
vi.mock('@/features/adaptive/lib/session-storage', () => ({ saveSelectedPipelineJob: vi.fn() }));
vi.mock('@/features/adaptive/lib/pipeline-analytics', () => ({
  trackAdaptivePipelineJob: vi.fn(),
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  fileSizeBucket: () => 'lt_1mb',
}));
vi.mock('@/lib/pdf', () => ({ getPdfPageCount: vi.fn().mockResolvedValue(3) }));
vi.mock('@/hooks/usePdfUploadPolicy', () => ({
  usePdfUploadPolicy: () => ({ isLoading: false, maxBytes: 10 * 1024 * 1024, maxPages: 30 }),
}));

import AdaptiveLearningUpload from '@/features/adaptive/components/Upload';

const RAW = 'Traceback: worker-7 rejected s3://bucket/key';
const api = viErrors.api;

async function submitUpload() {
  const user = userEvent.setup();
  const { container } = render(
    <NextIntlClientProvider
      locale="vi"
      messages={{ adaptiveLearning: viAdaptive, common: viCommon, errors: viErrors }}
    >
      <AdaptiveLearningUpload />
    </NextIntlClientProvider>,
  );
  await user.type(screen.getByLabelText(new RegExp(viAdaptive.uploadPage.subjectName)), 'Sinh');
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' }));
  const submit = screen.getByRole('button', { name: viAdaptive.uploadPage.createLearningPath });
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);
  return user;
}

describe('AdaptiveLearningUpload error states', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    checkApiReadinessMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('shows a 413 as validation with the file-size copy', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({ message: RAW, code: 'validation_error', status: 413 }),
    );
    await submitUpload();

    expect(await screen.findByText(api.validationTitle)).toBeInTheDocument();
    expect(screen.getByText(/Tệp PDF này quá lớn/)).toBeInTheDocument();
    expect(screen.queryByText(RAW)).not.toBeInTheDocument();
  });

  it('shows a 415 with the unsupported_media_type code copy', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({ message: RAW, code: 'unsupported_media_type', status: 415 }),
    );
    await submitUpload();

    expect(await screen.findByText(api.codes.unsupportedMediaTypeTitle)).toBeInTheDocument();
    expect(screen.getByText(api.codes.unsupportedMediaType)).toBeInTheDocument();
    expect(screen.queryByText(RAW)).not.toBeInTheDocument();
  });

  it('shows a 429 with retry and retries the upload', async () => {
    uploadPdfMock
      .mockRejectedValueOnce(
        new AdaptiveApiError({
          message: RAW,
          code: 'rate_limit_exceeded',
          status: 429,
          retryable: true,
        }),
      )
      .mockResolvedValueOnce({ job_id: 'job-2' });
    const user = await submitUpload();

    expect(await screen.findByText(api.rateLimitedTitle)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: viCommon.retry }));
    await waitFor(() => expect(uploadPdfMock).toHaveBeenCalledTimes(2));
  });

  it('counts down before a 429 retry when Retry-After is known', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({
        message: RAW,
        code: 'rate_limit_exceeded',
        status: 429,
        retryAfterSeconds: 30,
        retryable: true,
      }),
    );
    await submitUpload();

    expect(await screen.findByText('Bạn có thể thử lại sau 30 giây.')).toBeInTheDocument();
    expect(screen.getByText('Thử lại (30s)')).toBeInTheDocument();
  });

  it('shows a 503 as unavailable with retry', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({
        message: 'Adaptive service temporarily unavailable',
        code: 'service_unavailable',
        status: 503,
        retryable: true,
      }),
    );
    await submitUpload();

    expect(await screen.findByText(api.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: viCommon.retry })).toBeInTheDocument();
    expect(screen.queryByText(/Adaptive/)).not.toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith(api.unavailable);
  });

  it('renders upstream_timeout as localized vi copy, not the English message (RIN-764)', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({
        message: 'Adaptive service temporarily unavailable',
        code: 'upstream_timeout',
        status: 504,
        retryable: true,
      }),
    );
    await submitUpload();

    expect(await screen.findByText(api.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(/Adaptive|thích ứng/i)).not.toBeInTheDocument();
  });

  it('shows a dropped connection as a network problem', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({
        message: 'Failed to fetch',
        code: 'service_unavailable',
        detail: 'Failed to fetch',
        retryable: true,
      }),
    );
    await submitUpload();

    expect(await screen.findByText(api.networkTitle)).toBeInTheDocument();
    expect(screen.getByText(api.network)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('shows quota_exceeded with an upgrade link and leaves the prompt to the modal (no toast)', async () => {
    uploadPdfMock.mockRejectedValue(
      new AdaptiveApiError({
        message: 'Usage quota exceeded',
        code: 'quota_exceeded',
        status: 429,
        meta: { upgradeEligible: true },
      }),
    );
    await submitUpload();

    expect(await screen.findByText(api.codes.quotaExceededTitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: api.actions.upgrade })).toBeInTheDocument();
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Usage quota exceeded')).not.toBeInTheDocument();
  });
});
