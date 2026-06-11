import '@xyflow/react/dist/style.css';

export default function AdaptiveLearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page pb-12">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-text focus:shadow-lg"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn"
      >
        {children}
      </main>
    </div>
  );
}
