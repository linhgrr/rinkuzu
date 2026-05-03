import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { HiOutlineLightBulb } from '@/components/icons';

interface ProTipCardProps {
  title: string;
  content: string;
  ctaLabel: string;
  ctaHref: string;
}

export function ProTipCard({ title, content, ctaLabel, ctaHref }: ProTipCardProps) {
  return (
    <Card className="p-6 bg-neutral-900 text-white border-0 shadow-xl overflow-hidden relative group">
      <div className="relative z-10">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-brand-trust mb-4 group-hover:scale-110 transition-transform">
          <HiOutlineLightBulb className="w-6 h-6 text-brand-trust" />
        </div>
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm text-neutral-400 mb-4 leading-relaxed font-medium">{content}</p>
        <Link
          href={ctaHref}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-orange-500 hover:bg-orange-500"
        >
          {ctaLabel}
        </Link>
      </div>
      <div className="absolute top-[-20%] right-[-10%] h-40 w-40 rounded-full bg-white/5 blur-2xl transition-colors duration-300 group-hover:bg-white/10" />
    </Card>
  );
}
