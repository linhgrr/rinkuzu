'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { imgBackground, imgFrame33 } from './constants';

const testimonials = [
  {
    name: 'Sarah Jenkins',
    role: 'Medical Student',
    text: '"The PDF analysis is mind-blowing. It turned my 200-page thesis prep into a manageable 10-day roadmap."',
  },
  {
    name: 'David Chen',
    role: 'Software Engineer',
    text: '"I used to spend hours figuring out what to learn next. Now, I just upload the docs and follow the path."',
  },
  {
    name: 'Emma Watson',
    role: 'Law Student',
    text: '"The progress tracking keeps me motivated. It\'s like having a personal tutor available 24/7."',
  },
  {
    name: 'Michael Ross',
    role: 'Data Scientist',
    text: '"Quizzes generated from my own materials? Absolute game-changer for active recall."',
  },
  {
    name: 'Sophia Lee',
    role: 'MBA Candidate',
    text: '"The way it breaks down complex case studies into digestible milestones is incredible."',
  },
];

const COUNT = testimonials.length;
const SCALE_MAX = 1.08;
const SCALE_MIN = 0.82;
const OPACITY_MAX = 1;
const OPACITY_MIN = 0.3;
const WAVE_RADIUS = 2.2;

function wave(dist: number): number {
  const t = Math.min(dist / WAVE_RADIUS, 1);
  return (1 + Math.cos(t * Math.PI)) / 2;
}

export default function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'center', skipSnaps: false, dragFree: true },
    [AutoScroll({ speed: 0.5, stopOnInteraction: false, stopOnMouseEnter: true })],
  );

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!emblaApi) return;

    const recalc = () => {
      const scrollProgress = emblaApi.scrollProgress();
      const snaps = emblaApi.scrollSnapList();

      for (let i = 0; i < COUNT; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;

        const snap = snaps[i];
        if (snap === undefined) continue;
        let diff = snap - scrollProgress;
        if (diff > 0.5) diff -= 1;
        if (diff < -0.5) diff += 1;
        const dist = Math.abs(diff) * COUNT;

        const w = wave(dist);
        const s = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * w;
        const o = OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * w;

        el.style.transform = `scale(${s})`;
        el.style.opacity = `${o}`;
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalc);
    };
    emblaApi.on('scroll', onScroll);
    emblaApi.on('reInit', recalc);
    recalc();
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [emblaApi]);

  return (
    <div className="relative w-full flex flex-col gap-12 md:gap-[112px] items-center z-10">
      {/* Header */}
      <div className="flex flex-col gap-6 md:gap-[44px] items-center text-center text-white w-full max-w-[1182px] mx-auto px-4">
        <h2 className="font-unbounded font-extrabold text-3xl sm:text-4xl md:text-[48px] leading-[1.2] md:leading-[1.4]">
          <span className="text-[#fd761a]">TRUSTED</span>
          <span>{` BY `}</span>
          <span className="text-[#fd761a]">10.000+</span>
          <span>{` `}</span>
          <span className="bg-clip-text text-transparent bg-[linear-gradient(177deg,#fff_1.3%,#999_98.7%)]">
            LEARNERS
          </span>
        </h2>
        <p className="font-unbounded font-light text-base md:text-[20px] leading-[1.5] text-white">
          Turn overwhelming documents into structured, easy-to-follow learning paths. Our AI
          analyzes your PDFs and breaks them down into clear, actionable steps. Save hours of effort
          and focus on what truly matters — learning effectively. Join thousands of learners already
          studying smarter, not harder.
        </p>
      </div>

      {/* Carousel */}
      <div className="w-[100vw] relative left-1/2 -translate-x-1/2">
        <div className="overflow-hidden py-16" ref={emblaRef}>
          <div className="flex items-center">
            {testimonials.map((item, i) => (
              <div
                key={item.name}
                className="flex-[0_0_85%] sm:flex-[0_0_42%] md:flex-[0_0_33%] lg:flex-[0_0_30%] min-w-0 px-[24px]"
              >
                <div
                  ref={(el) => {
                    slideRefs.current[i] = el;
                  }}
                  className="flex flex-col gap-[22px] items-start px-[32px] py-[72px] rounded-[24px] shadow-[0px_16px_28px_0px_rgba(0,0,0,0.05)] relative origin-center will-change-[transform,opacity]"
                >
                  <div
                    aria-hidden="true"
                    className="absolute bg-[rgba(43,43,43,0.2)] inset-0 pointer-events-none rounded-[24px] backdrop-blur-sm"
                  />
                  <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_-4px_-4px_13px_0px_rgba(253,118,26,0.6)]" />

                  <div className="relative z-10 flex w-full shrink-0 items-center gap-[16px]">
                    <div className="relative size-[60px] shrink-0 overflow-hidden rounded-full">
                      <Image
                        alt={item.name}
                        fill
                        sizes="60px"
                        className="pointer-events-none rounded-full object-cover"
                        src={imgBackground}
                        unoptimized
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-[4px]">
                      <p className="font-unbounded text-[22px] leading-[1.4] font-bold text-white">
                        {item.name}
                      </p>
                      <p className="font-unbounded text-[18px] leading-[1.5] font-light text-[#ededed]">
                        {item.role}
                      </p>
                    </div>
                  </div>

                  <div className="relative z-10 h-[28px] w-[204px] shrink-0">
                    <Image
                      alt=""
                      fill
                      sizes="204px"
                      className="object-contain"
                      src={imgFrame33}
                      unoptimized
                      aria-hidden="true"
                    />
                  </div>

                  <div className="w-full relative z-10">
                    <p className="font-unbounded font-light text-[18px] text-[#ededed] leading-[1.5]">
                      {item.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
