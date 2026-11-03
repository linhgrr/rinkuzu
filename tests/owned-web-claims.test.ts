import fs from 'node:fs';
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
  'src/app/[locale]/(marketing)/blog/ai-powered-quiz-generation-guide/page.tsx',
  'src/app/[locale]/(marketing)/blog/knowledge-graphs-adaptive-learning-pdfs/page.tsx',
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
});
