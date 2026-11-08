'use client';

import { Input, Textarea } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FolderSelector } from '@/features/folders/components/FolderSelector';
import { Link } from '@/i18n/navigation';
import { HiOutlineLockClosed, HiOutlineTag } from 'react-icons/hi';
import type { QuizVisibilityViewModel } from '@/features/quiz/types/quiz-editor-view-model';

/** Copy for the owner's Private / Public control (RIN-1275). */
export type QuizVisibilityLabels = {
  label: string;
  private: string;
  public: string;
  privateHelper: string;
  publicHelper: string;
  premiumHelper: string;
};

type QuizMetaLabels = {
  title: string;
  titlePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  folder: string;
  premiumLabel?: string;
  premiumDescription?: string;
  premiumRightsLabel?: string;
  premiumRightsDescription?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
  promptHelper?: string;
  visibility?: QuizVisibilityLabels | undefined;
};

type QuizMetaFormProps = {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  selectedFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  labels: QuizMetaLabels;
  disabled?: boolean;
  titleMaxLength?: number;
  descriptionMaxLength?: number;
  submitToPremium?: boolean;
  onPremiumChange?: (checked: boolean) => void;
  premiumCheckboxId?: string;
  premiumEligible?: boolean;
  premiumEligibilityMessage?: string;
  premiumEligibilityCta?: string;
  premiumRightsAttested?: boolean;
  onPremiumRightsChange?: (checked: boolean) => void;
  aiPrompt?: string;
  onAiPromptChange?: (value: string) => void;
  aiPromptMaxLength?: number;
  /** The owner's choice; shown as Private while Premium is ticked. */
  visibility?: QuizVisibilityViewModel;
  onVisibilityChange?: (value: QuizVisibilityViewModel) => void;
  visibilityError?: string | undefined;
  visibilityControlId?: string;
};

type QuizVisibilityFieldProps = {
  id: string;
  labels: QuizVisibilityLabels;
  value: QuizVisibilityViewModel;
  onChange: (value: QuizVisibilityViewModel) => void;
  lockedByPremium: boolean;
  disabled: boolean;
  error: string | undefined;
};

