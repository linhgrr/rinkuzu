import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync('src/app/[locale]/(app)/quiz/[slug]/page.tsx', 'utf8');
const clientSource = readFileSync(
  'src/app/[locale]/(app)/quiz/[slug]/QuizPlayerClient.tsx',
  'utf8',
);
const desktopLayoutSource = readFileSync(
  'src/features/quiz/components/player/DesktopQuizLayout.tsx',
  'utf8',
);
const aiExplainSource = readFileSync('src/features/quiz/hooks/useQuizAIExplain.ts', 'utf8');

describe('quiz player server bootstrap', () => {
  it('loads the quiz on the server instead of fetching after hydration', () => {
    expect(pageSource).toContain('.getQuizForPlay(');
    expect(pageSource).toContain('toQuizPlayViewModel(result.data)');
    expect(clientSource).not.toContain('fetchQuizPlayViewModel');
    expect(clientSource).not.toContain('/api/quiz/');
  });

  it('defers viewport-specific and optional quiz features', () => {
    expect(clientSource).toContain("import('@/features/quiz/components/player/DesktopQuizLayout')");
    expect(clientSource).toContain("import('@/features/quiz/components/player/MobileQuizLayout')");
    expect(desktopLayoutSource).toContain(
      "import('@/features/quiz/components/QuestionDiscussion')",
    );
    expect(desktopLayoutSource).toContain('discussionLoaded ?');
    expect(aiExplainSource).toContain("await import('@/lib/quiz/ask-ai')");
    expect(aiExplainSource).not.toContain("from '@/lib/quiz/ask-ai'");
  });
});
