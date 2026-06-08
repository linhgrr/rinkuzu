'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { matchesMedia } from '@/hooks/useMediaQuery';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type PwaInstallerState = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isOffline: boolean;
  showInstallBanner: boolean;
};

type PwaInstallerAction = {
  type: 'patch';
  value: Partial<PwaInstallerState>;
};

const initialState: PwaInstallerState = {
  deferredPrompt: null,
  isInstallable: false,
  isOffline: false,
  showInstallBanner: false,
};

function pwaInstallerReducer(
  state: PwaInstallerState,
  action: PwaInstallerAction,
): PwaInstallerState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    default:
      return state;
  }
}

export default function PWAInstaller() {
  const t = useTranslations('pwa');
  const [state, dispatch] = useReducer(pwaInstallerReducer, initialState);

  useEffect(() => {
    const isStandalone = matchesMedia('(display-mode: standalone)');
    const isInWebAppiOS = (window.navigator as IOSNavigator).standalone === true;
    const isAppInstalled = isStandalone || isInWebAppiOS;

    if (!isAppInstalled) {
      const timer = setTimeout(() => {
        dispatch({ type: 'patch', value: { showInstallBanner: true } });
      }, 30000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      dispatch({
        type: 'patch',
        value: {
          deferredPrompt: event as BeforeInstallPromptEvent,
          isInstallable: true,
        },
      });
    };

    const handleAppInstalled = () => {
      dispatch({
        type: 'patch',
        value: {
          deferredPrompt: null,
          isInstallable: false,
          showInstallBanner: false,
        },
      });
    };

    const handleOnline = () => dispatch({ type: 'patch', value: { isOffline: false } });
    const handleOffline = () => dispatch({ type: 'patch', value: { isOffline: true } });

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    dispatch({ type: 'patch', value: { isOffline: !navigator.onLine } });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!state.deferredPrompt) return;

    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      dispatch({
        type: 'patch',
        value: {
          deferredPrompt: null,
          isInstallable: false,
          showInstallBanner: false,
        },
      });
    }
  };

  const dismissInstallBanner = () => {
    dispatch({ type: 'patch', value: { showInstallBanner: false } });
    localStorage.setItem('dismissedInstallBanner', Date.now().toString());
  };

  const shouldShowBanner = () => {
    const dismissed = localStorage.getItem('dismissedInstallBanner');
    if (!dismissed) return state.showInstallBanner;

    const dismissedTime = Number.parseInt(dismissed, 10);
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return state.showInstallBanner && Date.now() - dismissedTime > oneWeek;
  };

  return (
    <>
      {state.isOffline ? (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-50">
          <span className="text-sm">{t('offline')}</span>
        </div>
      ) : null}

      {state.isInstallable && shouldShowBanner() ? (
        <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-brand-trust to-brand-action text-white rounded-lg p-4 shadow-lg z-50 md:left-auto md:right-4 md:max-w-sm">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm">{t('installRinKuzu')}</h3>
              <p className="text-xs opacity-90 mt-1">{t('addToHomeScreen')}</p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="bg-white text-brand-trust px-3 py-1 rounded text-sm font-medium hover:bg-neutral-100 transition-colors"
              >
                {t('install')}
              </button>
              <button
                type="button"
                onClick={dismissInstallBanner}
                className="text-white opacity-70 hover:opacity-100 transition-opacity"
                aria-label={t('dismiss')}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.isInstallable ? (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
          title={t('installApp')}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {t('installApp')}
        </button>
      ) : null}
    </>
  );
}
