'use client';

import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { CampaignBlockViewModel } from '../types/communication-view-model';

interface CampaignBlockEditorProps {
  blocks: CampaignBlockViewModel[];
  disabled?: boolean;
  onChange: (blocks: CampaignBlockViewModel[]) => void;
}

function defaultBlock(type: CampaignBlockViewModel['type']): CampaignBlockViewModel {
  const id = crypto.randomUUID();
  switch (type) {
    case 'heading':
      return { id, type, text: 'Tiêu đề', level: 2 };
    case 'paragraph':
      return { id, type, text: 'Nội dung' };
    case 'image':
      return { id, type, url: 'https://', label: 'Hình ảnh' };
    case 'button':
      return { id, type, url: 'https://', label: 'Xem thêm' };
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
            <span className="text-sm font-semibold uppercase text-ink-muted">{block.type}</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Di chuyển block ${index + 1} lên`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Di chuyển block ${index + 1} xuống`}
                disabled={disabled || index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                aria-label={`Xóa block ${index + 1} (${block.type})`}
                disabled={disabled || blocks.length === 1}
                onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))}
              >
                Xóa
              </Button>
            </div>
          </div>
          {block.type === 'heading' ? (
            <>
              <Input
                label="Nội dung"
                value={block.text}
                disabled={disabled}
                onChange={(event) => replace(index, { ...block, text: event.target.value })}
              />
              <Input
                label="Cấp"
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
              label="Nội dung"
              value={block.text}
              disabled={disabled}
              onChange={(event) => replace(index, { ...block, text: event.target.value })}
              rows={5}
            />
          ) : null}
          {block.type === 'image' || block.type === 'button' ? (
            <div className="space-y-3">
              <Input
                label={block.type === 'image' ? 'Alt text' : 'Nhãn nút'}
                value={block.label}
                disabled={disabled}
                onChange={(event) => replace(index, { ...block, label: event.target.value })}
              />
              <Input
                label="HTTPS URL"
                value={block.url}
                disabled={disabled}
                onChange={(event) => replace(index, { ...block, url: event.target.value })}
              />
            </div>
          ) : null}
          {block.type === 'spacer' ? (
            <Input
              label="Chiều cao"
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
          {(['heading', 'paragraph', 'image', 'button', 'divider', 'spacer'] as const).map(
            (type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange([...blocks, defaultBlock(type)])}
              >
                + {type}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
