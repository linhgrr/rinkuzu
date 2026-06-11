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
    <div className="absolute top-0 left-[calc(50%-960px)] w-[1920px] h-[6295px] pointer-events-none overflow-hidden">
      <div className="relative w-full h-full">
        {/* Riso back texture overlay - Spans the entire page height */}
        <div className="absolute top-0 left-0 flex h-[6295px] items-center justify-center w-[1920px] mix-blend-soft-light">
          <div className="flex-none rotate-90">
            <div
              className="opacity-20 w-[6295px] h-[1920px]"
              style={{
                backgroundImage: `url('/assets/imgRisoBackTexture.jpg')`,
                backgroundSize: '336.89px 449.19px',
                backgroundPosition: 'top left',
              }}
            />
          </div>
        </div>

        {/* Earth background for Hero section */}
        <div className="absolute top-0 left-0 w-[1920px] h-[1807px] overflow-hidden">
          <div
            className="absolute top-[-14px] left-1/2 -translate-x-1/2 w-[2270px] h-[1814px]"
            style={{
              maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 80%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 80%)',
            }}
          >
            <img
              alt="Earth"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              src={imgImage2}
            />
          </div>
        </div>

        {/* Top orange gradient fade */}
        <div className="absolute top-0 left-0 w-[1920px] h-[2159px] bg-gradient-to-b from-[rgba(255,84,27,0)] via-[rgba(255,84,27,0.2)] via-[55%] to-[rgba(255,84,27,0)]" />

        {/* Glow Effects (Blur balls) */}
        <div className="absolute top-[2114px] left-[-100px] w-[568px] h-[595px] bg-[rgba(253,118,26,0.3)] blur-[200px] rounded-full" />
        <div className="absolute top-[4044px] left-[736px] w-[831px] h-[730px] bg-[rgba(253,118,26,0.3)] blur-[200px] rounded-full" />
        <div className="absolute top-[3073px] left-[1151px] w-[831px] h-[730px] bg-[rgba(253,118,26,0.3)] blur-[200px] rounded-full" />
        <div className="absolute top-[4774px] left-[1076px] w-[981px] h-[819px] bg-[rgba(253,118,26,0.1)] blur-[200px] rounded-full" />
        <div className="absolute top-[2050px] left-[1474px] w-[610px] h-[273px] bg-[rgba(253,118,26,0.49)] blur-[200px] rounded-full" />
        <div className="absolute top-[5085px] left-[-313px] w-[831px] h-[730px] bg-[rgba(253,118,26,0.3)] blur-[200px] rounded-full" />

        {/* Section Grids (Background patterns) */}
        {/* Struggle Section Background Grid */}
        <div className="absolute top-[1772px] left-[1327px] opacity-10">
          <img alt="" className="absolute top-0 left-[111px] w-[409px] h-[504px]" src={imgGroup3} />
          <img alt="" className="absolute top-[108px] left-0 w-[633px] h-[287px]" src={imgGroup2} />
        </div>

        {/* How It Works Background Grid */}
        <div className="absolute top-[2225px] left-[-93px] opacity-10">
          <img alt="" className="absolute top-0 left-[125px] w-[457px] h-[515px]" src={imgGroup4} />
          <img alt="" className="absolute top-[110px] left-0 w-[707px] h-[293px]" src={imgGroup5} />
        </div>

        {/* Core Intelligence Background Grid */}
        <div className="absolute top-[3180px] left-[1230px] opacity-10">
          <img alt="" className="absolute top-0 left-[125px] w-[457px] h-[515px]" src={imgGroup6} />
          <img alt="" className="absolute top-[110px] left-0 w-[707px] h-[293px]" src={imgGroup5} />
        </div>

        <div className="absolute top-[4151px] left-[815px] opacity-10">
          <img alt="" className="absolute top-0 left-[125px] w-[457px] h-[515px]" src={imgGroup6} />
          <img alt="" className="absolute top-[110px] left-0 w-[707px] h-[293px]" src={imgGroup5} />
        </div>

        {/* Bottom Section Background Grid */}
        <div className="absolute top-[4957px] left-[1280px] opacity-10">
          <img alt="" className="absolute top-0 left-[111px] w-[409px] h-[504px]" src={imgGroup3} />
          <img alt="" className="absolute top-[108px] left-0 w-[633px] h-[287px]" src={imgGroup2} />
        </div>

        <div className="absolute top-[5192px] left-[-234px] opacity-10">
          <img alt="" className="absolute top-0 left-[125px] w-[457px] h-[515px]" src={imgGroup7} />
          <img alt="" className="absolute top-[110px] left-0 w-[707px] h-[293px]" src={imgGroup5} />
        </div>
      </div>
    </div>
  );
}
