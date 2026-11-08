/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

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

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const labels = {
  title: 'Title',
  titlePlaceholder: 'Enter title',
  description: 'Description',
  descriptionPlaceholder: 'Enter description',
  folder: 'Folder',
  premiumLabel: 'Premium quiz',
  premiumDescription: 'Submit for review',
  promptLabel: 'AI prompt',
  promptPlaceholder: 'Extra instructions',
  promptHelper: 'Optional',
};

describe('QuizMetaForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('forwards field, folder, prompt and Premium-checkbox changes', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onFolderChange = vi.fn();
    const onPremiumChange = vi.fn();
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
        submitToPremium={false}
        onPremiumChange={onPremiumChange}
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

    const checkbox = screen.getByRole('checkbox', { name: /Premium quiz/ });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    await user.click(checkbox);
    expect(onPremiumChange).toHaveBeenCalledWith(true);
  });

  it('locks Premium contribution until email verification and shows the verification CTA', () => {
    render(
      <QuizMetaForm
        title="Quiz"
        onTitleChange={vi.fn()}
        description="Description"
        onDescriptionChange={vi.fn()}
        selectedFolderId={null}
        onFolderChange={vi.fn()}
        labels={labels}
        submitToPremium={false}
        onPremiumChange={vi.fn()}
        premiumEligible={false}
        premiumEligibilityMessage="Verify your email first."
        premiumEligibilityCta="Verify email"
      />,
    );

    expect(screen.getByRole('checkbox', { name: /Premium quiz/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Verify email' })).toHaveAttribute(
      'href',
      '/check-email',
    );
  });

  describe('visibility control (RIN-1275)', () => {
    const visibilityLabels = {
      label: 'Who can see this quiz',
      private: 'Private',
      public: 'Public',
      privateHelper: 'Only you can see this quiz.',
      publicHelper: 'Anyone with the link can see this quiz, and it may appear in search.',
      premiumHelper: 'Premium submissions stay private while they are reviewed.',
    };
    const baseProps = {
      title: 'Quiz',
      onTitleChange: vi.fn(),
      description: '',
      onDescriptionChange: vi.fn(),
      selectedFolderId: null,
      onFolderChange: vi.fn(),
      labels: { ...labels, visibility: visibilityLabels },
      submitToPremium: false,
      onPremiumChange: vi.fn(),
    };

    it('shows Private with its helper and reports a switch to Public', async () => {
      const user = userEvent.setup();
      const onVisibilityChange = vi.fn();
      render(
        <QuizMetaForm
          {...baseProps}
          visibility="personal"
          onVisibilityChange={onVisibilityChange}
        />,
      );

      const group = screen.getByRole('group', { name: 'Who can see this quiz' });
      expect(group).toHaveAccessibleDescription('Only you can see this quiz.');
      expect(screen.getByRole('button', { name: 'Private' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByText('Only you can see this quiz.')).toHaveAttribute(
        'aria-live',
        'polite',
      );

      await user.click(screen.getByRole('button', { name: 'Public' }));
      expect(onVisibilityChange).toHaveBeenCalledWith('public');
    });

    it('explains what Public means', () => {
      render(<QuizMetaForm {...baseProps} visibility="public" onVisibilityChange={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Public' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(
        screen.getByRole('group', { name: 'Who can see this quiz' }),
      ).toHaveAccessibleDescription(visibilityLabels.publicHelper);
    });

    it('locks the control to Private while Premium is ticked', () => {
      render(
        <QuizMetaForm
          {...baseProps}
          submitToPremium
          visibility="public"
          onVisibilityChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'Private' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Public' })).toBeDisabled();
      expect(
        screen.getByRole('group', { name: 'Who can see this quiz' }),
      ).toHaveAccessibleDescription(visibilityLabels.premiumHelper);
    });

    it('disables the control while the form is pending', () => {
      render(
        <QuizMetaForm {...baseProps} disabled visibility="personal" onVisibilityChange={vi.fn()} />,
      );

      expect(screen.getByRole('button', { name: 'Private' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Public' })).toBeDisabled();
    });

    it('shows a visibility error as an alert tied to the control', () => {
      render(
        <QuizMetaForm
          {...baseProps}
          visibility="personal"
          onVisibilityChange={vi.fn()}
          visibilityError="This quiz is in the Premium catalog, so it can't be made public."
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        "This quiz is in the Premium catalog, so it can't be made public.",
      );
      expect(
        screen.getByRole('group', { name: 'Who can see this quiz' }),
      ).toHaveAccessibleDescription(
        "Only you can see this quiz. This quiz is in the Premium catalog, so it can't be made public.",
      );
    });

    it('is absent when no visibility handler is given', () => {
      render(<QuizMetaForm {...baseProps} />);

      expect(
        screen.queryByRole('group', { name: 'Who can see this quiz' }),
      ).not.toBeInTheDocument();
    });
  });
});
