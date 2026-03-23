'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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

function CustomDropdown({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen) } }}
        className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 ${isOpen ? 'border-teal-600 ring-2 ring-teal-600/20' : ''}`}
      >
        <div className="flex-1 text-left overflow-hidden prose-sm prose-slate max-w-none prose-p:my-0 prose-p:leading-normal">
          {value ? <DynamicMarkdownRenderer content={value} /> : <span className="text-slate-500">{placeholder}</span>}
        </div>
        <svg className={`ml-2 h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 max-h-60 min-w-[100%] max-w-[150%] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1">
          {options.map((option, idx) => {
            const isSelected = value === option;
            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange(option)
                  setIsOpen(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChange(option)
                    setIsOpen(false)
                  }
                }}
                className={`flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm transition-colors mb-1 last:mb-0 hover:bg-slate-100 ${isSelected ? 'bg-teal-50 text-teal-900' : 'text-slate-700'}`}
              >
                <div className="flex-1 text-left prose-sm prose-slate max-w-none prose-p:my-0 prose-p:leading-normal">
                  <DynamicMarkdownRenderer content={option} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type ExerciseInteractionProps = {
  answerDraft: SubmitAnswerPayload
  exercise: Exercise
  onMoveOrderingItem: (fromIndex: number, toIndex: number) => void
  onSelectChoice: (value: string) => void
  onSetBlankAnswer: (value: string) => void
  onSetBooleanAnswer: (value: boolean) => void
  onSetTextAnswer: (value: string) => void
  onSetMatchingAnswer: (left: string, right: string) => void
  onToggleChoice: (value: string) => void
  optionEntries: [string, string][]
}

export function ExerciseInteraction({
  answerDraft,
  exercise,
  onMoveOrderingItem,
  onSelectChoice,
  onSetBlankAnswer,
  onSetBooleanAnswer,
  onSetTextAnswer,
  onSetMatchingAnswer,
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
        <div className="space-y-3">
          {ordering.map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div className="flex-1 text-sm leading-relaxed text-slate-800">
                <DynamicMarkdownRenderer content={item} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700"
                  onClick={() => onMoveOrderingItem(index, index - 1)}
                  disabled={index === 0}
                >
                  {t('exercise.interactions.moveUp')}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700"
                  onClick={() => onMoveOrderingItem(index, index + 1)}
                  disabled={index === ordering.length - 1}
                >
                  {t('exercise.interactions.moveDown')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (exercise.exercise_type === 'matching') {
    const matching = answerDraft.matching || {}
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t('exercise.interactions.matchingInstruction')}
        </div>
        <div className="space-y-3">
          {exercise.pairs.map((pair) => (
            <div key={pair.left} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <div className="text-sm leading-relaxed text-slate-800">
                <DynamicMarkdownRenderer content={pair.left} />
              </div>
              <CustomDropdown
                value={matching[pair.left] || ''}
                onChange={(value) => onSetMatchingAnswer(pair.left, value)}
                options={exercise.right_items}
                placeholder={t('exercise.interactions.matchingPlaceholder')}
              />
            </div>
          ))}
        </div>
      </div>
    )
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
