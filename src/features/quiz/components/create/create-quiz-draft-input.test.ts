import { describe, expect, it } from 'vitest';
import { toCreateQuizDraftInput, toOfficeTextDraftInput } from './create-quiz-draft-input';

describe('toCreateQuizDraftInput', () => {
  it.each([true, false])('preserves submitToPremium=%s in the draft request', (submitToPremium) => {
    expect(
      toCreateQuizDraftInput(
        {
          aiPrompt: '  focus on definitions  ',
          description: '  Chapter one  ',
          submitToPremium,
          selectedFolderId: 'folder-1',
          title: '  Biology  ',
        },
        { name: 'biology.pdf', size: 2048 },
        'uploads/user-1/biology.pdf',
      ),
    ).toEqual({
      title: 'Biology',
      s3Key: 'uploads/user-1/biology.pdf',
      fileName: 'biology.pdf',
      fileSize: 2048,
      folderId: 'folder-1',
      submitToPremium,
      description: 'Chapter one',
      prompt: 'focus on definitions',
    });
  });

  it('omits blank optional text fields', () => {
    expect(
      toCreateQuizDraftInput(
        {
          aiPrompt: ' ',
          description: '',
          submitToPremium: true,
          selectedFolderId: null,
          title: ' Quiz ',
        },
        { name: 'quiz.pdf', size: 1024 },
        'uploads/user-1/quiz.pdf',
      ),
    ).toEqual({
      title: 'Quiz',
      s3Key: 'uploads/user-1/quiz.pdf',
      fileName: 'quiz.pdf',
      fileSize: 1024,
      folderId: null,
      submitToPremium: true,
    });
  });
});

describe('toOfficeTextDraftInput (RIN-1787)', () => {
  const source = { text: 'Fake slide text', fileType: 'pptx', truncated: false } as const;

  it('sends the extracted text with the file type and surface, no storage fields', () => {
    expect(
      toOfficeTextDraftInput(
        {
          aiPrompt: ' focus on dates ',
          description: ' Week 3 ',
          submitToPremium: true,
          selectedFolderId: 'folder-1',
          title: ' Week 3 slides ',
        },
        source,
        'create_pdf',
      ),
    ).toEqual({
      title: 'Week 3 slides',
      text: 'Fake slide text',
      folderId: 'folder-1',
      submitToPremium: true,
      office: { fileType: 'pptx', surface: 'create_pdf' },
      description: 'Week 3',
      prompt: 'focus on dates',
    });
  });

  it('omits blank optional text fields', () => {
    const input = toOfficeTextDraftInput(
      {
        aiPrompt: ' ',
        description: '',
        submitToPremium: false,
        selectedFolderId: null,
        title: 'Doc',
      },
      source,
      'create_pdf_mobile',
    );

    expect(input).not.toHaveProperty('description');
    expect(input).not.toHaveProperty('prompt');
    expect(input.office).toEqual({ fileType: 'pptx', surface: 'create_pdf_mobile' });
  });
});
