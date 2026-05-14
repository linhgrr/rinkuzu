'use client';

import { Input, Textarea } from '@/components/ui/Input';
import { CategorySelector } from '@/features/categories/components/CategorySelector';
import { HiOutlineLockClosed, HiOutlineTag } from '@/components/icons';

type CategoryLike = {
  _id: string;
  name: string;
  description?: string;
  color?: string;
};

type QuizMetaLabels = {
  title: string;
  titlePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  category: string;
  categoryPlaceholder: string;
  privateLabel?: string;
  privateDescription?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
  promptHelper?: string;
};

type QuizMetaFormProps = {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  selectedCategory: CategoryLike | null;
  onCategoryChange: (category: CategoryLike | null) => void;
  labels: QuizMetaLabels;
  disabled?: boolean;
  requiredCategory?: boolean;
  titleMaxLength?: number;
  descriptionMaxLength?: number;
  categoryDisabled?: boolean;
  isPrivate?: boolean;
  onPrivateChange?: (checked: boolean) => void;
  privateCheckboxId?: string;
  aiPrompt?: string;
  onAiPromptChange?: (value: string) => void;
  aiPromptMaxLength?: number;
};

export default function QuizMetaForm({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  selectedCategory,
  onCategoryChange,
  labels,
  disabled = false,
  requiredCategory = true,
  titleMaxLength = 200,
  descriptionMaxLength = 1000,
  categoryDisabled = false,
  isPrivate,
  onPrivateChange,
  privateCheckboxId = 'isPrivateQuiz',
  aiPrompt,
  onAiPromptChange,
  aiPromptMaxLength = 2000,
}: QuizMetaFormProps) {
  const showPrivate = typeof isPrivate === 'boolean' && typeof onPrivateChange === 'function';
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
            label={labels.promptLabel || ''}
            id="aiPrompt"
            rows={3}
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            placeholder={labels.promptPlaceholder || ''}
            maxLength={aiPromptMaxLength}
            disabled={disabled}
          />
          {labels.promptHelper && (
            <p className="text-xs text-neutral-500 mt-2">{labels.promptHelper}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-3">
          {labels.category}
        </label>
        <CategorySelector
          value={selectedCategory}
          onChange={onCategoryChange}
          placeholder={labels.categoryPlaceholder}
          required={requiredCategory}
          disabled={disabled || categoryDisabled}
        />
      </div>

      {showPrivate && (
        <div className="bg-gradient-to-r from-green-50 to-green-50/50 p-4 rounded-xl border border-green-100">
          <label htmlFor={privateCheckboxId} className="flex items-start gap-x-3 cursor-pointer">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id={privateCheckboxId}
                checked={isPrivate}
                onChange={(e) => onPrivateChange(e.target.checked)}
                disabled={disabled}
                className="size-4 text-brand-trust bg-white border-neutral-300 rounded focus:ring-brand-trust focus:ring-2"
              />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-neutral-900 flex items-center">
                <HiOutlineLockClosed className="size-4 mr-1 text-brand-trust" />
                {labels.privateLabel}
              </span>
              {labels.privateDescription && (
                <p className="text-xs text-neutral-600 mt-1">{labels.privateDescription}</p>
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
