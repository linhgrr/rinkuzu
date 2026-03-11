import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiOutlineLightBulb } from '@/components/icons';

export const ProTipCard = memo(function ProTipCard() {
  const t = useTranslations('dashboard');
  return (
    <Card className="p-6 bg-slate-900 text-white border-0 shadow-xl overflow-hidden relative group">
      <div className="relative z-10">
        <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 mb-4 group-hover:scale-110 transition-transform">
          <HiOutlineLightBulb className="w-6 h-6 text-teal-600" />
        </div>
        <h3 className="font-bold text-lg mb-2">{t('proTip')}</h3>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed font-medium">
          {t('proTipContent')}
        </p>
        <Button variant="outline" className="w-full mt-4 bg-white/10 border-white/20 text-white hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors">
          {t('readGuide')}
        </Button>
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-300" />
    </Card>
  );
});