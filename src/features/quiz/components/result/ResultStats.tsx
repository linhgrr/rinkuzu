'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

type TranslateParams = Record<string, string | number | Date>;

interface ChatStats {
  totalTurns: number;
  questionsWithChat: number;
}

interface ResultStatsProps {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  chatStats: ChatStats;
  getScoreColor: (score: number) => string;
  getScoreMessage: (score: number) => string;
  t: (key: string, values?: TranslateParams) => string;
  tProfile: (key: string) => string;
}

export function ResultStats({
  score,
  correctCount,
  incorrectCount,
  unansweredCount,
  totalQuestions,
  chatStats,
  getScoreColor,
  getScoreMessage,
  t,
  tProfile,
}: ResultStatsProps) {
  return (
    <>
      {/* Score Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-center">{tProfile('avgScore')}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="space-y-4">
            <div className={`text-6xl font-bold ${getScoreColor(score)}`}>{score}%</div>

            <div className="text-xl text-neutral-700">{getScoreMessage(score)}</div>

            <div className="grid grid-cols-2 gap-4 sm:flex sm:justify-center sm:space-x-8 text-sm text-neutral-600">
              <div className="text-center">
                <div className="font-semibold text-lg text-neutral-900">{correctCount}</div>
                <div>{tProfile('correct')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-neutral-900">{incorrectCount}</div>
                <div>{t('incorrect')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-neutral-900">{unansweredCount}</div>
                <div>{t('unanswered')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-neutral-900">{totalQuestions}</div>
                <div>{t('total', { ns: 'common' })}</div>
              </div>
            </div>

            {/* Score visualization */}
            <div className="w-full bg-neutral-200 rounded-full h-4 mt-6">
              <div
                className={`h-4 rounded-full transition-all duration-1000 ${
                  score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {chatStats.totalTurns > 0 ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {tProfile('chatWithRinChan')} · {t('chatStatistics')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xl font-bold text-brand-trust">{chatStats.totalTurns}</div>
              <div className="text-sm text-green-700">{t('totalChatTurns')}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xl font-bold text-brand-trust">
                {chatStats.questionsWithChat}
              </div>
              <div className="text-sm text-green-700">{t('questionsDiscussed')}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
