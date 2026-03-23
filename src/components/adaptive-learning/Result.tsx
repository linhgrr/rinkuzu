'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { ResultContent, ResultEmptyState, ResultLoadingState } from './ResultSections'
import { useResultState } from './hooks/use-result-state'

const AdaptiveLearningChatbot = dynamic(() => import('./Chatbot'), {
  ssr: false,
})

interface ResultProps {
  sessionId: string
}

export default function AdaptiveLearningResult({ sessionId }: ResultProps) {
  const t = useTranslations('adaptiveLearning')
  const {
    averageMasteryPercent,
    chatContext,
    closeChat,
    exercise,
    handleGoDashboard,
    handleNext,
    hydrating,
    isChatOpen,
    isCorrect,
    masteryPercent,
    openChat,
    result,
  } = useResultState(sessionId, t)

  if (hydrating)
    return <ResultLoadingState t={t} />

  if (!result || !exercise)
    return <ResultEmptyState onGoDashboard={handleGoDashboard} t={t} />

  return (
    <>
      <ResultContent
        averageMasteryPercent={averageMasteryPercent}
        exercise={exercise}
        isCorrect={isCorrect}
        masteryPercent={masteryPercent}
        onGoDashboard={handleGoDashboard}
        onHandleNext={handleNext}
        onOpenChat={openChat}
        result={result}
        t={t}
      />
      <AdaptiveLearningChatbot
        sessionId={sessionId}
        isOpen={isChatOpen}
        onClose={closeChat}
        context={chatContext}
      />
    </>
  )
}
