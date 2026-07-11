import { describe, expect, it } from 'vitest';
import {
  createEmptyEditorQuestion,
  setSingleCorrect,
  toEditorQuestions,
  toQuestionInputs,
  toggleMultipleCorrect,
  toggleQuestionType,
  updateOption,
  updateQuestionField,
} from './question-editor-mutations';

describe('question-editor-mutations', () => {
  it('maps draft inputs to editor questions and back without editorId', () => {
    const input = [
      {
        type: 'single' as const,
        question: 'Q1',
        options: ['A', 'B'],
        correctIndex: 1,
      },
    ];

    const editor = toEditorQuestions(input, 'draft');
    expect(editor[0]?.editorId).toBe('draft-0');
    expect(toQuestionInputs(editor)).toEqual(input);
  });

  it('updates option text and correct answers', () => {
    let questions = [createEmptyEditorQuestion('q-1')];
    questions = updateQuestionField(questions, 0, 'question', 'Hello?');
    questions = updateOption(questions, 0, 0, 'Yes');
    questions = setSingleCorrect(questions, 0, 0);
    expect(questions[0]).toMatchObject({
      question: 'Hello?',
      options: ['Yes', '', '', ''],
      type: 'single',
      correctIndex: 0,
    });

    questions = toggleQuestionType(questions, 0, 'multiple');
    questions = toggleMultipleCorrect(questions, 0, 1, true);
    expect(questions[0]).toMatchObject({
      type: 'multiple',
      correctIndexes: [0, 1],
    });
  });
});
