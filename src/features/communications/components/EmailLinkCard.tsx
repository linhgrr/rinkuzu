import Image from 'next/image';
import type { ReactNode } from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineMail } from 'react-icons/hi';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';

/**
 * Signed-out page opened from an email link (unsubscribe, feedback choices): logo,
 * centred card on the neutral page, a state icon and the actions (RIN-915, RIN-981).
 * No hooks, so server and client pages can both render it.
 */

export type EmailLinkIcon = 'mail' | 'done' | 'problem';

export const EMAIL_LINK_PRIMARY_BUTTON =
  'inline-flex w-full items-center justify-center rounded-xl bg-brand-trust px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-trust-hover sm:w-auto';
export const EMAIL_LINK_SECONDARY_BUTTON =
  'inline-flex w-full items-center justify-center rounded-xl border border-brand-trust px-5 py-3 text-sm font-semibold text-brand-trust transition-colors hover:bg-green-50 sm:w-auto';

type EmailLinkCardProps = {
  icon: EmailLinkIcon;
  title: string;
  description: string;
  children: ReactNode;
};

function StateIcon({ icon }: { icon: EmailLinkIcon }) {
  if (icon === 'mail')
    return <HiOutlineMail className="size-10 text-brand-trust" aria-hidden="true" />;
  if (icon === 'done') {
    return <HiOutlineCheckCircle className="size-10 text-emerald-500" aria-hidden="true" />;
  }
  return <HiOutlineExclamationCircle className="size-10 text-red-500" aria-hidden="true" />;
}

export function EmailLinkCard({ icon, title, description, children }: EmailLinkCardProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-neutral-50" />
      <div className="relative flex min-h-screen flex-col justify-center px-4 pt-16 py-8 sm:px-6 sm:pt-20 sm:py-12 lg:px-8">
        <div className="mb-6 sm:mx-auto sm:w-full sm:max-w-md sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center sm:h-20">
                <Image
                  src="/images/auth_logo.webp"
                  alt="RinKuzu Logo"
                  width={80}
                  height={80}
                  className="h-16 w-auto object-contain sm:h-20"
                  style={{ width: 'auto' }}
                  unoptimized
                />
              </div>
            </Link>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="border-0 bg-white shadow-lg shadow-neutral-200/60">
            <CardHeader className="pb-4 text-center">
              <CardTitle size="lg" className="text-neutral-900">
                {title}
              </CardTitle>
              <CardDescription className="text-base">{description}</CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <StateIcon icon={icon} />
                {children}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
