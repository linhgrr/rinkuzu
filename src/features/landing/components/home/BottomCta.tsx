import { Link } from '@/i18n/navigation';
import { imgGroup11 } from './constants';
import { Magnetic } from './motion-primitives';

export default function BottomCta({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const uploadHref = isAuthenticated ? '/adaptive/upload' : '/register?next=/adaptive/upload';

  return (
    <div className="relative w-full bg-[#ff541b] flex flex-col gap-[32px] items-center py-[86px] px-4 md:px-8">
      <div className="flex flex-col items-center w-full text-center">
        <p className="font-unbounded font-extrabold text-3xl sm:text-4xl md:text-[48px] text-white leading-[1.2] md:leading-[1.4]">
          Start Your Learning Journey Today
        </p>
      </div>

      <div className="flex flex-col items-center w-full text-center pb-[16px]">
        <p className="font-unbounded font-light text-base md:text-[20px] text-[#ededed] leading-[1.5]">
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
            <img alt="Upload" className="block w-full h-full object-contain" src={imgGroup11} />
          </span>
          <span className="font-unbounded font-medium text-[18px] text-[#ff541b] whitespace-nowrap leading-[1.5]">
            Upload PDF
          </span>
        </Link>
      </Magnetic>
    </div>
  );
}
