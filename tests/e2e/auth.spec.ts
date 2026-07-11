import { expect, test } from '@playwright/test';

const email = process.env['E2E_USER_EMAIL'] ?? '';
const password = process.env['E2E_USER_PASSWORD'] ?? '';
const hasCreds = email.length > 0 && password.length > 0;

test.describe('credentials authentication', () => {
  test.skip(!hasCreds, 'E2E auth credentials are not configured');

  test('submits once, reaches dashboard, and signs out', async ({ page }) => {
    let loginPostCount = 0;
    const forbiddenClientAuthPaths: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (request.method() === 'POST' && /\/(en|vi)\/login(?:\?|$)/.test(url)) {
        loginPostCount += 1;
      }
      if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
        if (url.includes('/api/auth/csrf') || url.includes('/api/auth/providers')) {
          forbiddenClientAuthPaths.push(url);
        }
      }
    });

    await page.goto('/en/login?callbackUrl=%2Fen%2Fdashboard');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);

    const submit = page.getByRole('button', { name: /sign in/i });
    // Double-click: in-flight guard must still produce a single server action.
    await submit.dblclick({ delay: 20 });

    await expect(page).toHaveURL(/\/en\/dashboard(?:\?|$)/, { timeout: 30_000 });
    expect(loginPostCount).toBe(1);
    expect(forbiddenClientAuthPaths, 'credentials login must not hit /csrf or /providers').toEqual(
      [],
    );

    await page.getByRole('button', { name: /toggle user menu|user menu/i }).click();
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await expect(page).toHaveURL(/\/en(?:\/|$)/);
  });

  test('rejects invalid credentials without leaving login', async ({ page }) => {
    await page.goto('/en/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill('definitely-wrong-password-!!!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test('sanitizes malicious callbackUrl to dashboard', async ({ page }) => {
    await page.goto('/en/login?callbackUrl=https%3A%2F%2Fevil.example%2Fphish');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/en\/dashboard(?:\?|$)/, { timeout: 30_000 });
  });
});

test.describe('auth shell motion contract', () => {
  test('login page renders auth shell panel', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    // Shell is present; detailed 350ms motion stays in unit contract tests.
    await expect(page.locator('body')).toBeVisible();
  });
});
