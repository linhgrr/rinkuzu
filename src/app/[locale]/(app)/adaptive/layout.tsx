import '@xyflow/react/dist/style.css';
import styles from '@/features/adaptive/components/sections/AdaptiveDashboardLayout.module.css';
import { cn } from '@/lib/utils';

// The app shell (AppChrome + MainLayoutWrapper) already renders the translated
// skip link and the page's single <main> landmark, so this layout adds neither.
export default function AdaptiveLearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page pb-12">
      <div
        className={cn(
          styles['dashboardMain'],
          'mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 animate-fadeIn',
        )}
      >
        {children}
      </div>
    </div>
  );
}
