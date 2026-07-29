'use client';

import Image from 'next/image';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import {
  imgChatGptImageApr22026At121506Am1,
  imgGroup9,
  imgBasilDocumentSolid,
  imgGroup10,
  imgPhChartLineUpFill,
} from './constants';
import { Reveal } from './Reveal';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function CoreIntelligence({ locale }: { locale: string }) {
  const reduce = useReducedMotion();
  const isVi = locale === 'vi';
  const feature = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.4 },
          transition: { duration: 0.55, delay, ease: EASE_OUT },
        };
  return (
    <LazyMotion features={domAnimation}>
      <div className="relative z-10 mx-auto flex w-full max-w-[1728px] flex-col items-center justify-between gap-16 px-4 2xl:flex-row 2xl:gap-0 2xl:px-0">
        {/* Left Content - Text & Features */}
        <div className="flex w-full shrink-0 flex-col gap-12 2xl:w-[959px] 2xl:gap-[96px]">
          {/* Header */}
          <Reveal className="flex w-full flex-col items-center gap-[20px] text-center text-white 2xl:w-[634px] 2xl:items-start 2xl:text-left">
            <h2 className="font-unbounded font-extrabold text-4xl xl:text-[48px] leading-[1.2] xl:leading-[1.4] w-full">
              <span>{isVi ? 'NỀN TẢNG ' : 'CORE '}</span>
              <span className="text-[#fd761a]">{isVi ? 'CỐT LÕI' : 'INTELLIGENCE'}</span>
            </h2>
            <p className="font-unbounded font-light text-base xl:text-[18px] leading-[1.5] text-white w-full">
              {isVi
                ? 'Các công cụ nối tài liệu nguồn với hoạt động luyện tập.'
                : 'Tools that connect source material to active practice.'}
            </p>
          </Reveal>

          {/* Features Grid */}
          <div className="flex flex-col gap-8 xl:gap-[60px] w-full">
            {/* Row 1 */}
            <div className="flex flex-col sm:flex-row gap-8 xl:gap-[64px] w-full items-start">
              {/* Feature 1 */}
              <m.div
                {...feature(0)}
                className="flex flex-1 flex-col gap-[28px] items-center sm:items-start text-center sm:text-left min-w-[300px]"
              >
                <div className="bg-[#ff541b] rounded-[100px] w-[48px] h-[48px] xl:w-[56px] xl:h-[56px] flex items-center justify-center shrink-0">
                  <div className="w-[32px] h-[32px] relative overflow-hidden">
                    <Image
                      alt="AI Path"
                      className="absolute inset-[8.33%_8.33%_0.77%_8.73%] max-w-none w-[82.94%] h-[90.9%]"
                      height={32}
                      src={imgGroup9}
                      width={32}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-[12px] w-full">
                  <h3 className="font-unbounded font-bold text-lg xl:text-[22px] text-white leading-[1.4]">
                    {isVi ? 'Lộ trình học bằng AI' : 'AI Learning Path'}
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    {isVi
                      ? 'Ưu tiên nội dung dựa trên quan hệ kiến thức và kết quả luyện tập của bạn.'
                      : 'Prioritize material using concept relationships and your practice results.'}
                  </p>
                </div>
              </m.div>

              {/* Feature 2 */}
              <m.div
                {...feature(0.1)}
                className="flex flex-1 flex-col gap-[28px] items-center sm:items-start text-center sm:text-left min-w-[300px]"
              >
                <div className="bg-[#ff541b] rounded-[100px] w-[48px] h-[48px] xl:w-[56px] xl:h-[56px] flex items-center justify-center shrink-0">
                  <div className="w-[32px] h-[32px] relative">
                    <Image
                      alt="Document Analysis"
                      className="absolute inset-0 w-full h-full max-w-none"
                      height={32}
                      src={imgBasilDocumentSolid}
                      width={32}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-[12px] w-full">
                  <h3 className="font-unbounded font-bold text-lg xl:text-[22px] text-white leading-[1.4]">
                    {isVi ? 'Phân tích PDF' : 'PDF Analysis'}
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    {isVi
                      ? 'Trích xuất khái niệm và kết nối chúng với vị trí trong tài liệu nguồn.'
                      : 'Extract concepts and connect them to locations in the source material.'}
                  </p>
                </div>
              </m.div>
            </div>

            {/* Row 2 */}
            <div className="flex flex-col sm:flex-row gap-8 xl:gap-[64px] w-full items-start">
              {/* Feature 3 */}
              <m.div
                {...feature(0.2)}
                className="flex flex-1 flex-col gap-[28px] items-center sm:items-start text-center sm:text-left min-w-[300px]"
              >
                <div className="bg-[#ff541b] rounded-[100px] w-[48px] h-[48px] xl:w-[56px] xl:h-[56px] flex items-center justify-center shrink-0">
                  <div className="w-[32px] h-[32px] relative overflow-hidden">
                    <Image
                      alt="Quiz"
                      className="absolute inset-[8.33%_8.33%_0.77%_8.33%] max-w-none w-[83.34%] h-[90.9%]"
                      height={32}
                      src={imgGroup10}
                      width={32}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-[12px] w-full">
                  <h3 className="font-unbounded font-bold text-lg xl:text-[22px] text-white leading-[1.4]">
                    {isVi ? 'Tạo quiz và phần giải thích' : 'Quiz and Explanation Generation'}
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    {isVi
                      ? 'Tạo câu hỏi luyện tập có giải thích để hỗ trợ nhớ chủ động.'
                      : 'Generate practice questions with explanations to support active recall.'}
                  </p>
                </div>
              </m.div>

              {/* Feature 4 */}
              <m.div
                {...feature(0.3)}
                className="flex flex-1 flex-col gap-[28px] items-center sm:items-start text-center sm:text-left min-w-[300px]"
              >
                <div className="bg-[#ff541b] rounded-[100px] w-[48px] h-[48px] xl:w-[56px] xl:h-[56px] flex items-center justify-center shrink-0">
                  <div className="w-[32px] h-[32px] relative">
                    <Image
                      alt="Tracking"
                      className="absolute inset-0 w-full h-full max-w-none"
                      height={32}
                      src={imgPhChartLineUpFill}
                      width={32}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-[12px] w-full">
                  <h3 className="font-unbounded font-bold text-lg xl:text-[22px] text-white leading-[1.4]">
                    {isVi ? 'Theo dõi tiến độ' : 'Progress Tracking'}
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    {isVi
                      ? 'Xem mức độ nắm vững theo khái niệm và các phần cần ôn lại.'
                      : 'See concept-level mastery and the areas that need another review.'}
                  </p>
                </div>
              </m.div>
            </div>
          </div>
        </div>

        {/* Right Content - Image */}
        <m.div
          className="flex w-full shrink-0 justify-center 2xl:w-[653px] 2xl:justify-end"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <div className="relative w-full max-w-[653px] xl:w-[653px] aspect-square xl:aspect-auto xl:h-[689px] overflow-hidden rounded-[24px] xl:rounded-none bg-transparent border-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full xl:w-[644px] h-[637px]">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <Image
                  alt={
                    isVi
                      ? 'Minh họa giao diện học tập bằng AI'
                      : 'AI learning interface illustration'
                  }
                  className="absolute max-w-none xl:w-[121%] xl:h-[122.17%] xl:-left-[11.88%] xl:-top-[11.96%] w-[120%] h-[120%] -left-[10%] -top-[10%] object-cover mix-blend-normal opacity-100"
                  height={1024}
                  src={imgChatGptImageApr22026At121506Am1}
                  width={1024}
                />
              </div>
            </div>
          </div>
        </m.div>
      </div>
    </LazyMotion>
  );
}
