import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { imgGroup11 } from './constants';
import { Magnetic } from './Magnetic';

interface BottomCtaProps {
  isAuthenticated?: boolean;
}

export default function BottomCta({ isAuthenticated = false }: BottomCtaProps) {
  const uploadHref = isAuthenticated ? '/adaptive/upload' : '/register?next=/adaptive/upload';

  return (
    <div className="relative w-full bg-[#ff541b] flex flex-col gap-[32px] items-center py-[86px] px-4 md:px-8">
      <div className="flex flex-col items-center w-full text-center">
        <p className="font-unbounded font-extrabold text-3xl sm:text-4xl md:text-[48px] text-white leading-[1.2] md:leading-[1.4]">
          Start Your Learning Journey Today
        </p>
      </div>

      <div className="flex flex-col items-center w-full text-center pb-[16px]">
        <p className="font-unbounded text-[19px] font-bold leading-[1.5] text-white md:text-[20px]">
          Turn hours of reading into minutes of understanding.
          <br className="hidden sm:block" />
          Our AI breaks down complex documents into simple, actionable steps.
          <br className="hidden sm:block" />
          All you need to do is start.
        </p>
      </div>

      <Magnetic>
        <Link
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
          <span className="whitespace-nowrap font-unbounded text-[18px] font-semibold leading-[1.5] text-[#542607]">
            Upload PDF
          </span>
        </Link>
      </Magnetic>
    </div>
  );
}
