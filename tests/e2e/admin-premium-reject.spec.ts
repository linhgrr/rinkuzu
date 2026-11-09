import { expect, test, type Page } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * Premium review reject outcome (RIN-1348): the decision area warns that a reject makes
 * the quiz public, and after a reject a status line says whether it became public.
 *
 * The admin login, gate and page run for real. Only the queue GET and the decision POST
 * are answered by `page.route`, so the flow needs no quiz or submission rows and queues
 * no email. The service side (public flag, author email) is covered by unit tests.
 */

const SUBMISSION_ID = '6a8ed209f04328ac17443d92';

function submission(status: 'pending' | 'rejected') {
  return {
    id: SUBMISSION_ID,
    sourceQuizId: '6a8ed209f04328ac17443d93',
    authorId: '6a8ed209f04328ac17443d91',
    version: 1,
    status,
    sourceType: 'manual',
    snapshot: { title: 'E2E cell biology', slug: 'e2e-cell-biology', questions: [] },
    snapshotHash: 'a'.repeat(64),
    duplicateReport: {
      exactDocumentRewarded: false,
      exactQuiz: false,
      sharedQuestionCount: 0,
      highestSimilarity: 0,
      matches: [],
    },
    reviewStatus: 'completed',
    awardedCredits: 0,
    active: status === 'pending',
    createdAt: '2026-11-09T00:00:00.000Z',
  };
}

async function fakeQueue(page: Page, quizMadePublic: boolean): Promise<string[]> {
  const decisions: string[] = [];
  let status: 'pending' | 'rejected' = 'pending';
  await page.route(/\/api\/admin\/premium-submissions(\?|$)/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [submission(status)], page: 1, limit: 100, totalItems: 1, totalPages: 1 },
      }),
    });
  });
  await page.route(`**/api/admin/premium-submissions/${SUBMISSION_ID}/decision`, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as { decision: string };
    decisions.push(body.decision);
    status = 'rejected';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          submission: submission('rejected'),
          awardedCredits: 0,
          rewardLocked: false,
          quizMadePublic,
        },
      }),
    });
  });
  return decisions;
}

const CASES = [
  {
    locale: 'en',
    quizMadePublic: true,
    heading: 'Premium Quiz Review',
    reject: 'Reject',
    note: 'Reject makes the quiz public for everyone. Request changes keeps it private.',
    outcome: 'Rejected. The quiz is now public for everyone.',
  },
  {
    locale: 'vi',
    quizMadePublic: false,
    heading: 'Duyệt Quiz Premium',
    reject: 'Từ chối',
    note: 'Từ chối sẽ công khai bài quiz cho mọi người. Yêu cầu chỉnh sửa thì bài quiz vẫn riêng tư.',
    outcome: 'Đã từ chối. Bài quiz vẫn ở chế độ riêng tư.',
  },
] as const;

test.describe('admin Premium review reject', () => {
  for (const c of CASES) {
    test(`${c.locale}: warns that a reject makes the quiz public, then says whether it did @critical-admin`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await withAccounts(testInfo, async ({ admin }) => {
        await login(page, admin);
        const decisions = await fakeQueue(page, c.quizMadePublic);
        await page.goto(`/${c.locale}/admin/premium-submissions`);

        const main = page.locator('#app-main-content');
        await expect(page.getByRole('heading', { level: 1, name: c.heading })).toBeVisible({
          timeout: 30_000,
        });
        await expect(main.getByText(c.note)).toBeVisible({ timeout: 30_000 });

        await main.getByRole('button', { name: c.reject, exact: true }).click();

        await expect(main.getByRole('status').filter({ hasText: c.outcome })).toBeVisible();
        expect(decisions).toEqual(['reject']);
        // A rejected submission can no longer be decided, so the note goes with the buttons.
        await expect(main.getByText(c.note)).toHaveCount(0);
      });
    });
  }
});
