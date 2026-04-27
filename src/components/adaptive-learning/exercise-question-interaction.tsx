'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Reorder } from 'framer-motion';
import {
  HiChevronDown,
  HiChevronUp,
  HiOutlineDotsVertical,
  HiOutlineLightBulb,
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import { getExercisePromptSections } from './exercise-prompt';
import type { Exercise, SubmitAnswerPayload } from './types';

const REORDER_INITIAL = { opacity: 0, y: 10 };
const REORDER_ANIMATE = { opacity: 1, y: 0 };
const REORDER_EXIT = { opacity: 0, y: -10 };
const REORDER_DRAG = { scale: 1.02, boxShadow: 'var(--shadow-md)', zIndex: 50 };
const REORDER_TRANSITION = { type: 'spring' as const, stiffness: 500, damping: 30, mass: 1 };

const OptionCard = memo(function OptionCard({
  active,
  badge,
  onClick,
  value,
}: {
  active: boolean;
  badge: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full cursor-pointer items-start gap-4 rounded-lg border p-4 text-left transition-all duration-200 sm:p-5 ${
        active
          ? 'border-brand-action bg-orange-50 shadow-sm'
          : 'border-neutral-200 bg-white hover:border-neutral-400 active:scale-[0.99]'
      }`}
    >
      {active && <div className="absolute inset-0 rounded-xl bg-orange-500/10" />}
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors sm:h-8 sm:w-8 sm:text-sm ${
          active
            ? 'border-brand-action bg-brand-action text-white'
            : 'border-neutral-300 text-neutral-500 group-hover:border-neutral-400'
        }`}
      >
        {badge}
      </div>
      <span
        className={`text-base leading-relaxed transition-colors duration-200 ${active ? 'font-medium text-neutral-900' : 'text-neutral-700'}`}
      >
        <DynamicMarkdownRenderer content={value} />
      </span>
    </button>
  );
});

type MatchingInteractionProps = {
  leftItems: string[];
  rightItems: string[];
  onSetMatchingOrder: (leftItems: string[], rightItems: string[]) => void;
  t: (key: string) => string;
};

type MatchingRightEntry = {
  id: string;
  value: string;
};

