'use client';

import { useEffect, useRef, useState } from 'react';

type IntroVideoStyle = {
    opacity: number;
    scale: number;
    rotateX: number;
};

const DEFAULT_STYLE: IntroVideoStyle = {
    opacity: 1,
    scale: 1,
    rotateX: 0,
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function IntroVideo() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [videoStyle, setVideoStyle] = useState<IntroVideoStyle>(DEFAULT_STYLE);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => {
            setPrefersReducedMotion(media.matches);
        };

        update();
        media.addEventListener('change', update);
        return () => {
            media.removeEventListener('change', update);
        };
    }, []);

    useEffect(() => {
        if (prefersReducedMotion) {
            setVideoStyle(DEFAULT_STYLE);
            return;
        }

        let rafId = 0;

        const updateFrame = () => {
            rafId = 0;
            const container = containerRef.current;
            if (!container) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const viewportHeight = window.innerHeight || 1;
            const progress = clamp(
                (viewportHeight - rect.top) / (viewportHeight + rect.height),
                0,
                1
            );

            const scale =
                progress <= 0.5
                    ? 0.8 + (progress / 0.5) * 0.3
                    : 1.1 - ((progress - 0.5) / 0.5) * 0.3;

            const opacity =
                progress < 0.2
                    ? progress / 0.2
                    : progress > 0.8
                        ? (1 - progress) / 0.2
                        : 1;

            const rotateX = 5 - progress * 10;

            setVideoStyle({
                scale,
                opacity: clamp(opacity, 0, 1),
                rotateX,
            });
        };

        const requestFrameUpdate = () => {
            if (rafId === 0) {
                rafId = window.requestAnimationFrame(updateFrame);
            }
        };

        requestFrameUpdate();
        window.addEventListener('scroll', requestFrameUpdate, { passive: true });
        window.addEventListener('resize', requestFrameUpdate);

        return () => {
            window.removeEventListener('scroll', requestFrameUpdate);
            window.removeEventListener('resize', requestFrameUpdate);
            if (rafId !== 0) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [prefersReducedMotion]);

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-6xl mx-auto px-4 py-8 md:py-24 perspective-1000"
        >
            <div
                style={{
                    opacity: videoStyle.opacity,
                    transform: `scale(${videoStyle.scale}) rotateX(${videoStyle.rotateX}deg)`,
                    transformStyle: 'preserve-3d',
                }}
                className="relative aspect-video rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-black/5 backdrop-blur-sm will-change-transform"
            >
                <iframe
                    className="w-full h-full object-cover"
                    src="https://www.youtube.com/embed/Zhs8lK9z8Gw?autoplay=1&mute=1&loop=1&playlist=Zhs8lK9z8Gw&controls=0&modestbranding=1&rel=0&showinfo=0"
                    title="Introduction Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>

                {/* Apple-style Overlay Gradient */}
                <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-3xl"></div>
            </div>
        </div>
    );
}
