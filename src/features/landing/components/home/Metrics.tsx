'use client';

import Image from 'next/image';
import { imgVector14 } from './constants';
import { Reveal } from './Reveal';

export default function Metrics({ locale }: { locale: string }) {
  const isVi = locale === 'vi';
  return (
    <div className="relative w-full xl:w-[1081px] flex flex-col md:flex-row items-center md:items-start justify-between p-[32px] rounded-[20px] shadow-[0px_16px_28px_0px_rgba(0,0,0,0.05)] z-10 gap-8 md:gap-0">
      <div
        aria-hidden="true"
        className="absolute bg-[rgba(43,43,43,0.2)] inset-0 pointer-events-none rounded-[20px]"
      />

      <Reveal className="content-stretch flex flex-col gap-[12px] items-center md:items-start text-center md:text-left leading-[0] relative shrink-0 text-white w-full md:w-[307px]">
        <div className="flex flex-col font-unbounded font-semibold justify-center relative shrink-0 text-3xl md:text-[40px] w-full">
          <p className="leading-[1.4]">PDF</p>
        </div>
        <div className="flex flex-col font-unbounded font-light justify-center relative shrink-0 text-base md:text-[20px] w-full">
          <p className="leading-[1.5]">
            {isVi ? 'Bắt đầu từ tài liệu nguồn' : 'Start from source material'}
          </p>
        </div>
      </Reveal>

      <div className="hidden md:block h-[128px] relative shrink-0 w-0">
        <div className="absolute inset-[-0.78%_-1px]">
          <Image
            alt=""
            aria-hidden="true"
            className="block max-w-none object-fill"
            fill
            sizes="2px"
            src={imgVector14}
          />
        </div>
      </div>

      {/* Mobile divider */}
      <div className="md:hidden w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#fd761a] to-transparent opacity-50" />

      <Reveal
        delay={0.12}
        className="content-stretch flex flex-col gap-[12px] items-center md:items-start text-center md:text-left leading-[0] relative shrink-0 text-white w-full md:w-[282px]"
      >
        <div className="flex flex-col font-unbounded font-semibold justify-center relative shrink-0 text-3xl md:text-[40px] w-full">
          <p className="leading-[1.4]">6</p>
        </div>
        <div className="flex flex-col font-unbounded font-light justify-center relative shrink-0 text-base md:text-[20px] w-full">
          <p className="leading-[1.5]">
            {isVi ? 'Cấp độ nhận thức Bloom' : "Bloom's cognitive levels"}
          </p>
        </div>
      </Reveal>

      <div className="hidden md:block h-[128px] relative shrink-0 w-0">
        <div className="absolute inset-[-0.78%_-1px]">
          <Image
            alt=""
            aria-hidden="true"
            className="block max-w-none object-fill"
            fill
            sizes="2px"
            src={imgVector14}
          />
        </div>
      </div>

      {/* Mobile divider */}
      <div className="md:hidden w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#fd761a] to-transparent opacity-50" />

      <Reveal
        delay={0.24}
        className="content-stretch flex flex-col gap-[12px] items-center md:items-start text-center md:text-left leading-[0] relative shrink-0 text-white w-full md:w-[285px]"
      >
        <div className="flex flex-col font-unbounded font-semibold justify-center relative shrink-0 text-3xl md:text-[40px] w-full">
          <p className="leading-[1.4]">{isVi ? 'Tiếp' : 'Next'}</p>
        </div>
        <div className="flex flex-col font-unbounded font-light justify-center relative shrink-0 text-base md:text-[20px] w-full">
          <p className="leading-[1.5]">
            {isVi ? 'Gợi ý từ điểm kiến thức yếu' : 'Guidance from weak areas'}
          </p>
        </div>
      </Reveal>

      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_-3px_-1px_13px_0px_#fd761a]" />
    </div>
  );
}
