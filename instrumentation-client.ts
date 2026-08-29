import DisableDevtool from 'disable-devtool';
import { isDevtoolShortcut, shouldBlockQuizClipboard } from '@/lib/browser-protection';

const DEVTOOL_GUARD_ID = 'rinkuzu-devtool-guard';
const DEVTOOL_GUARD_STYLE_ID = 'rinkuzu-devtool-guard-style';

function ensureDevtoolGuardStyle() {
  if (document.getElementById(DEVTOOL_GUARD_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = DEVTOOL_GUARD_STYLE_ID;
  style.textContent = `
    html[data-rinkuzu-devtools-open='true'] body > *:not(#${DEVTOOL_GUARD_ID}) {
      visibility: hidden !important;
      pointer-events: none !important;
      user-select: none !important;
    }

    #${DEVTOOL_GUARD_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #0f172a;
      color: #ffffff;
      font: 600 16px/1.5 system-ui, sans-serif;
      text-align: center;
      visibility: visible !important;
    }
  `;

  document.head.appendChild(style);
}

function showDevtoolGuard() {
  document.documentElement.dataset['rinkuzuDevtoolsOpen'] = 'true';
  ensureDevtoolGuardStyle();

  if (!document.body || document.getElementById(DEVTOOL_GUARD_ID)) {
    return;
  }

  const guard = document.createElement('div');
  guard.id = DEVTOOL_GUARD_ID;
  guard.setAttribute('role', 'alert');
  guard.textContent = 'Developer tools are disabled. Close DevTools to continue.';
  document.body.appendChild(guard);
}

function hideDevtoolGuard() {
  delete document.documentElement.dataset['rinkuzuDevtoolsOpen'];
  document.getElementById(DEVTOOL_GUARD_ID)?.remove();
}

function preventDevtoolShortcut(event: KeyboardEvent) {
  if (!isDevtoolShortcut(event)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

/**
 * Whether this bundle was built for the end-to-end suite.
 *
 * Playwright drives a real production build over the Chrome DevTools Protocol,
 * which the detector below cannot tell apart from a person opening DevTools —
 * so it blanks the page and every critical flow fails at the first input.
 *
 * The opt-out is deliberately build-time. `NEXT_PUBLIC_*` is inlined at compile
 * time, so a deployment that does not set it has no bypass in its bundle at
 * all: there is no runtime flag, header or cookie that can turn the protection
 * off in production, and the only way to ship it disabled is to build with an
 * explicitly named e2e command.
 */
const isEndToEndBuild = process.env.NEXT_PUBLIC_E2E === 'true';

function initializeDevtoolProtection() {
  DisableDevtool({
    // Everything else stays on for the suite — the menu, clipboard and shortcut
    // guards are behaviour worth exercising. Only the detector that mistakes
    // automation for a human with DevTools open is waived.
    ignore: () => isEndToEndBuild,
    disableMenu: true,
    disableSelect: false,
    disableInputSelect: false,
    disableCopy: false,
    disableCut: false,
    disablePaste: false,
    clearLog: true,
    ondevtoolopen: showDevtoolGuard,
    ondevtoolclose: hideDevtoolGuard,
  });
}

function preventQuizClipboard(event: ClipboardEvent) {
  if (shouldBlockQuizClipboard(window.location.pathname, event.target)) {
    event.preventDefault();
  }
}

if (process.env.NODE_ENV === 'production') {
  document.addEventListener('keydown', preventDevtoolShortcut, true);

  try {
    initializeDevtoolProtection();
  } catch {
    // Protection must never prevent the application itself from booting.
  }

  document.addEventListener('copy', preventQuizClipboard, true);
  document.addEventListener('cut', preventQuizClipboard, true);
  document.addEventListener('paste', preventQuizClipboard, true);
}
