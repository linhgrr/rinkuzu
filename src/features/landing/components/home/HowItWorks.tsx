'use client';

import Image from 'next/image';
import { LazyMotion, m, useReducedMotion } from 'framer-motion';
import { loadMotionFeatures } from './motion-features';
import { imgGroup8 } from './constants';
import { Reveal } from './Reveal';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const englishCards = [
  {
    num: '1',
    title: 'Upload your PDF',
    desc: 'Simply drag and drop any educational material, from textbooks to specialized research papers.',
  },
  {
    num: '2',
    title: 'AI analyzes your content',
    desc: 'Our curator extracts core concepts, identifies difficult areas, and builds a semantic map of the text.',
  },
  {
    num: '3',
    title: 'Get a personalized roadmap',
    desc: 'Receive a step-by-step guide tailored to your current knowledge level and learning goals.',
  },
];

interface HowItWorksCardProps {
  num: string;
  title: string;
  desc: string;
}

export default function HowItWorks({ locale }: { locale: string }) {
  const reduce = useReducedMotion();
  const isVi = locale === 'vi';
  const cards = isVi
    ? [
        {
          num: '1',
          title: 'Tải tài liệu PDF lên',
          desc: 'Chọn bài giảng, ghi chú hoặc tài liệu mà bạn muốn luyện tập.',
        },
        {
          num: '2',
          title: 'AI phân tích nội dung',
          desc: 'RinKuzu trích xuất khái niệm, quan hệ tiên quyết và các phần cần luyện tập.',
        },
        {
          num: '3',
          title: 'Nhận bước học tiếp theo',
          desc: 'Luyện câu hỏi theo mức độ nắm vững và xem phần kiến thức nên ưu tiên.',
        },
      ]
    : englishCards;

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

      <div className="w-full px-4 xl:px-0">
        <div aria-hidden="true" className="relative hidden h-64 w-full xl:block 2xl:h-96">
          <Image
            alt=""
            aria-hidden="true"
            className="block object-fill"
            fill
            sizes="(min-width: 1536px) 1728px, 100vw"
            src={imgGroup8}
          />
        </div>

        <div className="grid w-full grid-cols-1 items-start gap-8 xl:grid-cols-3 2xl:gap-24">
          <LazyMotion features={loadMotionFeatures}>
            {cards.map((c, i) => (
              <m.div
                key={c.num}
                className="flex w-full justify-center"
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
  );
}

function Card({ num, title, desc }: HowItWorksCardProps) {
  return (
    <div className="relative flex w-full max-w-md shrink-0 flex-col content-stretch items-start gap-[22px] rounded-bl-[24px] rounded-br-[24px] rounded-tr-[24px] px-[32px] py-14 shadow-[0px_16px_28px_0px_rgba(0,0,0,0.05)] xl:max-w-none">
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
