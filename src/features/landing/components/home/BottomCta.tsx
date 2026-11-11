import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
import { imgGroup11 } from './constants';
import { LandingCtaLink } from './LandingCtaLink';

interface BottomCtaProps {
  isAuthenticated?: boolean;
  locale: string;
}

function UploadCta({ isVi }: { isVi: boolean }) {
  return (
    <Link
      href="/adaptive/upload"
      className="bg-white flex gap-[10px] h-[56px] items-center justify-center px-[32px] rounded-[100px] hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff541b]"
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
  );
}

/** Signed-out bottom CTAs (RIN-1178): the play-first starter quiz first, upload second. */
function GuestBottomCtas({ locale }: { locale: string }) {
  const isVi = locale === 'vi';
  return (
    <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
      <LandingCtaLink
        href={ROUTES.TRY}
        cta="play_first"
        position="bottom"
        locale={locale}
        className="flex min-h-[56px] w-full items-center justify-center rounded-[100px] bg-white px-6 py-3 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff541b] sm:w-auto sm:px-[32px]"
      >
        <span className="text-balance text-center font-unbounded text-[16px] font-semibold leading-[1.35] text-[#542607] sm:text-[18px]">
          {isVi ? 'Làm thử quiz 2 phút, không cần tài khoản' : 'Try a 2-minute quiz, no account'}
        </span>
      </LandingCtaLink>
      <LandingCtaLink
        href="/register?next=/adaptive/upload"
        cta="upload"
        position="bottom"
        locale={locale}
        className="flex min-h-[56px] w-full items-center justify-center rounded-[100px] border border-white bg-brand-action-strong px-6 py-3 transition-colors hover:bg-brand-action-strong-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff541b] sm:w-auto sm:px-[32px]"
      >
        <span className="font-unbounded text-[18px] font-semibold text-white">
          {isVi ? 'Tải PDF lên' : 'Upload PDF'}
        </span>
      </LandingCtaLink>
    </div>
  );
}

export default function BottomCta({ isAuthenticated = false, locale }: BottomCtaProps) {
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

      {isAuthenticated ? <UploadCta isVi={isVi} /> : <GuestBottomCtas locale={locale} />}
    </div>
  );
}
