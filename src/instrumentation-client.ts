import DisableDevtool from 'disable-devtool';
import { shouldBlockQuizClipboard } from '@/lib/browser-protection';

function initializeDevtoolProtection() {
  const fallbackUrl = window.location.origin;

  DisableDevtool({
    disableMenu: false,
    disableSelect: false,
    disableInputSelect: false,
    disableCopy: false,
    disableCut: false,
    disablePaste: false,
    clearLog: false,
    url: fallbackUrl,
    timeOutUrl: fallbackUrl,
  });
}

function preventQuizClipboard(event: ClipboardEvent) {
  if (shouldBlockQuizClipboard(window.location.pathname, event.target)) {
    event.preventDefault();
  }
}

if (process.env.NODE_ENV === 'production') {
  try {
    initializeDevtoolProtection();
  } catch {
    // Protection must never prevent the application itself from booting.
  }

  document.addEventListener('copy', preventQuizClipboard, true);
  document.addEventListener('cut', preventQuizClipboard, true);
  document.addEventListener('paste', preventQuizClipboard, true);
}
