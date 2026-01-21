'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function IntroVideo() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start end', 'end start'],
    });

    // Scale from 0.8 to 1.1 when in center, then back to 0.8
    const scale = useTransform(
        scrollYProgress,
        [0, 0.5, 1],
        [0.8, 1.1, 0.8]
    );

    // Opacity fade in/out
    const opacity = useTransform(
        scrollYProgress,
        [0, 0.2, 0.8, 1],
        [0, 1, 1, 0]
    );

    // Smooth rotation for a "dynamic" feel
    const rotateX = useTransform(
        scrollYProgress,
        [0, 0.5, 1],
        [5, 0, -5]
    );

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-6xl mx-auto px-4 py-24 perspective-1000"
        >
            <motion.div
                style={{
                    scale,
                    opacity,
                    rotateX,
                }}
                className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-black/5 backdrop-blur-sm"
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
            </motion.div>
        </div>
    );
}
