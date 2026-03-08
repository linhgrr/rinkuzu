'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';

interface LevelBadgeProps {
    level: number;
    className?: string;
}

export const LevelBadge = memo(function LevelBadge({ level, className = "" }: LevelBadgeProps) {
    const t = useTranslations('dashboard');
    return (
        <div className={`relative inline-block ${className}`}>
            <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="filter drop-shadow-sm"
            >
                <defs>
                    <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1E293B" />
                        <stop offset="100%" stopColor="#0F172A" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Outer Ring */}
                <circle cx="60" cy="60" r="54" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />

                {/* Middle Ring */}
                <circle cx="60" cy="60" r="48" fill="white" stroke="#F1F5F9" strokeWidth="8" shadow-sm="true" />

                {/* Inner Badge */}
                <circle cx="60" cy="60" r="36" fill="url(#badgeGradient)" />

                {/* Shine effect */}
                <path d="M40 40Q60 30 80 40" stroke="white" strokeWidth="2" strokeOpacity="0.1" fill="none" strokeLinecap="round" />

                {/* Level Number */}
                <text
                    x="60"
                    y="68"
                    textAnchor="middle"
                    fill="white"
                    fontSize="32"
                    fontWeight="800"
                    style={{ fontFamily: 'var(--font-sans), sans-serif', letterSpacing: '-0.02em' }}
                >
                    {level}
                </text>

                {/* Label label */}
                <circle cx="60" cy="104" r="14" fill="white" stroke="#E2E8F0" strokeWidth="1" />
                <text
                    x="60"
                    y="108"
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="8"
                    fontWeight="bold"
                    letterSpacing="0.1em"
                    className="uppercase"
                >
                    LVL
                </text>
            </svg>
        </div>
    );
});
