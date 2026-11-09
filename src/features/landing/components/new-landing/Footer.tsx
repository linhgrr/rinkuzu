import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function Footer() {
  const t = useTranslations('landing.footer');

  return (
    <footer className="border-t border-white/10 bg-black text-white/70">
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:grid-cols-4 lg:gap-14 mb-14 md:mb-16">
          {/* Brand */}
          <div className="space-y-5">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/images/navbar_logo.webp"
                alt="RinKuzu Logo"
                width={160}
                height={40}
                className="h-10 w-auto object-contain"
                style={{ width: 'auto' }}
                priority={false}
              />
            </Link>
            <p className="text-[15px] font-normal leading-7 text-white/55">{t('description')}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-white/90">
              {t('links.title')}
            </h4>
            <ul className="space-y-3.5">
              {[
                { label: t('links.home'), href: '/' },
                { label: t('links.about'), href: '/about' },
                { label: t('links.pricing'), href: '/pricing' },
                { label: t('links.faq'), href: '/faq' },
                { label: t('links.blog'), href: '/blog' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-sm text-sm font-medium leading-6 text-white/60 transition-colors hover:text-green-400 focus-visible:text-green-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-white/90">
              {t('legal.title')}
            </h4>
            <ul className="space-y-3.5">
              {[
                { label: t('legal.privacy'), href: '/privacy' },
                { label: t('legal.terms'), href: '/terms' },
                { label: t('legal.cookie'), href: '/cookies' },
                { label: t('contact'), href: '/contact' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-sm text-sm font-medium leading-6 text-white/60 transition-colors hover:text-green-400 focus-visible:text-green-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/90">
              {t('newsletter.title')}
            </h4>
            <p className="text-sm leading-6 text-white/55">{t('newsletter.description')}</p>
            <form
              action="mailto:support@rinkuzu.app"
              method="post"
              encType="text/plain"
              className="flex gap-3"
            >
              <Input
                type="email"
                name="email"
                required
                placeholder={t('newsletter.placeholder')}
                aria-label={t('newsletter.placeholder')}
                autoComplete="email"
                className="h-10 flex-1 rounded-lg border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus-visible:border-green-500/50"
              />
              <Button
                type="submit"
                className="h-10 whitespace-nowrap rounded-lg bg-green-500 px-4 text-sm font-semibold text-[#07121a] transition-colors hover:bg-green-400"
              >
                {t('newsletter.button')}
              </Button>
            </form>
          </div>
        </div>

        <div className="pt-7 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/50">{t('copyright')}</p>
          <p className="text-sm font-medium text-white/50">support@rinkuzu.app</p>
        </div>
      </div>
    </footer>
  );
}