function MatchingInteraction({
  leftItems,
  rightItems,
  onSetMatchingOrder,
  t,
}: MatchingInteractionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardMinHeight, setCardMinHeight] = useState<number | null>(null);
  const normalizedRightItems = leftItems.map((_, index) => rightItems[index] ?? '');
  const [rightEntries, setRightEntries] = useState<MatchingRightEntry[]>(() =>
    normalizedRightItems.map((item, index) => ({ id: `right-${index}`, value: item })),
  );
  const normalizedOrderKey = normalizedRightItems.join('\u0001');
  const renderedOrderKey = rightEntries.map((entry) => entry.value).join('\u0001');

  useEffect(() => {
    if (renderedOrderKey === normalizedOrderKey) return;

    setRightEntries(
      normalizedRightItems.map((item, index) => ({ id: `right-${index}`, value: item })),
    );
  }, [normalizedOrderKey, normalizedRightItems, renderedOrderKey]);

  useEffect(() => {
    const measureCards = () => {
      const cards =
        containerRef.current?.querySelectorAll<HTMLElement>('[data-matching-card="true"]') ?? [];
      let nextHeight = 0;

      cards.forEach((card) => {
        nextHeight = Math.max(nextHeight, card.offsetHeight);
      });

      setCardMinHeight(nextHeight > 0 ? nextHeight : null);
    };

    const frameId = window.requestAnimationFrame(measureCards);
    const observer =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => measureCards())
        : null;

    if (observer && containerRef.current) {
      observer.observe(containerRef.current);
      containerRef.current
        .querySelectorAll<HTMLElement>('[data-matching-card="true"]')
        .forEach((card) => observer.observe(card));
    }

    window.addEventListener('resize', measureCards);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener('resize', measureCards);
    };
  }, [leftItems, rightEntries]);

  const sharedCardStyle = cardMinHeight ? { minHeight: `${cardMinHeight}px` } : undefined;

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        {t('exercise.interactions.matchingInstruction')}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          {leftItems.map((item, index) => (
            <div
              key={`left-${index}-${item}`}
              data-matching-card="true"
              style={sharedCardStyle}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-xs font-bold text-neutral-500">
                {index + 1}
              </div>
              <div className="flex-1 text-sm text-neutral-700">
                <DynamicMarkdownRenderer content={item} />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Reorder.Group
            axis="y"
            values={rightEntries}
            onReorder={(nextEntries) => {
              setRightEntries(nextEntries);
              onSetMatchingOrder(
                leftItems,
                nextEntries.map((entry) => entry.value),
              );
            }}
            className="space-y-3"
          >
            {rightEntries.map((entry, index) => (
              <Reorder.Item
                key={entry.id}
                value={entry}
                data-matching-card="true"
                style={sharedCardStyle}
                className="group flex cursor-grab items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-trust/50 active:cursor-grabbing"
              >
                <HiOutlineDotsVertical className="h-4 w-4 shrink-0 text-neutral-300" />
                <div className="flex-1 text-right text-sm text-neutral-700">
                  <DynamicMarkdownRenderer content={entry.value} />
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-xs font-bold text-neutral-500">
                  {String.fromCharCode(65 + index)}
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </div>
    </div>
  );
}

type ExerciseInteractionProps = {
  answerDraft: SubmitAnswerPayload;
  exercise: Exercise;
  onMoveOrderingItem: (fromIndex: number, toIndex: number) => void;
  onSetOrderingAnswer: (ordering: string[]) => void;
  onSelectChoice: (value: string) => void;
  onSetBlankAnswer: (value: string) => void;
  onSetBooleanAnswer: (value: boolean) => void;
  onSetTextAnswer: (value: string) => void;
  onSetMatchingOrder: (leftItems: string[], rightItems: string[]) => void;
  onToggleChoice: (value: string) => void;
  optionEntries: [string, string][];
};

export function ExerciseInteraction({
  answerDraft,
  exercise,
  onMoveOrderingItem,
  onSetOrderingAnswer,
  onSelectChoice,
  onSetBlankAnswer,
  onSetBooleanAnswer,
  onSetTextAnswer,
  onSetMatchingOrder,
  onToggleChoice,
  optionEntries,
}: ExerciseInteractionProps) {
  const t = useTranslations('adaptiveLearning');
  const [isHintOpen, setIsHintOpen] = useState(false);
  const promptSections = getExercisePromptSections(exercise);

  useEffect(() => {
    setIsHintOpen(false);
  }, [exercise.exercise_id, exercise.hint]);

  if (exercise.exercise_type === 'true_false') {
    return (
      <div className="grid gap-3 sm:gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-base leading-relaxed text-neutral-800">
          <DynamicMarkdownRenderer content={promptSections.primary} />
        </div>
        {[
          { label: 'T', value: t('exercise.interactions.trueLabel'), bool: true },
          { label: 'F', value: t('exercise.interactions.falseLabel'), bool: false },
        ].map((item) => (
          <OptionCard
            key={item.value}
            active={answerDraft.boolean === item.bool}
            badge={item.label}
            onClick={() => onSetBooleanAnswer(item.bool)}
            value={item.value}
          />
        ))}
      </div>
    );
  }

  if (exercise.exercise_type === 'fill_blank') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-base leading-relaxed text-neutral-800">
          <DynamicMarkdownRenderer content={promptSections.primary} />
        </div>
        <textarea
          value={answerDraft.blanks?.[0] || ''}
          onChange={(event) => onSetBlankAnswer(event.target.value)}
          rows={3}
          placeholder={t('exercise.interactions.fillBlankPlaceholder')}
          aria-label={t('exercise.interactions.fillBlankPlaceholder')}
          className="min-h-[120px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition-colors focus:border-brand-trust focus:ring-2 focus:ring-[var(--focus-ring-soft)]"
        />
        {exercise.hint ? (
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsHintOpen((open) => !open)}
              aria-expanded={isHintOpen}
              className="flex w-full items-center justify-between rounded-none px-4 py-3 text-left text-sm font-medium text-amber-900 hover:bg-amber-100/80"
            >
              <span className="flex items-center gap-2">
                <HiOutlineLightBulb className="h-4 w-4 shrink-0" />
                <span>
                  {isHintOpen
                    ? t('exercise.interactions.hideHint')
                    : t('exercise.interactions.showHint')}
                </span>
              </span>
              {isHintOpen ? (
                <HiChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <HiChevronDown className="h-4 w-4 shrink-0" />
              )}
            </Button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${isHintOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
              <div className="overflow-hidden">
                <div className="border-t border-amber-200 px-4 py-3 text-sm text-amber-900">
                  <DynamicMarkdownRenderer content={exercise.hint} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (exercise.exercise_type === 'multi_correct') {
    const selectedChoices = new Set(answerDraft.choices || []);
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {t('exercise.interactions.multiCorrectInstruction')}
        </div>
        <div className="grid gap-3 sm:gap-4">
          {optionEntries.map(([key, value]) => (
            <OptionCard
              key={key}
              active={selectedChoices.has(key)}
              badge={key}
              onClick={() => onToggleChoice(key)}
              value={value}
            />
          ))}
        </div>
      </div>
    );
  }

  if (exercise.exercise_type === 'ordering') {
    const ordering = answerDraft.ordering || exercise.items;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {t('exercise.interactions.orderingInstruction')}
        </div>
        <Reorder.Group
          axis="y"
          values={ordering}
          onReorder={onSetOrderingAnswer}
          className="space-y-3"
        >
          {ordering.map((item, index) => (
            <Reorder.Item
              key={item}
              value={item}
              layout
              initial={REORDER_INITIAL}
              animate={REORDER_ANIMATE}
              exit={REORDER_EXIT}
              whileDrag={REORDER_DRAG}
              transition={REORDER_TRANSITION}
              className="group relative flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-50 font-medium text-neutral-500 group-hover:bg-green-50 group-hover:text-brand-trust">
                {index + 1}
              </div>
              <div className="flex-1 text-neutral-700">
                <DynamicMarkdownRenderer content={item} />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-400 hover:text-brand-trust"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveOrderingItem(index, index - 1);
                    }}
                  >
                    <HiChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-400 hover:text-brand-trust"
                    disabled={index === ordering.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveOrderingItem(index, index + 1);
                    }}
                  >
                    <HiChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="cursor-grab p-1 text-neutral-300 group-hover:text-neutral-400">
                  <HiOutlineDotsVertical className="h-5 w-5" />
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    );
  }

  if (exercise.exercise_type === 'matching') {
    const matching = answerDraft.matching || {};
    const fallbackLeftItems = exercise.pairs.map((pair) => pair.left);
    const leftItems = Object.keys(matching).length > 0 ? Object.keys(matching) : fallbackLeftItems;
    const fallbackRightItems =
      exercise.right_items.length > 0
        ? exercise.right_items
        : exercise.pairs.map((pair) => pair.right);
    const rightItems = leftItems.map(
      (left, index) => matching[left] ?? fallbackRightItems[index] ?? '',
    );

    return (
      <MatchingInteraction
        leftItems={leftItems}
        rightItems={rightItems}
        onSetMatchingOrder={onSetMatchingOrder}
        t={t}
      />
    );
  }

  if (exercise.exercise_type === 'short_answer') {
    return (
      <div className="space-y-4">
        <textarea
          value={answerDraft.text || ''}
          onChange={(event) => onSetTextAnswer(event.target.value)}
          rows={8}
          placeholder={t('exercise.interactions.shortAnswerPlaceholder')}
          aria-label={t('exercise.interactions.shortAnswerPlaceholder')}
          className="min-h-[220px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition-colors focus:border-brand-trust focus:ring-2 focus:ring-[var(--focus-ring-soft)]"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4">
      {optionEntries.map(([key, value], idx) => (
        <OptionCard
          key={key}
          active={answerDraft.choice === key}
          badge={String.fromCharCode(65 + idx)}
          onClick={() => onSelectChoice(key)}
          value={value}
        />
      ))}
    </div>
  );
}
