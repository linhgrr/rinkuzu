'use client';

import { memo } from 'react';

interface LevelBadgeProps {
    level: number;
    className?: string;
}

export const LevelBadge = memo(function LevelBadge({ level, className = "" }: LevelBadgeProps) {
    return (
        <div className={`relative inline-block ${className}`}>
            <svg
                width="100"
                height="85"
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

                {/* Main Circle */}
                <circle cx="60" cy="45" r="32" fill="#B45309" />
                <circle cx="60" cy="45" r="30" fill="url(#goldGradient)" stroke="#FEF3C7" strokeWidth="2" />
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
                <text
                    x="60"
                    y="79"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="bold"
                    letterSpacing="1"
                >
                    LEVEL
                </text>
            </svg>
        </div>
    );
});
