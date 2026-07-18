import Marquee from 'react-fast-marquee';
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
}

export default function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  return (
    <div className="relative w-full overflow-clip bg-[#06090e] min-h-screen text-white font-unbounded">
      <TextureBackground />
      <Header isAuthenticated={isAuthenticated} />

      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 lg:px-[96px]">
        {/* Hero */}
        <section className="relative w-full flex flex-col">
          <Hero isAuthenticated={isAuthenticated} />
        </section>

        {/* Metrics — overlaps hero */}
        <section className="relative z-20 w-full py-12 md:py-24 xl:-mt-[206px]">
          <Metrics />
        </section>

        {/* Struggle */}
        <section className="relative w-full pt-[80px] md:pt-[154px] pb-[40px] md:pb-[44px] z-20">
          <StruggleSection />
        </section>

        {/* Marquee */}
        <div className="w-[100vw] relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-[#ff541b] mt-[68px] md:mt-[215px] mb-0">
          <Marquee speed={50} autoFill>
            <div className="flex whitespace-nowrap h-[80px] items-center text-[20px] font-unbounded font-normal text-white gap-[72px] mr-[72px]">
              <div className="flex flex-col justify-center relative shrink-0">
                <p>AI POWERED</p>
              </div>
              <div className="flex flex-col justify-center relative shrink-0">
                <p>STUDY FLOW</p>
              </div>
              <div className="flex flex-col justify-center relative shrink-0">
                <p>LEARNING PATH</p>
              </div>
              <div className="flex flex-col justify-center relative shrink-0">
                <p>DIGITAL BRAIN</p>
              </div>
            </div>
          </Marquee>
        </div>

        {/* How It Works */}
        <section className="relative w-full pt-[120px] md:pt-[232px] pb-0 z-20">
          <HowItWorks />
        </section>

        {/* Core Intelligence */}
        <section className="relative w-full pt-[60px] md:pt-[167px] pb-0 z-20">
          <CoreIntelligence />
        </section>

        {/* Testimonials */}
        <section className="relative w-full pt-[40px] md:pt-[132px] pb-0 z-20">
          <Testimonials />
        </section>

        {/* Bottom CTA — full viewport width */}
        <div className="w-[100vw] relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mt-[40px] md:mt-[92px] z-20">
          <BottomCta isAuthenticated={isAuthenticated} />
        </div>
      </main>
    </div>
  );
}
