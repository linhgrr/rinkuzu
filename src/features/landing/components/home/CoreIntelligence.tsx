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

export default function CoreIntelligence() {
  const reduce = useReducedMotion();
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
      <div className="relative w-full max-w-[1728px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-16 xl:gap-0 z-10 px-4 xl:px-0">
        {/* Left Content - Text & Features */}
        <div className="flex flex-col gap-12 xl:gap-[96px] w-full xl:w-[959px] shrink-0">
          {/* Header */}
          <Reveal className="flex flex-col gap-[20px] items-center xl:items-start text-center xl:text-left text-white w-full xl:w-[634px]">
            <h2 className="font-unbounded font-extrabold text-4xl xl:text-[48px] leading-[1.2] xl:leading-[1.4] w-full">
              <span>{`CORE `}</span>
              <span className="text-[#fd761a]">INTELLIGENCE</span>
            </h2>
            <p className="font-unbounded font-light text-base xl:text-[18px] leading-[1.5] text-white w-full">
              Sophisticated tools designed for the modern scholar.
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
                    AI Learning Path
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    Custom milestones based on document complexity and your unique learning speed.
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
                    Smart PDF Analysis
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    Custom milestones based on document complexity and your unique learning speed.
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
                    Auto quizz and summary
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    Custom milestones based on document complexity and your unique learning speed.
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
                    Progress tracking
                  </h3>
                  <p className="font-unbounded font-light text-sm xl:text-[18px] text-[#ededed] leading-[1.5]">
                    Custom milestones based on document complexity and your unique learning speed.
                  </p>
                </div>
              </m.div>
            </div>
          </div>
        </div>

        {/* Right Content - Image */}
        <m.div
          className="w-full xl:w-[653px] flex justify-center xl:justify-end shrink-0"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <div className="relative w-full max-w-[653px] xl:w-[653px] aspect-square xl:aspect-auto xl:h-[689px] overflow-hidden rounded-[24px] xl:rounded-none bg-transparent border-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full xl:w-[644px] h-[637px]">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <Image
                  alt="AI Interface Illustration"
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
