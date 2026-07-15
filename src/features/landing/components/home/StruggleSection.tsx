import Image from 'next/image';
import { imgGroup1, imgSolarDocumentAddBold, imgTablerClockFilled } from './constants';
import { Reveal } from './Reveal';

export default function StruggleSection() {
  return (
    <div className="relative w-full max-w-[1303px] mx-auto flex flex-col gap-16 md:gap-[128px] items-center z-10 px-4 md:px-0">
      {/* Title */}
      <Reveal className="font-unbounded font-extrabold text-center text-white w-full">
        <h2 className="text-3xl sm:text-4xl md:text-[48px] leading-[1.4]">
          <span className="text-accent">STRUGGLING</span>
          <span>{` `}</span>
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-[#999999]">
            TO
          </span>
          <span>{` `}</span>
          <span className="text-accent">STUDY</span>
          <span>{` `}</span>
          <span>EFFECTIVELY ?</span>
        </h2>
      </Reveal>

      {/* Cards Container */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end justify-center w-full gap-6 md:gap-0">
        {/* Card 1 */}
        <div className="flex flex-col gap-4 md:gap-[22px] p-6 md:px-[32px] md:py-[56px] rounded-2xl md:rounded-l-[24px] md:rounded-tr-none w-full md:w-[461px] bg-[rgba(43,43,43,0.2)] backdrop-blur-sm border border-white/5 relative group motion-safe:transition-transform motion-safe:hover:-translate-y-2">
          <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_2px_-4px_13px_0px_rgba(253,118,26,0.6)]" />

          <div className="bg-white rounded-full w-12 h-12 md:w-[56px] md:h-[56px] flex items-center justify-center shadow-lg relative z-10">
            <Image
              alt="Question"
              className="w-6 h-6 md:w-[32px] md:h-[32px] object-contain"
              height={32}
              src={imgGroup1}
              width={32}
            />
          </div>

          <div className="w-full relative z-10 mt-2">
            <h3 className="font-unbounded font-bold text-xl md:text-[22px] text-white leading-[1.4]">
              You don’t know what to learn first
            </h3>
          </div>

          <div className="w-full relative z-10">
            <p className="font-unbounded font-light text-base md:text-[18px] text-gray-300 leading-[1.5]">
              Inefficient studying by focusing on low-priority details instead of the core
              conceptual framework.
            </p>
          </div>
        </div>

        {/* Card 2 (Center Highlighted) */}
        <div className="bg-accent flex flex-col gap-4 md:gap-[22px] p-6 md:px-[28px] md:py-[56px] rounded-2xl md:rounded-t-[24px] md:rounded-b-none w-full md:w-[381px] z-20 md:-mx-4 shadow-2xl relative md:h-[449px] motion-safe:transition-transform motion-safe:hover:-translate-y-4">
          <div className="bg-white rounded-full w-12 h-12 md:w-[56px] md:h-[56px] flex items-center justify-center shadow-lg relative z-10">
            <Image
              alt="Document"
              className="w-6 h-6 md:w-[32px] md:h-[32px] object-contain"
              height={32}
              src={imgSolarDocumentAddBold}
              width={32}
            />
          </div>

          <div className="w-full relative z-10 mt-2">
            <h3 className="font-unbounded font-bold text-xl md:text-[22px] text-[#06090e] leading-[1.4]">
              Too many documents, no clear path
            </h3>
          </div>

          <div className="w-full relative z-10">
            <p className="font-unbounded font-light text-base md:text-[18px] text-[#06090e] leading-[1.5]">
              Feeling overwhelmed by endless research papers and textbook chapters without a
              starting point.
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="flex flex-col gap-4 md:gap-[22px] p-6 md:px-[32px] md:py-[56px] rounded-2xl md:rounded-r-[24px] md:rounded-tl-none w-full md:w-[461px] bg-[rgba(43,43,43,0.2)] backdrop-blur-sm border border-white/5 relative group motion-safe:transition-transform motion-safe:hover:-translate-y-2">
          <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_-4px_-4px_13px_0px_rgba(253,118,26,0.6)]" />

          <div className="bg-white rounded-full w-12 h-12 md:w-[56px] md:h-[56px] flex items-center justify-center shadow-lg relative z-10">
            <Image
              alt="Clock"
              className="w-6 h-6 md:w-[32px] md:h-[32px] object-contain"
              height={32}
              src={imgTablerClockFilled}
              width={32}
            />
          </div>

          <div className="w-full relative z-10 mt-2">
            <h3 className="font-unbounded font-bold text-xl md:text-[22px] text-white leading-[1.4]">
              Waste time rereading without progress
            </h3>
          </div>

          <div className="w-full relative z-10">
            <p className="font-unbounded font-light text-base md:text-[18px] text-gray-300 leading-[1.5]">
              Passive reading often results in poor retention. You need active recall and structured
              synthesis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
