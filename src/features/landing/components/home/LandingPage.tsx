import Header from './Header';
import Hero from './Hero';
import Metrics from './Metrics';
import StruggleSection from './StruggleSection';
import HowItWorks from './HowItWorks';
import CoreIntelligence from './CoreIntelligence';
import Testimonials from './Testimonials';
import BottomCta from './BottomCta';
import TextureBackground from './TextureBackground';

interface LandingPageProps {
  isAuthenticated?: boolean;
  locale: string;
}

export default function LandingPage({ isAuthenticated = false, locale }: LandingPageProps) {
  const isVi = locale === 'vi';
  const marqueeLabels = isVi
    ? ['HỖ TRỢ BỞI AI', 'LUỒNG HỌC TẬP', 'LỘ TRÌNH HỌC', 'ĐỒ THỊ KIẾN THỨC']
    : ['AI POWERED', 'STUDY FLOW', 'LEARNING PATH', 'KNOWLEDGE GRAPH'];
  return (
    <div className="relative w-full overflow-clip bg-[#06090e] min-h-screen text-white font-unbounded">
      <TextureBackground />
      <Header isAuthenticated={isAuthenticated} locale={locale} />

      <main
        id="landing-main-content"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-[1920px] px-4 sm:px-8 md:px-12 lg:px-[96px]"
      >
        {/* Hero */}
        <section className="relative w-full flex flex-col">
          <Hero isAuthenticated={isAuthenticated} locale={locale} />
        </section>

        {/* Metrics — overlaps hero */}
        <section className="relative z-20 w-full py-12 md:py-24 xl:-mt-[206px]">
          <Metrics locale={locale} />
        </section>

        {/* Struggle */}
        <section className="relative w-full pt-[80px] md:pt-[154px] pb-[40px] md:pb-[44px] z-20">
          <StruggleSection locale={locale} />
        </section>

        {/* Marquee */}
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mt-[68px] mb-0 w-[100vw] overflow-hidden bg-[#ff541b] md:mt-[215px]">
          <div className="flex w-max animate-scroll-left motion-reduce:animate-none">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex h-[80px] shrink-0 items-center gap-[72px] whitespace-nowrap pr-[72px] font-unbounded text-[20px] font-bold text-white"
              >
                {marqueeLabels.map((label) => (
                  <p key={label} className="shrink-0">
                    {label}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <section className="relative w-full pt-[120px] md:pt-[232px] pb-0 z-20">
          <HowItWorks locale={locale} />
        </section>

        {/* Core Intelligence */}
        <section className="relative w-full pt-[60px] md:pt-[167px] pb-0 z-20">
          <CoreIntelligence locale={locale} />
        </section>

        {/* Testimonials */}
        <section className="relative w-full pt-[40px] md:pt-[132px] pb-0 z-20">
          <Testimonials locale={locale} />
        </section>

        {/* Bottom CTA — full viewport width */}
        <div className="w-[100vw] relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mt-[40px] md:mt-[92px] z-20">
          <BottomCta isAuthenticated={isAuthenticated} locale={locale} />
        </div>
      </main>
    </div>
  );
}
