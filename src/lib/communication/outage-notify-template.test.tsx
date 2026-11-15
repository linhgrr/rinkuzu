import { describe, expect, it } from 'vitest';
import { renderOutageNotify } from './outage-notify-template';

describe('outage notify email (RIN-1653)', () => {
  it.each([
    [
      'vi',
      'Rinkuzu đã hoạt động trở lại',
      'Bạn đã nhờ chúng tôi báo khi Rinkuzu trở lại.',
      'Làm bài quiz mẫu',
      'Chúng tôi sẽ xoá địa chỉ trong vòng 30 ngày.',
    ],
    [
      'en',
      'Rinkuzu is back',
      'You asked us to tell you when Rinkuzu was back. It is.',
      'Try the starter quiz',
      'We delete it within 30 days.',
    ],
  ] as const)(
    'renders the %s email with the starter link and its UTM',
    async (locale, subject, body, button, footer) => {
      const ctaUrl = `https://www.rinkuzu.test/${locale}/quiz/${locale}-starter?utm_source=outage_notify&utm_medium=email&utm_campaign=2026-11-vercel`;

      const mail = await renderOutageNotify({ locale, ctaUrl });

      expect(mail.subject).toBe(subject);
      expect(mail.html).toContain(`lang="${locale}"`);
      expect(mail.html).toContain(ctaUrl.replaceAll('&', '&amp;'));
      expect(mail.text).toContain(ctaUrl);
      for (const copy of [body, button, footer]) {
        expect(mail.html).toContain(copy.replaceAll("'", '&#x27;'));
        expect(mail.text).toContain(copy);
      }
      expect(mail.html.match(/<a /gu)).toHaveLength(1);
      expect(`${mail.html} ${mail.text}`).not.toMatch(/vercel\.com|billing|payment|thanh toán/iu);
    },
  );
});
