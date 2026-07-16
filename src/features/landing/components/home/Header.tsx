import Image from 'next/image';

import { toBrowserPath } from '@/lib/routing/pathname';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'My Learning', href: '/adaptive' },
  { label: 'Upload PDF', href: '/adaptive/upload' },
];

interface HeaderProps {
  locale: string;
  isAuthenticated?: boolean;
}

export default function Header({ locale, isAuthenticated = false }: HeaderProps) {
  return (
    <header className="fixed w-full top-0 left-0 bg-[#151419]/80 backdrop-blur-md border-b border-white/5 shadow-[0px_7px_8.8px_0px_rgba(0,0,0,0.15)] z-50">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 lg:px-24 h-[80px] flex items-center justify-between">
        {/* Logo */}
        <a
          href={toBrowserPath('/', locale)}
          className="flex items-center"
          aria-label="Rinkuzu home"
        >
          <Image
            src="/images/navbar_logo.webp"
            alt="Rinkuzu"
            width={150}
            height={40}
            priority
            sizes="150px"
            className="h-[36px] md:h-[44px] w-auto object-contain"
            style={{ width: 'auto' }}
          />
        </a>

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex font-unbounded font-normal items-center justify-center gap-8 lg:gap-16 text-base lg:text-[20px] text-white">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={toBrowserPath(link.href, locale)}
              className="cursor-pointer hover:text-accent-hover transition-colors leading-[1.5]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions - Desktop */}
        <div className="hidden md:flex gap-4 items-center justify-end">
          {!isAuthenticated ? (
            <>
              <a
                href={toBrowserPath('/login', locale)}
                className="border border-accent flex h-[44px] lg:h-[48px] items-center justify-center px-6 lg:px-[32px] rounded-[100px] hover:bg-[rgba(255,124,35,0.1)] transition-colors"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  Login
                </span>
              </a>
              <a
                href={toBrowserPath('/register', locale)}
                className="bg-accent flex h-[44px] lg:h-[48px] items-center justify-center px-6 lg:px-[32px] rounded-[100px] hover:bg-accent-hover transition-colors"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  Sign up
                </span>
              </a>
            </>
          ) : (
            <a
              href={toBrowserPath('/dashboard', locale)}
              className="bg-accent flex h-[44px] lg:h-[48px] items-center justify-center px-6 lg:px-[32px] rounded-[100px] hover:bg-accent-hover transition-colors"
            >
              <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                Dashboard
              </span>
            </a>
          )}
        </div>

        {/* Native disclosure avoids hydrating the entire landing header. */}
        <details className="group md:hidden">
          <summary
            aria-label="Toggle navigation menu"
            className="list-none cursor-pointer text-white hover:text-accent-hover [&::-webkit-details-marker]:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-8 group-open:hidden"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="hidden size-8 group-open:block"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </summary>

          <div className="absolute left-0 top-full w-full border-t border-white/5 bg-[#151419]/95">
            <div className="flex flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={toBrowserPath(link.href, locale)}
                  className="rounded-lg px-2 py-3 font-unbounded text-[16px] font-normal text-white transition-colors hover:bg-white/5"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-3">
                {!isAuthenticated ? (
                  <>
                    <a
                      href={toBrowserPath('/login', locale)}
                      className="flex h-[48px] items-center justify-center rounded-[100px] border border-accent"
                    >
                      <span className="font-unbounded text-[16px] font-medium text-white">
                        Login
                      </span>
                    </a>
                    <a
                      href={toBrowserPath('/register', locale)}
                      className="flex h-[48px] items-center justify-center rounded-[100px] bg-accent"
                    >
                      <span className="font-unbounded text-[16px] font-medium text-white">
                        Sign up
                      </span>
                    </a>
                  </>
                ) : (
                  <a
                    href={toBrowserPath('/dashboard', locale)}
                    className="flex h-[48px] items-center justify-center rounded-[100px] bg-accent"
                  >
                    <span className="font-unbounded text-[16px] font-medium text-white">
                      Dashboard
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
