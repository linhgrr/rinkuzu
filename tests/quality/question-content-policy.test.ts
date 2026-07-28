import { describe, expect, it } from 'vitest';
import { findRawQuestionContent } from '../../scripts/check-question-content.mjs';

describe('question Markdown policy', () => {
  it('rejects direct and transformed question source rendering', () => {
    const occurrences = findRawQuestionContent([
      {
        path: 'src/example.tsx',
        content: `
          export function Example({ question, option }) {
            return (
              <>
                <h3>{question.question}</h3>
                <span>{question.question.substring(0, 100)}</span>
                <div>{option}</div>
              </>
            );
          }
        `,
      },
    ]);

    expect(occurrences.map(({ value }) => value)).toEqual([
      'question.question',
      'question.question.substring(0, 100)',
      'option',
    ]);
  });

  it('allows semantic renderer props, editor values and JSX branches', () => {
    const occurrences = findRawQuestionContent([
      {
        path: 'src/example.tsx',
        content: `
          export function Example({ currentQuestion, option }) {
            return (
              <>
                <QuestionContent content={currentQuestion.question} />
                <QuestionContent content={option} variant="option" />
                <textarea value={currentQuestion.question} />
                {currentQuestion.question ? (
                  <QuestionContent content={currentQuestion.question} />
                ) : null}
              </>
            );
          }
        `,
      },
    ]);

    expect(occurrences).toEqual([]);
  });

  it('allows question metadata but treats any displayed question field as rich content', () => {
    const occurrences = findRawQuestionContent([
      {
        path: 'src/example.tsx',
        content: `
          export function Example({ item, quiz }) {
            return (
              <>
                <span>{quiz.questionCount}</span>
                <h3>{item.question}</h3>
              </>
            );
          }
        `,
      },
    ]);

    expect(occurrences.map(({ value }) => value)).toEqual(['item.question']);
  });
});
