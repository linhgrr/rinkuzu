import { describe, expect, it } from 'vitest';
import type { QuizEditorQuestionViewModel } from '@/features/quiz/types/quiz-editor-view-model';
import {
  addOption,
  createEmptyEditorQuestion,
  insertQuestion,
  removeOption,
  setSingleCorrect,
  toEditorQuestions,
  toQuestionInputs,
  toggleMultipleCorrect,
  toggleQuestionType,
  updateOption,
  updateOptionImage,
  updateQuestionField,
  updateQuestionImage,
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

  it('supports question and option images for single and multiple choice', () => {
    let questions = [createEmptyEditorQuestion('q-img')];
    expect(questions[0]?.optionImages).toHaveLength(4);

    questions = updateQuestionImage(questions, 0, 'https://cdn.example/q.png');
    questions = updateOptionImage(questions, 0, 2, 'https://cdn.example/o2.png');
    expect(questions[0]).toMatchObject({
      questionImage: 'https://cdn.example/q.png',
      optionImages: [undefined, undefined, 'https://cdn.example/o2.png', undefined],
    });

    questions = toggleQuestionType(questions, 0, 'multiple');
    questions = updateOptionImage(questions, 0, 0, 'https://cdn.example/o0.png');
    const inputs = toQuestionInputs(questions);
    expect(inputs[0]).toMatchObject({
      type: 'multiple',
      questionImage: 'https://cdn.example/q.png',
      optionImages: [
        'https://cdn.example/o0.png',
        undefined,
        'https://cdn.example/o2.png',
        undefined,
      ],
    });

    questions = updateQuestionImage(questions, 0);
    expect(questions[0]).not.toHaveProperty('questionImage');
  });

  it('omits absent media fields when mapping draft inputs', () => {
    const [question] = toEditorQuestions([
      {
        type: 'single',
        question: 'Q1',
        options: ['A', 'B'],
        correctIndex: 1,
      },
    ]);
    if (!question) throw new Error('Expected one mapped editor question');

    expect(question).not.toHaveProperty('questionImage');
    expect(question).not.toHaveProperty('optionImages');
  });

  it('adds and removes options while preserving answer indexes and images', () => {
    const baseQuestion = createEmptyEditorQuestion('q-options');
    if (baseQuestion.type !== 'single') throw new Error('Expected a single-choice question');
    let questions: QuizEditorQuestionViewModel[] = [
      {
        ...baseQuestion,
        options: ['A', 'B', 'C'],
        optionImages: ['a.png', 'b.png', 'c.png'],
        correctIndex: 2,
      },
    ];

    questions = addOption(questions, 0);
    expect(questions[0]?.options).toEqual(['A', 'B', 'C', '']);
    expect(questions[0]?.optionImages).toEqual(['a.png', 'b.png', 'c.png', undefined]);

    questions = removeOption(questions, 0, 1);
    expect(questions[0]).toMatchObject({
      options: ['A', 'C', ''],
      optionImages: ['a.png', 'c.png', undefined],
      correctIndex: 1,
    });

    questions = removeOption(questions, 0, 1);
    questions = removeOption(questions, 0, 0);
    expect(questions[0]?.options).toHaveLength(2);
  });

  it('inserts a new question at any requested position', () => {
    const first = createEmptyEditorQuestion('first');
    const second = createEmptyEditorQuestion('second');
    const inserted = createEmptyEditorQuestion('inserted');

    expect(
      insertQuestion([first, second], 1, inserted).map((question) => question.editorId),
    ).toEqual(['first', 'inserted', 'second']);
  });
});
