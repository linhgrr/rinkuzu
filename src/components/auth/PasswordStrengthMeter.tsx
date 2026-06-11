'use client';

import { useTranslations } from 'next-intl';

import type { PasswordStrength } from '@/lib/validation/auth';

const STRENGTH_LABEL_KEYS: Record<PasswordStrength, string> = {
  0: 'strengthWeak',
  1: 'strengthWeak',
  2: 'strengthFair',
  3: 'strengthGood',
  4: 'strengthStrong',
};

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  0: 'bg-red-500',
  1: 'bg-red-500',
  2: 'bg-yellow-500',
  3: 'bg-accent',
  4: 'bg-green-500',
};

interface PasswordStrengthMeterProps {
  score: PasswordStrength;
  id?: string;
}

export function PasswordStrengthMeter({ score, id }: PasswordStrengthMeterProps) {
  const t = useTranslations('auth');
  return (
    <div id={id} className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-progress-track">
        <div
          className={`h-full transition-all ${STRENGTH_COLOR[score]}`}
          style={{ width: `${(score / 4) * 100}%` }}
        />
      </div>
      <span className="text-xs font-medium text-ink-muted">{t(STRENGTH_LABEL_KEYS[score])}</span>
    </div>
  );
}
