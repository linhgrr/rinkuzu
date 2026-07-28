import { memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { markdownToPlainText } from '@/lib/markdown/plain-text';
import { cn } from '@/lib/utils';

type QuestionContentVariant = 'prompt' | 'option' | 'answer' | 'compact';

interface QuestionContentProps {
  content: string;
  variant?: QuestionContentVariant;
  className?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

interface QuestionExcerptProps {
  content: string;
  maxLines?: 1 | 2 | 3 | 4;
  className?: string;
}

const lineClampClasses: Record<NonNullable<QuestionExcerptProps['maxLines']>, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
};

export const QuestionContent = memo(function QuestionContent({
  content,
  variant = 'prompt',
  className,
  headingLevel,
}: QuestionContentProps) {
  return (
    <MarkdownRenderer
      content={content}
      variant={variant}
      className={className}
      headingLevel={headingLevel}
    />
  );
});

export const QuestionExcerpt = memo(function QuestionExcerpt({
  content,
  maxLines = 2,
  className,
}: QuestionExcerptProps) {
  return (
    <span className={cn('block', lineClampClasses[maxLines], className)}>
      {markdownToPlainText(content)}
    </span>
  );
});
