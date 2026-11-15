import { randomUUID } from 'node:crypto';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-1647 (spec RIN-1642 AC 1 and AC 3): a request with no session cookie gets
 * the cached signed-out twin of `/quiz/<slug>`, which holds nobody's data; a
 * signed-in request keeps the per-request page with only its own session.
 * Checked for a public quiz (the landing) and a Premium quiz (the sign-in
 * prompt), the two views the twin renders.
 */

function requireCiMongoUri(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for the quiz cache E2E');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    databaseName !== 'rinkuzu_ci'
  ) {
    throw new Error('The quiz cache E2E seeds only mongodb://localhost/rinkuzu_ci');
  }
  return { databaseName, uri };
}

async function page(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  return {
    body: await response.text(),
    cacheControl: response.headers()['cache-control'] ?? '',
    setCookie: response.headers()['set-cookie'] ?? '',
  };
}

const question = (text: string) => ({
  _id: new ObjectId(),
  correctIndex: 0,
  options: ['Right', 'Wrong'],
  question: text,
  type: 'single',
});

test.describe('signed-out quiz page from the cache (RIN-1647)', () => {
  let client: MongoClient;
  let db: Db;
  let runId: string;
  let publicSlug: string;
  let premiumSlug: string;

  test.beforeAll(async () => {
    const { databaseName, uri } = requireCiMongoUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(databaseName);
    runId = `quiz-cache-${randomUUID()}`.toLowerCase();
    publicSlug = `e2e-cache-public-${runId}`;
    premiumSlug = `e2e-cache-premium-${runId}`;
    const now = new Date();

    await db.collection('quizzes').insertOne({
      _id: new ObjectId(),
      _e2eRun: runId,
      // An owner outside the test accounts keeps the quiz indexable, so the landing shows.
      author: new ObjectId(),
      createdAt: now,
      questions: Array.from({ length: 6 }, (_, index) => question(`Cache question ${index + 1}?`)),
      slug: publicSlug,
      title: 'E2E Cache Public Quiz',
      updatedAt: now,
      visibility: 'public',
    });
    await db.collection('premiumquizsubmissions').insertOne({
      _id: new ObjectId(),
      _e2eRun: runId,
      sourceQuiz: new ObjectId(),
      author: new ObjectId(),
      version: 1,
      status: 'approved',
      sourceType: 'manual',
      rightsAttested: true,
      snapshot: {
        title: 'E2E Cache Premium Quiz',
        slug: premiumSlug,
        description: 'A fake Premium quiz used only by the cache E2E.',
        questions: [question('First premium question?'), question('Second premium question?')],
      },
      snapshotHash: `e2e-${runId}`,
      questionHashes: [],
      duplicateReport: {
        exactDocumentRewarded: false,
        exactQuiz: false,
        sharedQuestionCount: 0,
        highestSimilarity: 0,
        matches: [],
      },
      reviewStatus: 'completed',
      awardedCredits: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  test.afterAll(async () => {
    if (!db) return;
    await db.collection('quizzes').deleteMany({ _e2eRun: runId });
    await db.collection('premiumquizsubmissions').deleteMany({ _e2eRun: runId });
    await client.close();
  });

  test('the signed-out HTML is shared and session-free; each session sees only itself', async ({
    browser,
    playwright,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const origin = baseURL ?? 'http://localhost:3000';

    await withAccounts(testInfo, async ({ admin, regular }) => {
      const guest = await playwright.request.newContext({ baseURL: origin });
      const signedOut = {
        public: await page(guest, `/vi/quiz/${publicSlug}`),
        premium: await page(guest, `/vi/quiz/${premiumSlug}`),
      };
      const missPath = '/vi/quiz/khong-co-quiz-nay-e2e';
      const miss = await guest.get(missPath, { maxRedirects: 0 });
      // Any session cookie keeps the per-request route: the same state, only not cached.
      const missDynamic = await guest.get(missPath, {
        maxRedirects: 0,
        headers: { cookie: 'authjs.session-token=not-a-session' },
      });
      const internal = await guest.get(`/vi/signed-out/quiz/${publicSlug}`, { maxRedirects: 0 });
      // A query the cached page cannot read keeps the per-request route.
      const withQuery = await guest.get(`/vi/quiz/${publicSlug}?mode=quick`, { maxRedirects: 0 });
      await guest.dispose();

      for (const view of Object.values(signedOut)) {
        // Served by the ISR twin, not rendered per request, and nothing on it sets a cookie.
        expect(view.cacheControl).toContain('s-maxage=600');
        expect(view.setCookie).toBe('');
      }
      // The canonical stays the public URL, never the internal twin path.
      expect(signedOut.public.body).toContain(`/quiz/${publicSlug}"`);
      expect(signedOut.public.body).not.toContain('/signed-out/');
      expect(signedOut.public.body).toContain('E2E Cache Public Quiz');
      expect(signedOut.premium.body).toContain('E2E Cache Premium Quiz');
      expect(miss.status()).toBe(missDynamic.status());
      expect(missDynamic.headers()['cache-control'] ?? '').not.toContain('s-maxage');
      // The internal twin path is never served by itself.
      expect(internal.status()).toBe(307);
      expect(new URL(internal.headers()['location'] ?? '', origin).pathname).toBe(
        `/vi/quiz/${publicSlug}`,
      );
      expect(withQuery.headers()['cache-control'] ?? '').not.toContain('s-maxage');

      const sessions = [];
      for (const user of [admin, regular]) {
        const context = await browser.newContext({ baseURL: origin });
        const tab = await context.newPage();
        await login(tab, user);
        sessions.push({ user, ...(await page(context.request, `/vi/quiz/${publicSlug}`)) });
        await context.close();
      }

      for (const forbidden of [admin.email, regular.email]) {
        expect(signedOut.public.body).not.toContain(forbidden);
        expect(signedOut.premium.body).not.toContain(forbidden);
      }
      for (const [index, session] of sessions.entries()) {
        const other = sessions[1 - index];
        expect(session.cacheControl).not.toContain('s-maxage');
        expect(session.body).toContain(session.user.email);
        expect(session.body).not.toContain(other?.user.email ?? 'missing');
      }
    });
  });
});
