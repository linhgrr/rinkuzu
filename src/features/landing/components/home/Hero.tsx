import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { imgCharacterImg, imgGroup } from './constants';
import { Magnetic } from './Magnetic';

interface HeroProps {
  isAuthenticated?: boolean;
  locale: string;
}

export default function Hero({ isAuthenticated = false, locale }: HeroProps) {
  const uploadHref = isAuthenticated ? '/adaptive/upload' : '/register?next=/adaptive/upload';
  const demoHref = isAuthenticated ? '/adaptive' : '/register?next=/adaptive';
  const isVi = locale === 'vi';

  return (
    <div className="relative w-full max-w-[1920px] mx-auto min-h-[90vh] xl:h-[1080px] flex flex-col xl:flex-row items-center xl:items-start justify-between mt-4 xl:mt-0">
      {/* Left Content */}
      <div className="z-10 flex w-full flex-none flex-col px-4 xl:px-0 min-[1800px]:w-auto">
        {/* Main Title - Responsive text sizing */}
        <div className="mt-24 w-full xl:mt-[254px] min-[1800px]:w-[1090px]">
          <h1
            className="font-system text-left text-[70px] leading-[0.9] text-[#e9d8d6] sm:text-[90px] md:text-[120px] xl:font-vina-sans xl:text-[144px] min-[1800px]:text-[164px]"
            style={{ filter: 'drop-shadow(4px 4px 0px #542607)' }}
          >
            {isVi ? 'TẠO QUIZ AI TỪ PDF' : 'AI QUIZ GENERATOR FROM PDF'}
          </h1>
        </div>

        {/* Subtitle & CTA */}
        <div className="mt-8 flex w-full flex-col gap-[36px] xl:mt-[72px] xl:w-[820px] min-[1800px]:w-[958px]">
          <p className="font-unbounded font-light text-base sm:text-lg xl:text-[20px] leading-[1.5] text-white">
            {isVi
              ? 'Biến PDF thành câu hỏi luyện tập bằng AI, kết nối khái niệm trong đồ thị kiến thức, nhìn rõ phần còn yếu và biết nên học gì tiếp theo.'
              : 'Use RinKuzu as an AI quiz generator from PDF: create practice questions, connect concepts in a knowledge graph, and see what to study next.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-[16px] items-start sm:items-center">
            <Magnetic className="w-full sm:w-auto">
              <Link
                href={demoHref}
                className="border border-[#ff541b] flex h-[56px] items-center justify-center px-[32px] rounded-[100px] hover:bg-[#ff541b]/20 transition-[colors,transform] active:scale-[0.97] w-full sm:w-auto"
              >
                <span className="font-unbounded font-medium text-[18px] text-white whitespace-nowrap">
                  {isVi ? 'Học thử' : 'Try Demo'}
                </span>
              </Link>
            </Magnetic>
            <Magnetic className="w-full sm:w-auto">
              <Link
                href={uploadHref}
                className="bg-[#ff541b] flex gap-[10px] h-[56px] items-center justify-center px-[32px] rounded-[100px] hover:bg-[#fd761a] transition-[colors,transform] active:scale-[0.97] w-full sm:w-auto shadow-lg shadow-[#ff541b]/20"
              >
                <span className="size-[28px] relative flex items-center justify-center overflow-hidden">
                  <Image
                    alt="Upload"
                    className="absolute inset-[12.5%_20.83%_12.5%_20.84%] max-w-none w-[66.6%] h-[66.6%]"
                    height={28}
                    src={imgGroup}
                    width={28}
                  />
                </span>
                <span className="whitespace-nowrap font-unbounded text-[19px] font-bold text-white">
                  {isVi ? 'Tải PDF lên' : 'Upload PDF'}
                </span>
              </Link>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* Right Content - 3D Character */}
      <div className="pointer-events-none z-10 hidden flex-none items-center justify-center min-[1800px]:absolute min-[1800px]:-right-[20px] min-[1800px]:top-[80px] min-[1800px]:flex min-[1800px]:w-[527px]">
        <div className="relative h-[1084px] w-[527px] scale-x-[-1]">
          <div className="absolute inset-0">
            <Image
              alt={isVi ? 'Nhân vật trợ lý AI' : 'AI assistant character'}
              className="absolute inset-0 w-full h-full object-cover drop-shadow-2xl"
              fill
              sizes="(min-width: 1280px) 527px, 100vw"
              src={imgCharacterImg}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
