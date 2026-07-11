import Image from 'next/image';
import {
  imgGroup3,
  imgGroup2,
  imgGroup4,
  imgGroup5,
  imgGroup6,
  imgGroup7,
  imgImage2,
} from './constants';

export default function TextureBackground() {
  return (
    <div className="pointer-events-none absolute top-0 left-[calc(50%-960px)] h-[6295px] w-[1920px] overflow-hidden">
      <div className="relative h-full w-full">
        {/* Riso back texture overlay - Spans the entire page height */}
        <div
          className="absolute inset-0 opacity-20 mix-blend-soft-light"
          style={{
            backgroundImage: `url('/assets/imgRisoBackTexture.webp')`,
            backgroundRepeat: 'repeat',
            backgroundSize: '337px 449px',
          }}
        />

        {/* Earth background for Hero section */}
        <div className="absolute top-0 left-0 h-[1807px] w-[1920px] overflow-hidden">
          <div
            className="absolute top-[-14px] left-1/2 h-[1814px] w-[2270px] -translate-x-1/2"
            style={{
              maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 80%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 80%)',
            }}
          >
            <Image
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-30"
              src={imgImage2}
              unoptimized
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Top orange gradient fade */}
        <div className="absolute top-0 left-0 h-[2159px] w-[1920px] bg-gradient-to-b from-[rgba(255,84,27,0)] via-[rgba(255,84,27,0.2)] via-[55%] to-[rgba(255,84,27,0)]" />

        {/* Glow Effects (Blur balls) */}
        <div className="absolute top-[2114px] left-[-100px] h-[595px] w-[568px] rounded-full bg-[rgba(253,118,26,0.3)] blur-[200px]" />
        <div className="absolute top-[4044px] left-[736px] h-[730px] w-[831px] rounded-full bg-[rgba(253,118,26,0.3)] blur-[200px]" />
        <div className="absolute top-[3073px] left-[1151px] h-[730px] w-[831px] rounded-full bg-[rgba(253,118,26,0.3)] blur-[200px]" />
        <div className="absolute top-[4774px] left-[1076px] h-[819px] w-[981px] rounded-full bg-[rgba(253,118,26,0.1)] blur-[200px]" />
        <div className="absolute top-[2050px] left-[1474px] h-[273px] w-[610px] rounded-full bg-[rgba(253,118,26,0.49)] blur-[200px]" />
        <div className="absolute top-[5085px] left-[-313px] h-[730px] w-[831px] rounded-full bg-[rgba(253,118,26,0.3)] blur-[200px]" />

        {/* Section Grids (Background patterns) */}
        {/* Struggle Section Background Grid */}
        <div className="absolute top-[1772px] left-[1327px] opacity-10">
          <Image
            alt=""
            width={409}
            height={504}
            className="absolute top-0 left-[111px] h-[504px] w-[409px]"
            src={imgGroup3}
            unoptimized
            aria-hidden="true"
          />
          <Image
            alt=""
            width={633}
            height={287}
            className="absolute top-[108px] left-0 h-[287px] w-[633px]"
            src={imgGroup2}
            unoptimized
            aria-hidden="true"
          />
        </div>

        {/* How It Works Background Grid */}
        <div className="absolute top-[2225px] left-[-93px] opacity-10">
          <Image
            alt=""
            width={457}
            height={515}
            className="absolute top-0 left-[125px] h-[515px] w-[457px]"
            src={imgGroup4}
            unoptimized
            aria-hidden="true"
          />
          <Image
            alt=""
            width={707}
            height={293}
            className="absolute top-[110px] left-0 h-[293px] w-[707px]"
            src={imgGroup5}
            unoptimized
            aria-hidden="true"
          />
        </div>

        {/* Core Intelligence Background Grid */}
        <div className="absolute top-[3180px] left-[1230px] opacity-10">
          <Image
            alt=""
            width={457}
            height={515}
            className="absolute top-0 left-[125px] h-[515px] w-[457px]"
            src={imgGroup6}
            unoptimized
            aria-hidden="true"
          />
          <Image
            alt=""
            width={707}
            height={293}
            className="absolute top-[110px] left-0 h-[293px] w-[707px]"
            src={imgGroup5}
            unoptimized
            aria-hidden="true"
          />
        </div>

        <div className="absolute top-[4151px] left-[815px] opacity-10">
          <Image
            alt=""
            width={457}
            height={515}
            className="absolute top-0 left-[125px] h-[515px] w-[457px]"
            src={imgGroup6}
            unoptimized
            aria-hidden="true"
          />
          <Image
            alt=""
            width={707}
            height={293}
            className="absolute top-[110px] left-0 h-[293px] w-[707px]"
            src={imgGroup5}
            unoptimized
            aria-hidden="true"
          />
        </div>

        {/* Bottom Section Background Grid */}
        <div className="absolute top-[4957px] left-[1280px] opacity-10">
          <Image
            alt=""
            width={409}
            height={504}
            className="absolute top-0 left-[111px] h-[504px] w-[409px]"
            src={imgGroup3}
            unoptimized
            aria-hidden="true"
          />
          <Image
            alt=""
            width={633}
            height={287}
            className="absolute top-[108px] left-0 h-[287px] w-[633px]"
            src={imgGroup2}
            unoptimized
            aria-hidden="true"
          />
        </div>

        <div className="absolute top-[5192px] left-[-234px] opacity-10">
          <Image
            alt=""
            width={457}
            height={515}
            className="absolute top-0 left-[125px] h-[515px] w-[457px]"
            src={imgGroup7}
            unoptimized
            aria-hidden="true"
          />
          <Image
            alt=""
            width={707}
            height={293}
            className="absolute top-[110px] left-0 h-[293px] w-[707px]"
            src={imgGroup5}
            unoptimized
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
