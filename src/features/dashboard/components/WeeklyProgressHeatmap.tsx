'use client';

import { useMemo, useState } from 'react';
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
  labels: {
    weeklyProgress: string;
    thisWeek: string;
    less: string;
    more: string;
  };
  embedded?: boolean;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getIntensityClass(questions: number): string {
  if (questions === 0) return 'bg-neutral-50';
  if (questions <= 5) return 'bg-neutral-200';
  if (questions <= 10) return 'bg-neutral-400';
  if (questions <= 20) return 'bg-neutral-600';
  return 'bg-neutral-900';
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeeklyProgressHeatmap({
  weeklyActivity,
  labels,
  embedded = false,
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

    const formatShort = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

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

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">{labels.weeklyProgress}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-1 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <span className="text-sm text-[var(--text-muted)] min-w-[100px] text-center">
            {isCurrentWeek ? labels.thisWeek : weekLabel}
          </span>
          <button
            onClick={handleNextWeek}
            disabled={weekOffset >= 0}
            className={`p-1 rounded-full transition-colors ${
              weekOffset >= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-100'
            }`}
          >
            <HiOutlineChevronRight className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const dateKey = formatDateKey(date);
          const activity = weeklyActivity?.[dateKey];
          const questions = activity?.questionsReviewed || 0;
          const xp = activity?.xpEarned || 0;

          return (
            <div key={dateKey} className="flex flex-col items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">{DAY_LABELS[i]}</span>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${getIntensityClass(questions)}`}
                title={`${date.toLocaleDateString()}: ${questions} questions, ${xp} XP`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
        <span>{labels.less}</span>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-neutral-50 border border-neutral-100" />
          <div className="w-3 h-3 rounded-sm bg-neutral-200" />
          <div className="w-3 h-3 rounded-sm bg-neutral-400" />
          <div className="w-3 h-3 rounded-sm bg-neutral-600" />
          <div className="w-3 h-3 rounded-sm bg-neutral-900" />
        </div>
        <span>{labels.more}</span>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4">{content}</div>
    );
  }

  return (
    <Card className="rounded-2xl border-neutral-100/50 bg-white p-6 shadow-sm">{content}</Card>
  );
}
