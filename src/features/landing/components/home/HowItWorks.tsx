import Image from 'next/image';

import { imgGroup8 } from './constants';
import { Reveal } from './Reveal';

const cards = [
  {
    num: '1',
    title: 'Upload your PDF',
    desc: 'Simply drag and drop any educational material, from textbooks to specialized research papers.',
    pb: 56,
  },
  {
    num: '2',
    title: 'AI analyzes your content',
    desc: 'Our curator extracts core concepts, identifies difficult areas, and builds a semantic map of the text.',
    pb: 136,
  },
  {
    num: '3',
    title: 'Get a personalized roadmap',
    desc: 'Receive a step-by-step guide tailored to your current knowledge level and learning goals.',
    pb: 216,
  },
];

interface HowItWorksCardProps {
  num: string;
  title: string;
  desc: string;
  pb: number;
}

export default function HowItWorks() {
  return (
    <div className="flex flex-col gap-16 xl:gap-[128px] items-center w-full">
      {/* Title */}
      <Reveal className="flex flex-col font-unbounded font-extrabold justify-center leading-[0] relative shrink-0 text-4xl md:text-[48px] text-center text-white w-full">
        <p className="leading-[1.2] md:leading-[normal]">
          <span>{`LET `}</span>
          <span className="text-accent">AI DO HARD</span>
          <br className="md:hidden" />
          <span className="hidden md:inline">{` `}</span>
          <span className="bg-clip-text text-transparent bg-[linear-gradient(178deg,#fff_1.3%,#999_98.7%)]">
            WORK
          </span>
        </p>
      </Reveal>

      <div className="w-full">
        {/* Mobile layout */}
        <div className="flex flex-col gap-8 items-center px-4 xl:hidden">
          {cards.map((c, i) => (
            <Reveal key={c.num} delay={i * 0.12} className="w-full flex justify-center">
              <Card num={c.num} title={c.title} desc={c.desc} pb={56} />
            </Reveal>
          ))}
        </div>

        <div className="relative hidden xl:block">
          <div className="relative aspect-[1728/387] w-full shrink-0">
            <div
              className="absolute"
              style={{ top: '-3.18%', right: '-1.23%', bottom: '-0.26%', left: '-1.23%' }}
            >
              <Image
                alt=""
                className="block max-w-none object-fill"
                fill
                sizes="(max-width: 1920px) calc(100vw - 192px), 1728px"
                src={imgGroup8}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-start gap-[clamp(24px,5vw,96px)]">
            {cards.map((card) => (
              <div key={card.num} className="min-w-0">
                <Card {...card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ num, title, desc, pb }: HowItWorksCardProps) {
  return (
    <div
      className="relative flex w-full min-w-0 shrink-0 flex-col content-stretch items-start gap-[22px] rounded-bl-[24px] rounded-br-[24px] rounded-tr-[24px] px-[32px] shadow-[0px_16px_28px_0px_rgba(0,0,0,0.05)]"
      style={{ paddingTop: 56, paddingBottom: pb }}
    >
      <div
        aria-hidden="true"
        className="absolute bg-[rgba(43,43,43,0.2)] inset-0 pointer-events-none rounded-bl-[24px] rounded-br-[24px] rounded-tr-[24px] backdrop-blur-sm"
      />
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_-4px_-4px_13px_0px_rgba(253,118,26,0.6)]" />

      <div className="bg-accent content-stretch flex items-center justify-center relative rounded-full shrink-0 size-[56px]">
        <div className="flex flex-col font-unbounded font-bold h-[24px] justify-center leading-[0] relative shrink-0 text-[22px] text-center text-white">
          <p className="leading-[1.4]">{num}</p>
        </div>
      </div>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="flex flex-col font-unbounded font-bold justify-center leading-[0] relative shrink-0 text-[22px] text-white w-full">
          <p className="leading-[1.4]">{title}</p>
        </div>
      </div>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="flex flex-col font-unbounded font-light justify-center leading-[0] relative shrink-0 text-[#ededed] text-[18px] w-full">
          <p className="leading-[1.5]">{desc}</p>
        </div>
      </div>
    </div>
  );
}
