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
                height="100"
                viewBox="0 0 120 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-lg"
            >
                <defs>
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFD700" />
                        <stop offset="50%" stopColor="#FFA500" />
                        <stop offset="100%" stopColor="#FF8C00" />
                    </linearGradient>
                    <linearGradient id="wingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFE4B5" />
                        <stop offset="100%" stopColor="#FFB347" />
                    </linearGradient>
                    <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#6B21A8" />
                        <stop offset="100%" stopColor="#4C1D95" />
                    </linearGradient>
                    <filter id="innerShadow">
                        <feOffset dx="0" dy="2" />
                        <feGaussianBlur stdDeviation="2" result="offset-blur" />
                        <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                        <feFlood floodColor="black" floodOpacity="0.3" result="color" />
                        <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                        <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                    </filter>
                </defs>

                {/* Wings - Left */}
                <g transform="translate(15, 20) scale(0.8)">
                    <path
                        d="M10 20C-5 10 5 0 20 5C25 -5 40 0 35 15C45 10 55 20 40 30"
                        fill="url(#wingGradient)"
                        stroke="#D97706"
                        strokeWidth="1.5"
                    />
                    <circle cx="28" cy="18" r="4" fill="#FF7E5F" stroke="#B45309" strokeWidth="1" />
                </g>

                {/* Wings - Right */}
                <g transform="translate(105, 20) scale(-0.8, 0.8)">
                    <path
                        d="M10 20C-5 10 5 0 20 5C25 -5 40 0 35 15C45 10 55 20 40 30"
                        fill="url(#wingGradient)"
                        stroke="#D97706"
                        strokeWidth="1.5"
                    />
                    <circle cx="28" cy="18" r="4" fill="#FF7E5F" stroke="#B45309" strokeWidth="1" />
                </g>

                {/* Main Circle - Outer Rim */}
                <circle cx="60" cy="45" r="32" fill="#B45309" />
                <circle cx="60" cy="45" r="30" fill="url(#goldGradient)" stroke="#FEF3C7" strokeWidth="2" />

                {/* Main Circle - Inner Highlight */}
                <circle cx="60" cy="42" r="24" fill="#FFEDD5" fillOpacity="0.4" />

                {/* Level Text */}
                <text
                    x="60"
                    y="54"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="28"
                    fontWeight="900"
                    style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))', fontFamily: 'sans-serif' }}
                >
                    {level}
                </text>

                {/* Ribbon */}
                <path
                    d="M25 65 L95 65 L100 85 L20 85 Z"
                    fill="url(#ribbonGradient)"
                    stroke="#2E1065"
                    strokeWidth="1"
                />
                <path d="M20 85 L15 92 L25 92 L30 85 Z" fill="#4C1D95" />
                <path d="M100 85 L105 92 L95 92 L90 85 Z" fill="#4C1D95" />

                <text
                    x="60"
                    y="79"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="bold"
                    letterSpacing="1"
                >
                    {t('level').toUpperCase()}
                </text>
            </svg>
        </div>
    );
});
