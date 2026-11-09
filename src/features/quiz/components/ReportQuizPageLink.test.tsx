/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enReport from '../../../../messages/en/report.json';
import enErrors from '../../../../messages/en/errors.json';
import { ReportQuizPageLink } from '@/features/quiz/components/ReportQuizPageLink';
import { ApiResponseError } from '@/lib/api/client';

const { reportQuizPageMock } = vi.hoisted(() => ({ reportQuizPageMock: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/quiz/api/quiz-interaction-api', () => ({
  reportQuizPage: reportQuizPageMock,
}));
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: ReactNode; title: string }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

function renderLink(props: { viewerEmail?: string | null; ownedByViewer?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ report: enReport, errors: enErrors }}>
      <ReportQuizPageLink
        slug="biology-10"
        viewerEmail={props.viewerEmail ?? null}
        ownedByViewer={props.ownedByViewer ?? false}
      />
    </NextIntlClientProvider>,
  );
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Report' }));
  return user;
}

describe('ReportQuizPageLink (RIN-1344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportQuizPageMock.mockResolvedValue(undefined);
  });

  it('shows the link to a signed-out visitor', () => {
    renderLink();
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy();
  });

  it('shows no link to the quiz owner', () => {
    renderLink({ viewerEmail: 'owner@example.com', ownedByViewer: true });
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();
  });

  it('keeps submit disabled until a reason is picked and the email is valid', async () => {
    renderLink();
    const user = await openDialog();
    const submit = screen.getByRole('button', { name: 'Send report' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('radio', { name: 'Copyright' }));
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await user.type(screen.getByLabelText('Email to reply to (optional)'), 'not-an-email');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();

    await user.clear(screen.getByLabelText('Email to reply to (optional)'));
    await user.type(screen.getByLabelText('Email to reply to (optional)'), 'reader@example.com');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('labels every reason radio and counts the details', async () => {
    renderLink();
    const user = await openDialog();
    for (const name of ['Copyright', 'Personal data', 'Wrong content', 'Offensive content']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    await user.type(screen.getByLabelText('Details (optional)'), 'Copied from a textbook');
    expect(screen.getByText('22/1000')).toBeTruthy();
    expect(screen.getByLabelText('Details (optional)').getAttribute('maxlength')).toBe('1000');
  });

  it('sends the report and thanks the visitor', async () => {
    renderLink();
    const user = await openDialog();
    await user.click(screen.getByRole('radio', { name: 'Personal data' }));
    await user.type(screen.getByLabelText('Details (optional)'), 'Shows a phone number');
    await user.type(screen.getByLabelText('Email to reply to (optional)'), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      "Thanks, we'll review it.",
    );
    expect(reportQuizPageMock).toHaveBeenCalledWith('biology-10', {
      reason: 'personal_data',
      details: 'Shows a phone number',
      email: 'reader@example.com',
    });
  });

  it('shows the rate-limit message on 429', async () => {
    reportQuizPageMock.mockRejectedValue(
      new ApiResponseError({
        message: 'Too many reports. Try again later.',
        status: 429,
        payload: null,
        code: 'rate_limit_exceeded',
      }),
    );
    renderLink();
    const user = await openDialog();
    await user.click(screen.getByRole('radio', { name: 'Offensive content' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many reports, try again later.',
    );
  });

  it('shows an error and keeps the form on a server failure', async () => {
    reportQuizPageMock.mockRejectedValue(
      new ApiResponseError({ message: 'boom', status: 500, payload: null, code: 'internal_error' }),
    );
    renderLink();
    const user = await openDialog();
    await user.click(screen.getByRole('radio', { name: 'Wrong content' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeTruthy();
  });

  it('pre-fills the signed-in email read-only and lets the session supply it', async () => {
    renderLink({ viewerEmail: 'learner@example.com' });
    const user = await openDialog();
    const email = screen.getByLabelText('Email to reply to (optional)') as HTMLInputElement;
    expect(email.value).toBe('learner@example.com');
    expect(email.readOnly).toBe(true);

    await user.click(screen.getByRole('radio', { name: 'Copyright' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(reportQuizPageMock).toHaveBeenCalledWith('biology-10', { reason: 'copyright' });
  });

  it('keeps the honeypot out of the tab order', async () => {
    renderLink();
    await openDialog();
    const honeypot = document.getElementById('report-quiz-website');
    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
