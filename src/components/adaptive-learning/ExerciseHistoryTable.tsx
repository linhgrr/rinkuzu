'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import {
  HiCheck,
  HiOutlineEye,
  HiOutlineX,
} from '@/components/icons'
import { getExercisePromptSections } from './exercise-prompt'
import { BLOOM_LABELS } from './types'
import type { ExerciseHistoryFull } from './types'
import { formatSessionHistoryDate } from './session-history-utils'

const PAGE_SIZE = 10

interface ExerciseHistoryTableProps {
  exercises: ExerciseHistoryFull[]
}

function renderExercisePrompt(exercise: ExerciseHistoryFull) {
  const promptSections = getExercisePromptSections(exercise)
  return (
    <div className="space-y-3">
      {promptSections.lead ? <DynamicMarkdownRenderer content={promptSections.lead} /> : null}
      <div className={promptSections.lead ? 'rounded-lg border border-slate-200 bg-slate-50 p-3' : ''}>
        <DynamicMarkdownRenderer content={promptSections.primary} />
      </div>
    </div>
  )
}

function renderCorrectAnswer(exercise: ExerciseHistoryFull, t: ReturnType<typeof useTranslations<'adaptiveLearning'>>) {
  if (exercise.exercise_type === 'matching' && exercise.pairs?.length) {
    return (
      <div className="space-y-2">
        {exercise.pairs.map((pair, idx) => (
          <div key={`${pair.left}-${idx}`} className="flex items-center justify-between rounded-lg border border-green-100 bg-white p-2">
            <div className="min-w-0 flex-1 text-xs text-slate-600">
              <DynamicMarkdownRenderer content={pair.left} />
            </div>
            <div className="mx-2 text-green-500">→</div>
            <div className="min-w-0 flex-1 text-right text-xs font-semibold text-green-700">
              <DynamicMarkdownRenderer content={pair.right} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (exercise.exercise_type === 'ordering' && Array.isArray(exercise.correct_answer)) {
    return (
      <div className="flex flex-wrap gap-2">
        {exercise.correct_answer.map((item, idx) => (
          <div key={`${item}-${idx}`} className="flex items-center gap-2 rounded-lg border border-green-100 bg-white p-2 text-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 font-mono text-[10px] font-bold text-green-700">
              {idx + 1}
            </span>
            <div className="min-w-0 text-slate-700">
              <DynamicMarkdownRenderer content={item} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (exercise.exercise_type === 'fill_blank' && Array.isArray(exercise.correct_answer)) {
    return <DynamicMarkdownRenderer content={exercise.correct_answer.join(', ')} />
  }

  if (exercise.exercise_type === 'multi_correct' && Array.isArray(exercise.correct_answer)) {
    return <DynamicMarkdownRenderer content={exercise.correct_answer.join(', ')} />
  }

  if (exercise.exercise_type === 'true_false' && typeof exercise.correct_answer === 'boolean') {
    return <span>{exercise.correct_answer ? t('exercise.interactions.trueLabel') : t('exercise.interactions.falseLabel')}</span>
  }

  return <DynamicMarkdownRenderer content={exercise.correct_option} />
}

export function ExerciseHistoryTable({ exercises }: ExerciseHistoryTableProps) {
  const t = useTranslations('adaptiveLearning')
  const locale = useLocale()
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseHistoryFull | null>(null)

  const getBloomLabel = useCallback((level: number) => {
    const bloomLabel = BLOOM_LABELS[Math.max(0, Math.min(BLOOM_LABELS.length - 1, level - 1))] || 'Remember'
    return t(`bloom.${bloomLabel.toLowerCase()}` as any)
  }, [t])

  const paginatedExercises = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return exercises.slice(start, start + PAGE_SIZE)
  }, [currentPage, exercises])

  const totalPages = Math.ceil(exercises.length / PAGE_SIZE)

  if (!exercises.length) {
    return <p className="py-4 text-center text-sm text-gray-400">{t('history.table.noExercise')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th className="px-5 py-3 text-left">#</th>
              <th className="px-5 py-3 text-left">{t('masteryMatrix.concept')}</th>
              <th className="px-5 py-3 text-left">{t('history.table.bloom')}</th>
              <th className="w-1/3 px-5 py-3 text-left">{t('history.table.question')}</th>
              <th className="px-5 py-3 text-center">{t('history.table.result')}</th>
              <th className="px-5 py-3 text-left">{t('history.table.time')}</th>
              <th className="px-5 py-3 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedExercises.map((exercise, index) => (
              <tr key={exercise.exercise_id || index} className="transition-colors hover:bg-gray-50">
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                <td className="px-5 py-3 font-medium text-gray-900">{exercise.concept_name}</td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                    {getBloomLabel(exercise.bloom_level)}
                  </span>
                </td>
                <td className="max-w-[280px] truncate px-5 py-3 text-gray-600" title={exercise.question}>
                  {exercise.question}
                </td>
                <td className="flex justify-center px-5 py-3">
                  {exercise.is_correct == null ? (
                    <span className="font-medium text-gray-300">—</span>
                  ) : exercise.is_correct ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-900">
                      <HiCheck className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-400">
                      <HiOutlineX className="h-4 w-4" />
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-gray-500">
                  {formatSessionHistoryDate(exercise.timestamp, locale)}
                </td>
                <td className="px-5 py-3 text-center">
                  <button
                    onClick={() => setSelectedExercise(exercise)}
                    className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    title={t('history.table.viewDetails')}
                  >
                    <HiOutlineEye className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="py-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      ) : null}

      <Modal
        isOpen={!!selectedExercise}
        onClose={() => setSelectedExercise(null)}
        title={t('history.table.exerciseDetails')}
        size="large"
      >
        {selectedExercise ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">{t('masteryMatrix.concept')}:</span>
                <span className="ml-2 font-semibold text-gray-900">{selectedExercise.concept_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">{t('history.table.bloomLevel')}:</span>
                <span className="ml-2 font-semibold text-gray-900">{getBloomLabel(selectedExercise.bloom_level)}</span>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">{t('history.table.question')}</h4>
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
                {renderExercisePrompt(selectedExercise)}
              </div>
            </div>

            {Object.keys(selectedExercise.options || {}).length > 0 ? (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">{t('history.table.options')}</h4>
                <div className="space-y-2.5">
                  {Object.entries(selectedExercise.options || {}).map(([key, value]) => {
                    const isUserAnswer = key === selectedExercise.user_answer
                    const isCorrect = key === selectedExercise.correct_option

                    const optionClass = isCorrect
                      ? 'border-green-200 bg-green-50/50 text-green-900'
                      : isUserAnswer
                        ? 'border-red-200 bg-red-50/50 text-red-900'
                        : 'border-gray-200 bg-white text-gray-700'

                    const badgeTone = isCorrect
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'

                    return (
                      <div key={key} className={`flex items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors ${optionClass}`}>
                        <span className={`mt-0.5 w-6 shrink-0 font-bold ${isCorrect ? 'text-green-700' : isUserAnswer ? 'text-red-700' : 'text-gray-500'}`}>{key}.</span>
                        <span className="flex-1 leading-relaxed">
                          <DynamicMarkdownRenderer content={value} />
                        </span>
                        {isCorrect ? (
                          <div className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${badgeTone}`}>
                            <HiCheck className="h-3.5 w-3.5" />
                            {t('history.table.correctBadge')}
                          </div>
                        ) : null}
                        {isUserAnswer && !isCorrect ? (
                          <div className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${badgeTone}`}>
                            <HiOutlineX className="h-3.5 w-3.5" />
                            {t('history.table.yourAnswerBadge')}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">{t('history.table.yourAnswerCard')}</div>
                  <div>{selectedExercise.user_answer || t('history.table.noAnswer')}</div>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 text-sm text-green-900 shadow-sm">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-700">{t('history.table.correctAnswerCard')}</div>
                  {renderCorrectAnswer(selectedExercise, t)}
                </div>
              </div>
            )}

            {selectedExercise.explanation ? (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">{t('history.table.explanation')}</h4>
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-5 text-sm leading-relaxed text-blue-900 shadow-sm sm:p-6">
                  <DynamicMarkdownRenderer content={selectedExercise.explanation} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-gray-100 pt-5">
              <Button onClick={() => setSelectedExercise(null)} variant="outline" className="px-6">
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
