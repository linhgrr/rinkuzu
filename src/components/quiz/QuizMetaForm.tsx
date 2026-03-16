'use client';

import { Input, Textarea } from '@/components/ui/Input';
import { CategorySelector } from '@/components/ui/CategorySelector';
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
        variant="glass"
        disabled={disabled}
        icon={<HiOutlineTag className="w-5 h-5" />}
      />

      <Textarea
        label={labels.description}
        id="description"
        rows={3}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={labels.descriptionPlaceholder}
        maxLength={descriptionMaxLength}
        variant="glass"
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
            variant="glass"
            disabled={disabled}
          />
          {labels.promptHelper && <p className="text-xs text-gray-500 mt-2">{labels.promptHelper}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">{labels.category}</label>
        <CategorySelector
          value={selectedCategory}
          onChange={onCategoryChange}
          placeholder={labels.categoryPlaceholder}
          required={requiredCategory}
          disabled={disabled || categoryDisabled}
        />
      </div>

      {showPrivate && (
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-xl border border-violet-200">
          <label htmlFor={privateCheckboxId} className="flex items-start space-x-3 cursor-pointer">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id={privateCheckboxId}
                checked={isPrivate}
                onChange={(e) => onPrivateChange(e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 text-violet-600 bg-white border-gray-300 rounded focus:ring-violet-500 focus:ring-2"
              />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-900 flex items-center">
                <HiOutlineLockClosed className="w-4 h-4 mr-1 text-violet-600" />
                {labels.privateLabel}
              </span>
              {labels.privateDescription && <p className="text-xs text-gray-600 mt-1">{labels.privateDescription}</p>}
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
