import Image from 'next/image';

import { toBrowserPath } from '@/lib/routing/pathname';
import { imgGroup11 } from './constants';

interface BottomCtaProps {
  locale: string;
  isAuthenticated?: boolean;
}

export default function BottomCta({ locale, isAuthenticated = false }: BottomCtaProps) {
  const uploadHref = toBrowserPath(
    isAuthenticated ? '/adaptive/upload' : '/register?next=/adaptive/upload',
    locale,
  );

  return (
    <div className="relative w-full bg-accent flex flex-col gap-[32px] items-center py-[86px] px-4 md:px-8">
      <div className="flex flex-col items-center w-full text-center">
        <p className="font-unbounded font-extrabold text-3xl sm:text-4xl md:text-[48px] text-[#06090e] leading-[1.2] md:leading-[1.4]">
          Start Your Learning Journey Today
        </p>
      </div>

      <div className="flex flex-col items-center w-full text-center pb-[16px]">
        <p className="font-unbounded font-light text-base md:text-[20px] text-[#06090e] leading-[1.5]">
          Turn hours of reading into minutes of understanding.
          <br className="hidden sm:block" />
          Our AI breaks down complex documents into simple, actionable steps.
          <br className="hidden sm:block" />
          All you need to do is start.
        </p>
      </div>

      <a
        href={uploadHref}
        className="bg-white flex gap-[10px] h-[56px] items-center justify-center px-[32px] rounded-[100px] hover:bg-gray-50 transition-[colors,transform] active:scale-[0.97]"
      >
        <span className="relative shrink-0 size-[28px] overflow-hidden">
          <Image
            alt="Upload"
            className="block w-full h-full object-contain"
            height={28}
            src={imgGroup11}
            width={28}
          />
        </span>
        <span className="font-unbounded font-medium text-[18px] text-[#06090e] whitespace-nowrap leading-[1.5]">
          Upload PDF
        </span>
      </a>
    </div>
  );
}
