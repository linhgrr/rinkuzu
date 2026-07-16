import Image from 'next/image';

import { toBrowserPath } from '@/lib/routing/pathname';

interface FooterProps {
  locale: string;
}

export default function Footer({ locale }: FooterProps) {
  return (
    <footer className="relative w-full max-w-[1920px] mx-auto border-t border-white/10 z-10 bg-[#0a0f16]">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0 px-6 sm:px-12 md:px-24 py-12 md:py-[54px] min-h-[168px]">
        {/* Left Side - Brand & Copyright */}
        <div className="flex flex-col gap-3 md:gap-[12px] items-center md:items-start text-center md:text-left">
          <Image
            src="/images/navbar_logo.webp"
            alt="Rinkuzu"
            width={140}
            height={36}
            sizes="140px"
            className="h-[32px] w-auto object-contain"
            style={{ width: 'auto' }}
          />
          <p className="font-unbounded font-light text-sm md:text-[16px] text-[#ededed]/60 m-0 leading-[1.5]">
            © 2026 Rinkuzu. All rights reserved.
          </p>
        </div>

        {/* Right Side - Links */}
        <div className="flex flex-wrap justify-center md:justify-end gap-6 md:gap-[32px]">
          <a
            href={toBrowserPath('/privacy', locale)}
            className="font-unbounded font-light text-sm md:text-[16px] text-[#ededed]/80 hover:text-white transition-colors leading-[1.5]"
          >
            Privacy Policy
          </a>
          <a
            href={toBrowserPath('/terms', locale)}
            className="font-unbounded font-light text-sm md:text-[16px] text-[#ededed]/80 hover:text-white transition-colors leading-[1.5]"
          >
            Terms of Service
          </a>
          <a
            href={toBrowserPath('/contact', locale)}
            className="font-unbounded font-light text-sm md:text-[16px] text-[#ededed]/80 hover:text-white transition-colors leading-[1.5]"
          >
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
}
