import Image from 'next/image';

import { imgBackground, imgFrame33 } from './constants';

const testimonials = [
  {
    name: 'Sarah Jenkins',
    role: 'Medical Student',
    text: '"The PDF analysis is mind-blowing. It turned my 200-page thesis prep into a manageable 10-day roadmap."',
  },
  {
    name: 'David Chen',
    role: 'Software Engineer',
    text: '"I used to spend hours figuring out what to learn next. Now, I just upload the docs and follow the path."',
  },
  {
    name: 'Emma Watson',
    role: 'Law Student',
    text: '"The progress tracking keeps me motivated. It\'s like having a personal tutor available 24/7."',
  },
  {
    name: 'Michael Ross',
    role: 'Data Scientist',
    text: '"Quizzes generated from my own materials? Absolute game-changer for active recall."',
  },
  {
    name: 'Sophia Lee',
    role: 'MBA Candidate',
    text: '"The way it breaks down complex case studies into digestible milestones is incredible."',
  },
] as const;

export default function Testimonials() {
  return (
    <div className="relative z-10 flex w-full flex-col items-center gap-12 md:gap-[112px]">
      <div className="mx-auto flex w-full max-w-[1182px] flex-col items-center gap-6 px-4 text-center text-white md:gap-[44px]">
        <h2 className="font-unbounded text-3xl font-extrabold leading-[1.2] sm:text-4xl md:text-[48px] md:leading-[1.4]">
          <span className="text-accent">TRUSTED</span>
          <span>{` BY `}</span>
          <span className="text-accent">10.000+</span>
          <span>{` `}</span>
          <span className="bg-[linear-gradient(177deg,#fff_1.3%,#999_98.7%)] bg-clip-text text-transparent">
            LEARNERS
          </span>
        </h2>
        <p className="font-unbounded text-base font-light leading-[1.5] text-white md:text-[20px]">
          Turn overwhelming documents into structured, easy-to-follow learning paths. Our AI
          analyzes your PDFs and breaks them down into clear, actionable steps. Save hours of effort
          and focus on what truly matters — learning effectively. Join thousands of learners already
          studying smarter, not harder.
        </p>
      </div>

      <div className="relative left-1/2 w-[100vw] -translate-x-1/2">
        <div className="overflow-hidden py-16">
          <div className="landing-testimonials-track flex w-max items-center">
            {[false, true].flatMap((duplicate) =>
              testimonials.map((item) => (
                <div
                  key={`${duplicate ? 'duplicate' : 'primary'}-${item.name}`}
                  className="w-[85vw] shrink-0 px-[24px] sm:w-[42vw] md:w-[33vw] lg:w-[30vw]"
                  aria-hidden={duplicate || undefined}
                >
                  <div className="relative flex origin-center flex-col items-start gap-[22px] rounded-[24px] px-[32px] py-[72px] shadow-[0px_16px_28px_0px_rgba(0,0,0,0.05)]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[24px] bg-[rgba(43,43,43,0.2)] backdrop-blur-sm"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_-4px_-4px_13px_0px_rgba(253,118,26,0.6)]" />

                    <div className="relative z-10 flex w-full shrink-0 items-center gap-[16px]">
                      <div className="relative size-[60px] shrink-0 overflow-hidden rounded-full">
                        <Image
                          alt={item.name}
                          fill
                          sizes="60px"
                          className="pointer-events-none rounded-full object-cover"
                          src={imgBackground}
                          unoptimized
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-[4px]">
                        <p className="font-unbounded text-[22px] font-bold leading-[1.4] text-white">
                          {item.name}
                        </p>
                        <p className="font-unbounded text-[18px] font-light leading-[1.5] text-[#ededed]">
                          {item.role}
                        </p>
                      </div>
                    </div>

                    <div className="relative z-10 h-[28px] w-[204px] shrink-0">
                      <Image
                        alt=""
                        fill
                        sizes="204px"
                        className="object-contain"
                        src={imgFrame33}
                        unoptimized
                        aria-hidden="true"
                      />
                    </div>

                    <div className="relative z-10 w-full">
                      <p className="font-unbounded text-[18px] font-light leading-[1.5] text-[#ededed]">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
