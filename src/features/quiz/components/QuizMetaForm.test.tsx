/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QuizMetaForm from '@/features/quiz/components/QuizMetaForm';

vi.mock('@/features/folders/components/FolderSelector', () => ({
  FolderSelector: ({
    id,
    value,
    onChange,
    disabled,
  }: {
    id: string;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      value={value ?? ''}
      readOnly
      disabled={disabled}
      onClick={() => onChange('folder-2')}
    />
  ),
}));

const labels = {
  title: 'Title',
  titlePlaceholder: 'Enter title',
  description: 'Description',
  descriptionPlaceholder: 'Enter description',
  folder: 'Folder',
  privateLabel: 'Private quiz',
  privateDescription: 'Only you can access it',
  promptLabel: 'AI prompt',
  promptPlaceholder: 'Extra instructions',
  promptHelper: 'Optional',
};

describe('QuizMetaForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('forwards field, folder, prompt and private-checkbox changes', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onFolderChange = vi.fn();
    const onPrivateChange = vi.fn();
    const onAiPromptChange = vi.fn();

    render(
      <QuizMetaForm
        title="Quiz"
        onTitleChange={onTitleChange}
        description="Description"
        onDescriptionChange={onDescriptionChange}
        selectedFolderId="folder-1"
        onFolderChange={onFolderChange}
        labels={labels}
        isPrivate={false}
        onPrivateChange={onPrivateChange}
        aiPrompt="Prompt"
        onAiPromptChange={onAiPromptChange}
      />,
    );

    await user.type(screen.getByLabelText('Title'), ' X');
    expect(onTitleChange).toHaveBeenCalled();

    await user.type(screen.getByLabelText('Description'), ' Y');
    expect(onDescriptionChange).toHaveBeenCalled();

    await user.type(screen.getByLabelText('AI prompt'), ' Z');
    expect(onAiPromptChange).toHaveBeenCalled();

    await user.click(screen.getByRole('textbox', { name: 'Folder' }));
    expect(onFolderChange).toHaveBeenCalledWith('folder-2');

    const checkbox = screen.getByRole('checkbox', { name: /Private quiz/ });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    await user.click(checkbox);
    expect(onPrivateChange).toHaveBeenCalledWith(true);
  });
});
