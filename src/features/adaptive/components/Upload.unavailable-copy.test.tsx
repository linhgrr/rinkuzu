/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enAdaptive from '@/../messages/en/adaptiveLearning.json';
import viAdaptive from '@/../messages/vi/adaptiveLearning.json';
import enCommon from '@/../messages/en/common.json';
import enErrors from '@/../messages/en/errors.json';
import viCommon from '@/../messages/vi/common.json';
import viErrors from '@/../messages/vi/errors.json';

// RIN-617: a learner blocked by the readiness gate was told to "start the API
// server". The copy must be learner language in both locales.

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
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  fileSizeBucket: () => 'lt_1mb',
}));
vi.mock('@/lib/pdf', () => ({ getPdfPageCount: vi.fn().mockResolvedValue(3) }));
vi.mock('@/hooks/usePdfUploadPolicy', () => ({
  usePdfUploadPolicy: () => ({ isLoading: false, maxBytes: 10 * 1024 * 1024, maxPages: 30 }),
}));

import AdaptiveLearningUpload from '@/features/adaptive/components/Upload';

const cases = [
  {
    locale: 'en',
    messages: enAdaptive,
    shared: { common: enCommon, errors: enErrors },
    expected: 'Please try again in a few minutes. Your quota was not used.',
  },
  {
    locale: 'vi',
    messages: viAdaptive,
    shared: { common: viCommon, errors: viErrors },
    expected: 'Vui lòng thử lại sau vài phút. Lượt sử dụng của bạn chưa bị trừ.',
  },
] as const;

describe('AdaptiveLearningUpload readiness failure copy', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(cases)('tells $locale learners the service is unavailable', async (c) => {
    checkApiReadinessMock.mockResolvedValue({ ok: false, cause: 'not_ready' });
    const user = userEvent.setup();
    const { container } = render(
      <NextIntlClientProvider
        locale={c.locale}
        messages={{ ...c.shared, adaptiveLearning: c.messages }}
      >
        <AdaptiveLearningUpload />
      </NextIntlClientProvider>,
    );
    const page = c.messages.uploadPage;

    await user.type(screen.getByLabelText(new RegExp(page.subjectName)), 'Biology');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' }));
    const submit = screen.getByRole('button', { name: page.createLearningPath });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(await screen.findByText(c.expected)).toBeInTheDocument();
    // RIN-809: the title already says the service is down; the body does not repeat it,
    // and no toast repeats the inline state.
    expect(screen.getByText(c.shared.errors.api.unavailableTitle)).toBeInTheDocument();
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(c.expected).not.toMatch(/backend|api|server/i);
    expect(uploadPdfMock).not.toHaveBeenCalled();
  });
});
