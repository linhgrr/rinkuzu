import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type LandingMessages = {
  page: { meta: { title: string; description: string } };
};

const forbiddenOwnedWebClaims = [
  /#1 AI Learning Platform/i,
  /join thousands|hàng ngàn học sinh/i,
  /worldwide active users|người dùng toàn cầu/i,
  /Trần M\.|3rd-year Computer Science/i,
  /quiz(?:zes)? (?:instantly|in seconds|under a minute)|quiz tức thì|quiz[^.]{0,80}vài giây/i,
  /deep mastery|thành thạo sâu|learning more effectively/i,
  /any PDF|mọi tài liệu PDF/i,
  /offline access|quyền truy cập ngoại tuyến/i,
  /24\/7|always ready|luôn sẵn sàng/i,
  /scientifically-grounded adaptive learning path/i,
  // RIN-739/RIN-777: the feature is "personalized"; the about hero no longer says "adapt".
  /Learning Should Adapt to You/i,
];

const ownedWebSources = [
  'messages/en/landing.json',
  'messages/vi/landing.json',
  'src/app/llms.txt/route.ts',
  'src/app/[locale]/(marketing)/about/page.tsx',
  'src/app/[locale]/(marketing)/blog/page.tsx',
  'src/app/[locale]/(marketing)/blog/[slug]/page.tsx',
  // Blog posts live in content/blog since RIN-404; every post is checked, so a new
  // post needs no change here (RIN-406).
  ...fs
    .readdirSync('content/blog', { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join('content/blog', file)),
  'src/app/[locale]/(marketing)/faq/page.tsx',
];

function expectNoForbiddenClaims(copy: string): void {
  for (const forbiddenClaim of forbiddenOwnedWebClaims) {
    expect(copy).not.toMatch(forbiddenClaim);
  }
}

describe('owned-web claims contract', () => {
  it.each(['en', 'vi'])('keeps %s landing server copy and metadata claim-safe', (locale) => {
    const messages = JSON.parse(
      fs.readFileSync(`messages/${locale}/landing.json`, 'utf8'),
    ) as LandingMessages;
    const serverCopy = JSON.stringify(messages);

    expectNoForbiddenClaims(serverCopy);
    expectNoForbiddenClaims(messages.page.meta.title);
    expectNoForbiddenClaims(messages.page.meta.description);
  });

  it('keeps search-visible owned-web sources free of forbidden claim copy', () => {
    const sourceCopy = ownedWebSources.map((path) => fs.readFileSync(path, 'utf8')).join('\n');

    expectNoForbiddenClaims(sourceCopy);
    expect(sourceCopy).toContain('supported PDF material');
    expect(sourceCopy).toContain('English and Vietnamese');
  });

  it('keeps blog post copy on "personalized", not "adaptive" (RIN-739, RIN-1281)', () => {
    // Slugs, link targets and cited paper titles (the References list) are not our copy.
    const offenders = ownedWebSources
      .filter((source) => source.endsWith('.mdx'))
      .flatMap((source) =>
        fs
          .readFileSync(source, 'utf8')
          .replace(/^## (?:References|Tài liệu tham khảo)\s*$[\s\S]*/m, '')
          .replace(/\]\([^)]*\)|https?:\/\/\S+|\/blog\/[a-z0-9-]+/g, '')
          .split('\n')
          .filter((line) => /adaptive|thích ứng/i.test(line))
          .map((line) => `${source}: ${line.trim()}`),
      );

    expect(offenders).toEqual([]);
  });
});
