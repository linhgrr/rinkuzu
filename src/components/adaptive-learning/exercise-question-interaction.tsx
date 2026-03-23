'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Reorder } from 'framer-motion'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer'
import type { Exercise, SubmitAnswerPayload } from './types'

function OptionCard({
  active,
  badge,
  onClick,
  value,
}: {
  active: boolean
  badge: string
  onClick: () => void
  value: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full cursor-pointer items-start gap-4 rounded-[12px] border p-4 text-left transition-all duration-200 sm:p-5 ${active
        ? 'border-teal-600 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-slate-400 active:scale-[0.99]'
      }`}
    >
      {active && <div className="absolute inset-0 rounded-xl bg-teal-500/10" />}
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors sm:h-8 sm:w-8 sm:text-sm ${active
          ? 'border-teal-600 bg-teal-600 text-white'
          : 'border-slate-300 text-slate-500 group-hover:border-slate-400'
        }`}
      >
        {badge}
      </div>
      <span className={`text-base leading-relaxed transition-colors duration-200 ${active ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
        <DynamicMarkdownRenderer content={value} />
      </span>
    </button>
  )
}

type MatchingInteractionProps = {
  leftItems: string[]
  rightItems: string[]
  onSetMatchingOrder: (leftItems: string[], rightItems: string[]) => void
  t: (key: string) => string
}

type MatchingRightEntry = {
  id: string
  value: string
}

function MatchingInteraction({
  leftItems,
  rightItems,
  onSetMatchingOrder,
  t,
}: MatchingInteractionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cardMinHeight, setCardMinHeight] = useState<number | null>(null)
  const normalizedRightItems = leftItems.map((_, index) => rightItems[index] ?? '')
  const [rightEntries, setRightEntries] = useState<MatchingRightEntry[]>(() =>
    normalizedRightItems.map((item, index) => ({ id: `right-${index}`, value: item })),
  )
  const normalizedOrderKey = normalizedRightItems.join('\u0001')
  const renderedOrderKey = rightEntries.map(entry => entry.value).join('\u0001')

  useEffect(() => {
    if (renderedOrderKey === normalizedOrderKey)
      return

    setRightEntries(normalizedRightItems.map((item, index) => ({ id: `right-${index}`, value: item })))
  }, [normalizedOrderKey, normalizedRightItems, renderedOrderKey])

  useEffect(() => {
    const measureCards = () => {
      const cards = containerRef.current?.querySelectorAll<HTMLElement>('[data-matching-card="true"]') ?? []
      let nextHeight = 0

      cards.forEach((card) => {
        nextHeight = Math.max(nextHeight, card.offsetHeight)
      })

      setCardMinHeight(nextHeight > 0 ? nextHeight : null)
    }

    const frameId = window.requestAnimationFrame(measureCards)
    const observer = typeof ResizeObserver !== 'undefined' && containerRef.current
      ? new ResizeObserver(() => measureCards())
      : null

    if (observer && containerRef.current) {
      observer.observe(containerRef.current)
      containerRef.current.querySelectorAll<HTMLElement>('[data-matching-card="true"]').forEach(card => observer.observe(card))
    }

    window.addEventListener('resize', measureCards)

    return () => {
      window.cancelAnimationFrame(frameId)
      observer?.disconnect()
      window.removeEventListener('resize', measureCards)
    }
  }, [leftItems, rightEntries])

  const sharedCardStyle = cardMinHeight ? { minHeight: `${cardMinHeight}px` } : undefined

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {t('exercise.interactions.matchingInstruction')}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          
          {leftItems.map((item, index) => (
            <div
              key={`left-${index}-${item}`}
              data-matching-card="true"
              style={sharedCardStyle}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-500">
                {index + 1}
              </div>
              <div className="flex-1 text-sm text-slate-700">
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
              setRightEntries(nextEntries)
              onSetMatchingOrder(leftItems, nextEntries.map(entry => entry.value))
            }}
            className="space-y-3"
          >
            {rightEntries.map((entry, index) => (
              <Reorder.Item
                key={entry.id}
                value={entry}
                data-matching-card="true"
                style={sharedCardStyle}
                className="group flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-teal-500/50 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                <div className="flex-1 text-right text-sm text-slate-700">
                  <DynamicMarkdownRenderer content={entry.value} />
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-500">
                  {String.fromCharCode(65 + index)}
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </div>
    </div>
  )
}

type ExerciseInteractionProps = {
  answerDraft: SubmitAnswerPayload
  exercise: Exercise
  onMoveOrderingItem: (fromIndex: number, toIndex: number) => void
  onSetOrderingAnswer: (ordering: string[]) => void
  onSelectChoice: (value: string) => void
  onSetBlankAnswer: (value: string) => void
  onSetBooleanAnswer: (value: boolean) => void
  onSetTextAnswer: (value: string) => void
  onSetMatchingOrder: (leftItems: string[], rightItems: string[]) => void
  onToggleChoice: (value: string) => void
  optionEntries: [string, string][]
}

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
  const t = useTranslations('adaptiveLearning')

  if (exercise.exercise_type === 'true_false') {
    return (
      <div className="grid gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-relaxed text-slate-800">
          <DynamicMarkdownRenderer content={exercise.statement || exercise.question} />
        </div>
        {[
          { label: 'T', value: t('exercise.interactions.trueLabel'), bool: true },
          { label: 'F', value: t('exercise.interactions.falseLabel'), bool: false },
        ].map(item => (
          <OptionCard
            key={item.value}
            active={answerDraft.boolean === item.bool}
            badge={item.label}
            onClick={() => onSetBooleanAnswer(item.bool)}
            value={item.value}
          />
        ))}
      </div>
    )
  }

  if (exercise.exercise_type === 'fill_blank') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-relaxed text-slate-800">
          <DynamicMarkdownRenderer content={exercise.question} />
        </div>
        <textarea
          value={answerDraft.blanks?.[0] || ''}
          onChange={event => onSetBlankAnswer(event.target.value)}
          rows={3}
          placeholder={t('exercise.interactions.fillBlankPlaceholder')}
          className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-teal-600"
        />
        {exercise.hint ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('exercise.interactions.hintPrefix')}: {exercise.hint}
          </div>
        ) : null}
      </div>
    )
  }

  if (exercise.exercise_type === 'multi_correct') {
    const selectedChoices = new Set(answerDraft.choices || [])
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
    )
  }

  if (exercise.exercise_type === 'ordering') {
    const ordering = answerDraft.ordering || exercise.items
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              whileDrag={{ 
                scale: 1.02, 
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                zIndex: 50 
              }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 1
              }}
              className="group relative flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 font-medium text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                {index + 1}
              </div>
              <div className="flex-1 text-slate-700">
                <DynamicMarkdownRenderer content={item} />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveOrderingItem(index, index - 1)
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                    disabled={index === ordering.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveOrderingItem(index, index + 1)
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="cursor-grab p-1 text-slate-300 group-hover:text-slate-400">
                  <GripVertical className="h-5 w-5" />
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    )
  }

  if (exercise.exercise_type === 'matching') {
    const matching = answerDraft.matching || {}
    const fallbackLeftItems = exercise.pairs.map(pair => pair.left)
    const leftItems = Object.keys(matching).length > 0 ? Object.keys(matching) : fallbackLeftItems
    const fallbackRightItems = exercise.right_items.length > 0
      ? exercise.right_items
      : exercise.pairs.map(pair => pair.right)
    const rightItems = leftItems.map((left, index) => matching[left] ?? fallbackRightItems[index] ?? '')

    return <MatchingInteraction leftItems={leftItems} rightItems={rightItems} onSetMatchingOrder={onSetMatchingOrder} t={t} />
  }

  if (exercise.exercise_type === 'short_answer') {
    return (
      <div className="space-y-4">
        {exercise.rubric.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 text-sm font-semibold text-slate-900">{t('exercise.interactions.shortAnswerRubricTitle')}</div>
            <ul className="space-y-2 text-sm text-slate-700">
              {exercise.rubric.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <textarea
          value={answerDraft.text || ''}
          onChange={event => onSetTextAnswer(event.target.value)}
          rows={8}
          placeholder={t('exercise.interactions.shortAnswerPlaceholder')}
          className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-teal-600"
        />
      </div>
    )
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
  )
}
