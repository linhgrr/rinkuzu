interface MaintenanceBannerProps {
  locale: string;
}

export function MaintenanceBanner({ locale }: MaintenanceBannerProps) {
  const isVi = locale === 'vi';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto flex w-full justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-5xl rounded-xl border border-primary-7/20 bg-primary px-5 py-4 text-primary-8 shadow-lg sm:px-6"
      >
        <p className="text-center text-sm font-bold leading-6 sm:text-base">
          {isVi ? '🚧 RinKuzu đang bảo trì' : '🚧 RinKuzu is under maintenance'}
        </p>
        <p className="mt-1 text-center text-xs font-semibold leading-5 sm:text-sm">
          {isVi
            ? 'Các chức năng tạo quiz hiện tạm thời không hoạt động. Vui lòng thử lại sau.'
            : 'Quiz creation features are temporarily unavailable. Please try again later.'}
        </p>
      </div>
    </div>
  );
}
