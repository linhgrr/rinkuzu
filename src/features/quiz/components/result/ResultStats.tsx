'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import type { ChatMessage } from '@/features/quiz/lib/chat-history';

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
  chatHistories: Record<string, ChatMessage[]>;
  getChatStats: () => ChatStats;
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
  chatHistories,
  getChatStats,
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

      {/* Performance Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('performanceSummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              <div className="text-sm text-green-700">{tProfile('correct')}</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
              <div className="text-sm text-red-700">{t('incorrect')}</div>
            </div>
            <div className="text-center p-4 bg-neutral-50 rounded-lg">
              <div className="text-2xl font-bold text-neutral-600">{unansweredCount}</div>
              <div className="text-sm text-neutral-700">{t('unanswered')}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-brand-trust">{score}%</div>
              <div className="text-sm text-brand-trust">{tProfile('avgScore')}</div>
            </div>
          </div>

          {/* Chat Statistics */}
          {Object.keys(chatHistories).length > 0 &&
            (() => {
              const stats = getChatStats();
              return stats.totalTurns > 0 ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-neutral-700 mb-3">
                    {tProfile('chatWithRinChan')} Statistics
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-brand-trust">{stats.totalTurns}</div>
                      <div className="text-sm text-green-700">Total Chat Turns</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-brand-trust">
                        {stats.questionsWithChat}
                      </div>
                      <div className="text-sm text-green-700">Questions Discussed</div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
        </CardContent>
      </Card>
    </>
  );
}
