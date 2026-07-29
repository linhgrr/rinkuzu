'use client';

import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import { imgGroup8 } from './constants';
import { Reveal } from './Reveal';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const DESIGN_W = 1728;
const LINE_H = 387;
const CONTENT_H = 900;

const englishCards = [
  {
    num: '1',
    title: 'Upload your PDF',
    desc: 'Simply drag and drop any educational material, from textbooks to specialized research papers.',
    pb: 56,
  },
  {
    num: '2',
    title: 'AI analyzes your content',
    desc: 'Our curator extracts core concepts, identifies difficult areas, and builds a semantic map of the text.',
    pb: 136,
  },
  {
    num: '3',
    title: 'Get a personalized roadmap',
    desc: 'Receive a step-by-step guide tailored to your current knowledge level and learning goals.',
    pb: 216,
  },
];

interface HowItWorksCardProps {
  num: string;
  title: string;
  desc: string;
  pb: number;
}

export default function HowItWorks({ locale }: { locale: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const reduce = useReducedMotion();
  const isVi = locale === 'vi';
  const cards = isVi
    ? [
        {
          num: '1',
          title: 'Tải tài liệu PDF lên',
          desc: 'Chọn bài giảng, ghi chú hoặc tài liệu mà bạn muốn luyện tập.',
          pb: 56,
        },
        {
          num: '2',
          title: 'AI phân tích nội dung',
          desc: 'RinKuzu trích xuất khái niệm, quan hệ tiên quyết và các phần cần luyện tập.',
          pb: 136,
        },
        {
          num: '3',
          title: 'Nhận bước học tiếp theo',
          desc: 'Luyện câu hỏi theo mức độ nắm vững và xem phần kiến thức nên ưu tiên.',
          pb: 216,
        },
      ]
    : englishCards;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = entry.contentRect.width;
      setScale(Math.min(w / DESIGN_W, 1));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-16 xl:gap-[128px] items-center w-full">
      {/* Title */}
      <Reveal className="flex flex-col font-unbounded font-extrabold justify-center leading-[0] relative shrink-0 text-4xl md:text-[48px] text-center text-white w-full">
        <p className="leading-[1.2] md:leading-[normal]">
          {isVi ? (
            <>
              <span>{`ĐỂ `}</span>
              <span className="text-[#fd761a]">AI XỬ LÝ</span>
              <br className="md:hidden" />
              <span className="hidden md:inline">{` `}</span>
              <span className="bg-clip-text text-transparent bg-[linear-gradient(178deg,#fff_1.3%,#999_98.7%)]">
                TÀI LIỆU
              </span>
            </>
          ) : (
            <>
              <span>{`LET `}</span>
              <span className="text-[#fd761a]">AI HANDLE</span>
              <br className="md:hidden" />
              <span className="hidden md:inline">{` `}</span>
              <span className="bg-clip-text text-transparent bg-[linear-gradient(178deg,#fff_1.3%,#999_98.7%)]">
                THE MATERIAL
              </span>
            </>
          )}
        </p>
      </Reveal>

      {/* Scaled container: line + cards scale together */}
      <div ref={containerRef} className="w-full">
        {/* Mobile layout */}
        <div className="flex flex-col gap-8 items-center px-4 xl:hidden">
          {cards.map((c, i) => (
            <Reveal key={c.num} delay={i * 0.12} className="w-full flex justify-center">
              <Card num={c.num} title={c.title} desc={c.desc} pb={56} />
            </Reveal>
          ))}
        </div>

        {/* Desktop: wrapper whose height matches the visual (scaled) size */}
        <div
          className="hidden xl:block relative overflow-visible"
          style={{ height: CONTENT_H * scale }}
        >
          <div
            className="absolute top-0 left-0 flex flex-col items-center"
            style={{
              width: DESIGN_W,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <div className="relative shrink-0 w-full" style={{ height: LINE_H }}>
              <div
                className="absolute"
                style={{ top: '-3.18%', right: '-1.23%', bottom: '-0.26%', left: '-1.23%' }}
              >
                <Image
                  alt=""
                  className="block max-w-none object-fill"
                  fill
                  sizes="1728px"
                  src={imgGroup8}
                />
              </div>
            </div>

            <div className="flex gap-[96px] items-start shrink-0">
              <LazyMotion features={domAnimation}>
                {cards.map((c, i) => (
                  <m.div
                    key={c.num}
                    initial={reduce ? false : { opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.6, delay: i * 0.2, ease: EASE_OUT }}
                  >
                    <Card {...c} />
                  </m.div>
                ))}
              </LazyMotion>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ num, title, desc, pb }: HowItWorksCardProps) {
  return (
    <div
      className="content-stretch flex flex-col gap-[22px] items-start px-[32px] relative rounded-bl-[24px] rounded-br-[24px] rounded-tr-[24px] shadow-[0px_16px_28px_0px_rgba(0,0,0,0.05)] shrink-0 w-[461px]"
      style={{ paddingTop: 56, paddingBottom: pb }}
    >
      <div
        aria-hidden="true"
        className="absolute bg-[rgba(43,43,43,0.2)] inset-0 pointer-events-none rounded-bl-[24px] rounded-br-[24px] rounded-tr-[24px] backdrop-blur-sm"
      />
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_-4px_-4px_13px_0px_rgba(253,118,26,0.6)]" />

      <div className="bg-[#ff541b] content-stretch flex items-center justify-center relative rounded-full shrink-0 size-[56px]">
        <div className="flex flex-col font-unbounded font-bold h-[24px] justify-center leading-[0] relative shrink-0 text-[22px] text-center text-white">
          <p className="leading-[1.4]">{num}</p>
        </div>
      </div>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="flex flex-col font-unbounded font-bold justify-center leading-[0] relative shrink-0 text-[22px] text-white w-full">
          <p className="leading-[1.4]">{title}</p>
        </div>
      </div>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="flex flex-col font-unbounded font-light justify-center leading-[0] relative shrink-0 text-[#ededed] text-[18px] w-full">
          <p className="leading-[1.5]">{desc}</p>
        </div>
      </div>
    </div>
  );
}
