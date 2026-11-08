'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { CampaignBlockViewModel } from '../types/communication-view-model';

interface CampaignBlockEditorProps {
  blocks: CampaignBlockViewModel[];
  disabled?: boolean;
  onChange: (blocks: CampaignBlockViewModel[]) => void;
}

const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'button', 'divider', 'spacer'] as const;

/** Starter text for a new block, in the page language (RIN-1160). */
interface BlockDefaults {
  heading: string;
  paragraph: string;
  image: string;
  button: string;
}

function defaultBlock(
  type: CampaignBlockViewModel['type'],
  defaults: BlockDefaults,
): CampaignBlockViewModel {
  const id = crypto.randomUUID();
  switch (type) {
    case 'heading':
      return { id, type, text: defaults.heading, level: 2 };
    case 'paragraph':
      return { id, type, text: defaults.paragraph };
    case 'image':
      return { id, type, url: 'https://', label: defaults.image };
    case 'button':
      return { id, type, url: 'https://', label: defaults.button };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, height: 24 };
  }
}

export function CampaignBlockEditor({
  blocks,
  disabled = false,
  onChange,
}: CampaignBlockEditorProps) {
  const t = useTranslations('communications.admin.blockEditor');
  const defaults: BlockDefaults = {
    heading: t('defaults.heading'),
    paragraph: t('defaults.paragraph'),
    image: t('defaults.image'),
    button: t('defaults.button'),
  };
  function replace(index: number, block: CampaignBlockViewModel): void {
    onChange(blocks.map((item, itemIndex) => (itemIndex === index ? block : item)));
  }
  function move(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    const current = copy[index];
    const destination = copy[target];
    if (!current || !destination) return;
    copy[index] = destination;
    copy[target] = current;
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-lg border border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase text-ink-muted">
              {t(`blockTypes.${block.type}`)}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={t('moveUp', { index: index + 1 })}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={t('moveDown', { index: index + 1 })}
                disabled={disabled || index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                aria-label={t('removeLabel', {
                  index: index + 1,
                  type: t(`blockTypes.${block.type}`),
                })}
                disabled={disabled || blocks.length === 1}
                onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))}
              >
                {t('remove')}
              </Button>
            </div>
          </div>
          {block.type === 'heading' ? (
            <>
              <Input
                label={t('content')}
                value={block.text}
                disabled={disabled}
                onChange={(event) => replace(index, { ...block, text: event.target.value })}
              />
              <Input
                label={t('level')}
                type="number"
                min={1}
                max={3}
                value={block.level}
                disabled={disabled}
                onChange={(event) =>
                  replace(index, { ...block, level: Number(event.target.value) })
                }
              />
            </>
          ) : null}
          {block.type === 'paragraph' ? (
            <Textarea
              label={t('content')}
              value={block.text}
              disabled={disabled}
              onChange={(event) => replace(index, { ...block, text: event.target.value })}
              rows={5}
            />
          ) : null}
          {block.type === 'image' || block.type === 'button' ? (
            <div className="space-y-3">
              <Input
                label={block.type === 'image' ? t('altText') : t('buttonLabel')}
                value={block.label}
                disabled={disabled}
                onChange={(event) => replace(index, { ...block, label: event.target.value })}
              />
              <Input
                label={t('url')}
                value={block.url}
                disabled={disabled}
                onChange={(event) => replace(index, { ...block, url: event.target.value })}
              />
            </div>
          ) : null}
          {block.type === 'spacer' ? (
            <Input
              label={t('height')}
              type="number"
              min={4}
              max={120}
              value={block.height}
              disabled={disabled}
              onChange={(event) => replace(index, { ...block, height: Number(event.target.value) })}
            />
          ) : null}
        </div>
      ))}
      {!disabled && blocks.length < 50 ? (
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange([...blocks, defaultBlock(type, defaults)])}
            >
              {t('addBlock', { type: t(`blockTypes.${type}`) })}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
