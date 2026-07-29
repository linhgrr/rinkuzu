import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { imgGroup11 } from './constants';
import { Magnetic } from './Magnetic';

interface BottomCtaProps {
  isAuthenticated?: boolean;
  locale: string;
}

export default function BottomCta({ isAuthenticated = false, locale }: BottomCtaProps) {
  const uploadHref = isAuthenticated ? '/adaptive/upload' : '/register?next=/adaptive/upload';
  const isVi = locale === 'vi';

  return (
    <div className="relative w-full bg-[#ff541b] flex flex-col gap-[32px] items-center py-[86px] px-4 md:px-8">
      <div className="flex flex-col items-center w-full text-center">
        <p className="max-w-[1100px] font-unbounded text-3xl font-extrabold leading-[1.2] text-white sm:text-4xl md:text-[44px] md:leading-[1.3] xl:text-[48px]">
          {isVi ? 'Bắt đầu từ tài liệu bạn đang học' : 'Start with the Material You Are Studying'}
        </p>
      </div>

      <div className="flex flex-col items-center w-full text-center pb-[16px]">
        <p className="font-unbounded text-[19px] font-bold leading-[1.5] text-white md:text-[20px]">
          {isVi
            ? 'Biến nội dung trong PDF thành câu hỏi luyện tập có cấu trúc.'
            : 'Turn PDF content into structured practice questions.'}
          <br className="hidden sm:block" />
          {isVi
            ? 'Theo dõi phần kiến thức còn yếu và nhận gợi ý cho bước tiếp theo.'
            : 'Track weak areas and get a suggestion for the next step.'}
          <br className="hidden sm:block" />
          {isVi ? 'Bắt đầu bằng cách tải một file PDF lên.' : 'Start by uploading a PDF.'}
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
            {isVi ? 'Tải PDF lên' : 'Upload PDF'}
          </span>
        </Link>
      </Magnetic>
    </div>
  );
}
