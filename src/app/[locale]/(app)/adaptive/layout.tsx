import '@xyflow/react/dist/style.css';

export default function AdaptiveLearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page pb-12">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-brand-action focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className="mx-auto max-w-[1404px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 animate-fadeIn"
      >
        {children}
      </main>
    </div>
  );
}
