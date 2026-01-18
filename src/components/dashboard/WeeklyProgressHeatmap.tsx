'use client';

import { memo, useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from '@/components/icons';

interface DailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

interface WeeklyProgressHeatmapProps {
  weeklyActivity: Record<string, DailyActivity>;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getIntensityClass(questions: number): string {
  if (questions === 0) return 'bg-gray-100';
  if (questions <= 5) return 'bg-green-200';
  if (questions <= 10) return 'bg-green-400';
  if (questions <= 20) return 'bg-green-500';
  return 'bg-green-600';
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const WeeklyProgressHeatmap = memo(function WeeklyProgressHeatmap({
  weeklyActivity,
}: WeeklyProgressHeatmapProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekDates, weekLabel, isCurrentWeek } = useMemo(() => {
    const today = new Date();
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() + weekOffset * 7);

    const weekStart = getWeekStart(baseDate);
    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const formatShort = (d: Date) =>
      `${d.getDate()}/${d.getMonth() + 1}`;

    return {
      weekDates: dates,
      weekLabel: `${formatShort(weekStart)} - ${formatShort(weekEnd)}`,
      isCurrentWeek: weekOffset === 0,
    };
  }, [weekOffset]);

  const handlePrevWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => {
    if (weekOffset < 0) setWeekOffset((prev) => prev + 1);
  };

  const todayKey = formatDateKey(new Date());

  return (
    <Card className="p-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1d1d1f]">Weekly Progress</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Previous week"
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-[#86868b] min-w-[100px] text-center">
            {isCurrentWeek ? 'This week' : weekLabel}
          </span>
          <button
            onClick={handleNextWeek}
            disabled={weekOffset >= 0}
            className={`p-1 rounded-full transition-colors ${
              weekOffset >= 0
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-gray-100'
            }`}
            aria-label="Next week"
          >
            <HiOutlineChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Heat map grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const dateKey = formatDateKey(date);
          const activity = weeklyActivity?.[dateKey];
          const questions = activity?.questionsReviewed || 0;
          const xp = activity?.xpEarned || 0;
          const isToday = dateKey === todayKey;

          return (
            <div key={dateKey} className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#86868b] font-medium">
                {DAY_LABELS[i]}
              </span>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${getIntensityClass(questions)} ${
                  isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                } ${questions > 0 ? 'text-white' : 'text-gray-400'}`}
                title={`${date.toLocaleDateString()}: ${questions} questions, ${xp} XP`}
              >
                {questions > 0 ? questions : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#86868b]">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-gray-100" />
          <div className="w-4 h-4 rounded bg-green-200" />
          <div className="w-4 h-4 rounded bg-green-400" />
          <div className="w-4 h-4 rounded bg-green-500" />
          <div className="w-4 h-4 rounded bg-green-600" />
        </div>
        <span>More</span>
      </div>
    </Card>
  );
});