function QuizVisibilityField({
  id,
  labels,
  value,
  onChange,
  lockedByPremium,
  disabled,
  error,
}: QuizVisibilityFieldProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const shown: QuizVisibilityViewModel = lockedByPremium ? 'personal' : value;
  const helper = lockedByPremium
    ? labels.premiumHelper
    : shown === 'public'
      ? labels.publicHelper
      : labels.privateHelper;

  return (
    <div>
      <p id={`${id}-label`} className="mb-3 block text-sm font-semibold text-neutral-700">
        {labels.label}
      </p>
      <SegmentedControl
        id={id}
        ariaLabel={labels.label}
        ariaDescribedBy={error ? `${helperId} ${errorId}` : helperId}
        disabled={disabled || lockedByPremium}
        value={shown}
        options={[
          { value: 'personal', label: labels.private },
          { value: 'public', label: labels.public },
        ]}
        onChange={onChange}
      />
      <p id={helperId} aria-live="polite" className="mt-2 text-xs text-neutral-600">
        {helper}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function QuizMetaForm({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  selectedFolderId,
  onFolderChange,
  labels,
  disabled = false,
  titleMaxLength = 200,
  descriptionMaxLength = 1000,
  submitToPremium,
  onPremiumChange,
  premiumCheckboxId = 'submitToPremiumQuiz',
  premiumEligible = true,
  premiumEligibilityMessage,
  premiumEligibilityCta,
  premiumRightsAttested,
  onPremiumRightsChange,
  aiPrompt,
  onAiPromptChange,
  aiPromptMaxLength = 2000,
  visibility,
  onVisibilityChange,
  visibilityError,
  visibilityControlId = 'quiz-meta-visibility',
}: QuizMetaFormProps) {
  const showPremium = typeof submitToPremium === 'boolean' && typeof onPremiumChange === 'function';
  const showPrompt = typeof aiPrompt === 'string' && typeof onAiPromptChange === 'function';

  return (
    <div className="space-y-5">
      <Input
        label={labels.title}
        id="title"
        type="text"
        required
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={labels.titlePlaceholder}
        maxLength={titleMaxLength}
        disabled={disabled}
        icon={<HiOutlineTag className="size-5" />}
      />

      <Textarea
        label={labels.description}
        id="description"
        rows={3}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={labels.descriptionPlaceholder}
        maxLength={descriptionMaxLength}
        disabled={disabled}
      />

      {showPrompt && (
        <div>
          <Textarea
            label={labels.promptLabel ?? ''}
            id="aiPrompt"
            rows={3}
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            placeholder={labels.promptPlaceholder ?? ''}
            maxLength={aiPromptMaxLength}
            disabled={disabled}
          />
          {labels.promptHelper && (
            <p className="text-xs text-neutral-500 mt-2">{labels.promptHelper}</p>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="quiz-meta-folder"
          className="mb-3 block text-sm font-semibold text-neutral-700"
        >
          {labels.folder}
        </label>
        <FolderSelector
          id="quiz-meta-folder"
          value={selectedFolderId}
          onChange={onFolderChange}
          disabled={disabled}
        />
      </div>

      {visibility !== undefined && onVisibilityChange && labels.visibility ? (
        <QuizVisibilityField
          id={visibilityControlId}
          labels={labels.visibility}
          value={visibility}
          onChange={onVisibilityChange}
          lockedByPremium={submitToPremium === true}
          disabled={disabled}
          error={visibilityError}
        />
      ) : null}

      {showPremium && (
        <div className="bg-gradient-to-r from-green-50 to-green-50/50 p-4 rounded-xl border border-green-100">
          <div className="flex items-start gap-x-3">
            <div className="flex h-5 items-center">
              <input
                type="checkbox"
                id={premiumCheckboxId}
                checked={submitToPremium}
                onChange={(e) => onPremiumChange(e.target.checked)}
                disabled={disabled || !premiumEligible}
                className="size-4 border-control-border rounded focus:ring-brand-trust bg-white text-brand-trust focus:ring-2"
              />
            </div>
            <div className="flex-1">
              <label htmlFor={premiumCheckboxId} className="block cursor-pointer">
                <span className="flex items-center text-sm font-semibold text-neutral-900">
                  <HiOutlineLockClosed className="mr-1 size-4 text-brand-trust" />
                  {labels.premiumLabel}
                </span>
                {labels.premiumDescription && (
                  <span className="mt-1 block text-xs text-neutral-600">
                    {labels.premiumDescription}
                  </span>
                )}
                {!premiumEligible && premiumEligibilityMessage ? (
                  <span className="mt-2 block text-xs font-semibold text-amber-700">
                    {premiumEligibilityMessage}{' '}
                    {premiumEligibilityCta ? (
                      <Link href="/check-email" className="underline underline-offset-2">
                        {premiumEligibilityCta}
                      </Link>
                    ) : null}
                  </span>
                ) : null}
              </label>
              {submitToPremium &&
                typeof premiumRightsAttested === 'boolean' &&
                typeof onPremiumRightsChange === 'function' && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-green-200 pt-3">
                    <input
                      type="checkbox"
                      checked={premiumRightsAttested}
                      onChange={(event) => onPremiumRightsChange(event.target.checked)}
                      disabled={disabled}
                      className="mt-0.5 size-4 rounded border-control-border text-brand-trust focus:ring-2 focus:ring-brand-trust"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-neutral-800">
                        {labels.premiumRightsLabel}
                      </span>
                      {labels.premiumRightsDescription ? (
                        <span className="mt-1 block text-xs text-neutral-600">
                          {labels.premiumRightsDescription}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
