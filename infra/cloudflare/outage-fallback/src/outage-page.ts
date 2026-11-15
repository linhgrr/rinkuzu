import { LOGO_DATA_URI } from './logo';

export type OutageLocale = 'vi' | 'en';

export type NotifyState = 'default' | 'success' | 'invalid' | 'rate_limited' | 'unavailable';

/** The page-URL query values the notify form carries back to the API. */
export const CONTEXT_QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'entry',
] as const;

type ContextQueryKey = (typeof CONTEXT_QUERY_KEYS)[number];

export type ContextQuery = Partial<Record<ContextQueryKey, string>>;

export interface OutagePageInput {
  locale: OutageLocale;
  /** The path the visitor asked for; sent with the email so we know where they came from. */
  path: string;
  query: ContextQuery;
  state: NotifyState;
  /** Echoed back into the field when the submit failed, so the visitor can fix it. */
  email?: string;
}

/** Bump when the consent wording changes, so stored sign-ups record what they agreed to. */
export const CONSENT_VERSION = 'outage-notify-2026-11-15';

interface Copy {
  title: string;
  body: string;
  label: string;
  button: string;
  busy: string;
  consent: string;
  privacyHeading: string;
  privacy: string;
  success: string;
  invalid: string;
  rate_limited: string;
  unavailable: string;
}

const PRIVACY_CONTACT = 'privacy@rinkuzu.app';

const COPY: Record<OutageLocale, Copy> = {
  vi: {
    title: 'Rinkuzu đang tạm nghỉ một chút',
    body: 'Chúng tôi đang khắc phục để Rinkuzu sớm hoạt động trở lại. Để lại email, chúng tôi sẽ báo bạn một lần khi Rinkuzu trở lại.',
    label: 'Email của bạn',
    button: 'Báo cho tôi',
    busy: 'Đang gửi…',
    consent:
      'Chúng tôi chỉ gửi bạn đúng một email khi Rinkuzu trở lại, rồi xoá địa chỉ này trong vòng 30 ngày.',
    privacyHeading: 'Quyền riêng tư',
    privacy:
      'Chúng tôi lưu email, ngôn ngữ, trang bạn đang mở và thẻ chiến dịch trong đường dẫn (nếu có), chỉ để gửi bạn một email báo Rinkuzu đã trở lại. Các thông tin này bị xoá 30 ngày sau email đó. Thắc mắc, liên hệ',
    success: 'Đã ghi nhận. Hẹn gặp lại bạn sớm!',
    invalid: 'Email này chưa đúng. Bạn kiểm tra lại giúp nhé.',
    rate_limited: 'Bạn đã gửi nhiều lần. Thử lại sau nhé.',
    unavailable: 'Không gửi được, thử lại sau.',
  },
  en: {
    title: 'Rinkuzu is taking a short break',
    body: "We're working to bring Rinkuzu back soon. Leave your email and we'll tell you once when we're back.",
    label: 'Your email',
    button: 'Notify me',
    busy: 'Sending…',
    consent: "We email you once when we're back, then delete your address within 30 days.",
    privacyHeading: 'Privacy',
    privacy:
      'We store your email, language, the page you came from and any campaign tags in the link, only to send you one "we\'re back" email. We delete them 30 days after that email. Questions:',
    success: 'Got it. See you soon!',
    invalid: "That email doesn't look right. Please check it.",
    rate_limited: 'Too many tries. Please try again later.',
    unavailable: "Couldn't send. Please try again later.",
  },
};

export function consentText(locale: OutageLocale): string {
  return COPY[locale].consent;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** JSON inside a <script> element: `<` is escaped so no value can close the element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

// Tokens from DESIGN.md / globals.css: page --neutral-warm-2, ink --primary-8,
// muted --alpha-3, border --neutral-warm-31, filled action --brand-action-strong
// (white label at 5.18:1) and its hover. The font is not downloaded: Inter if the
// visitor has it, then the system stack.
const CSS = `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;background:#fffcf9;color:#441f05;font:16px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:480px;background:#fff;border:1px solid #f6e2d5;border-radius:20px;padding:24px 16px;box-shadow:0 8px 24px rgba(68,31,5,.06)}
.logo{display:block;width:85px;height:40px}
h1{margin:24px 0 8px;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-.01em}
.lead{margin:0;color:rgba(68,31,5,.8)}
form{margin:24px 0 0}
label{display:block;margin:0 0 8px;font-size:14px;font-weight:600}
input{display:block;width:100%;height:48px;margin:0;padding:0 14px;border:1px solid #d9d5d0;border-radius:12px;background:#fff;color:inherit;font:inherit}
input:focus-visible,button:focus-visible{outline:3px solid #c2410c;outline-offset:2px}
input[aria-invalid=true]{border-color:#b91c1c}
.field-error{margin:8px 0 0;color:#b91c1c;font-size:14px}
button{display:block;width:100%;height:48px;margin:16px 0 0;padding:0 18px;border:0;border-radius:12px;background:#c2410c;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#9a3412}
button:disabled{background:#9a3412;cursor:progress}
.consent{margin:12px 0 0;font-size:14px;color:rgba(68,31,5,.8)}
.notice{margin:16px 0 0;padding:12px 16px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;font-size:14px}
.success{margin:24px 0 0;padding:16px;border:1px solid #a7f3d0;border-radius:12px;background:#ecfdf5;color:#005f55;font-weight:600}
.privacy{margin:24px 0 0;padding:16px 0 0;border-top:1px solid #f6e2d5;font-size:14px;color:rgba(68,31,5,.8)}
.privacy h2{margin:0 0 4px;font-size:14px;line-height:1.5;font-weight:600;color:#441f05}
.privacy p{margin:0}
.privacy a{color:#c2410c}
[hidden]{display:none!important}
@media (min-width:640px){main{padding:40px}h1{font-size:28px}}`;

// Progressive enhancement only: without it the form posts and the Worker answers
// with this page in the matching state.
const SCRIPT = `(function(){var f=document.getElementById('notify-form');if(!f||!window.fetch||!window.URLSearchParams)return;var M=JSON.parse(document.getElementById('notify-copy').textContent);var i=document.getElementById('email'),b=f.querySelector('button'),er=document.getElementById('email-error'),n=document.getElementById('notify-status'),ok=document.getElementById('notify-success');
function show(s){er.hidden=true;n.hidden=true;i.removeAttribute('aria-invalid');if(s==='success'){f.hidden=true;ok.textContent=M.success;ok.hidden=false;ok.focus();return}if(s==='invalid'){er.textContent=M.invalid;er.hidden=false;i.setAttribute('aria-invalid','true');i.focus();return}n.textContent=M[s]||M.unavailable;n.hidden=false}
f.addEventListener('submit',function(e){e.preventDefault();if(b.disabled)return;b.disabled=true;b.setAttribute('aria-busy','true');b.textContent=M.busy;
fetch(f.action,{method:'POST',body:new URLSearchParams(new FormData(f)),headers:{accept:'application/json'},credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){return d&&d.state},function(){return'unavailable'}).then(function(s){b.disabled=false;b.removeAttribute('aria-busy');b.textContent=M.button;show(s||'unavailable')})})})();`;

function hiddenField(name: string, value: string | undefined): string {
  if (!value) return '';
  return `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
}

export function renderOutagePage(input: OutagePageInput): string {
  const copy = COPY[input.locale];
  const { state } = input;
  const invalid = state === 'invalid';
  const formNotice = state === 'rate_limited' || state === 'unavailable' ? copy[state] : '';
  const hidden = [
    hiddenField('locale', input.locale),
    hiddenField('path', input.path),
    ...CONTEXT_QUERY_KEYS.map((key) => hiddenField(key, input.query[key])),
  ].join('');
  const scriptCopy = {
    button: copy.button,
    busy: copy.busy,
    success: copy.success,
    invalid: copy.invalid,
    rate_limited: copy.rate_limited,
    unavailable: copy.unavailable,
  };

  return `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#fffcf9">
<title>${escapeHtml(copy.title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<img class="logo" src="${LOGO_DATA_URI}" width="85" height="40" alt="Rinkuzu">
<h1>${escapeHtml(copy.title)}</h1>
<p class="lead">${escapeHtml(copy.body)}</p>
<p id="notify-success" class="success" role="status" tabindex="-1"${state === 'success' ? '' : ' hidden'}>${state === 'success' ? escapeHtml(copy.success) : ''}</p>
<form id="notify-form" method="post" action="/__rinkuzu/notify" novalidate${state === 'success' ? ' hidden' : ''}>
<label for="email">${escapeHtml(copy.label)}</label>
<input id="email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254" aria-describedby="email-error"${invalid ? ' aria-invalid="true" autofocus' : ''} value="${escapeHtml(input.email ?? '')}">
<p id="email-error" class="field-error"${invalid ? '' : ' hidden'}>${invalid ? escapeHtml(copy.invalid) : ''}</p>
${hidden}
<button type="submit">${escapeHtml(copy.button)}</button>
<p class="consent">${escapeHtml(copy.consent)}</p>
<p id="notify-status" class="notice" role="alert"${formNotice ? '' : ' hidden'}>${escapeHtml(formNotice)}</p>
</form>
<section class="privacy" aria-labelledby="privacy-heading">
<h2 id="privacy-heading">${escapeHtml(copy.privacyHeading)}</h2>
<p>${escapeHtml(copy.privacy)} <a href="mailto:${PRIVACY_CONTACT}">${PRIVACY_CONTACT}</a>.</p>
</section>
</main>
<script type="application/json" id="notify-copy">${scriptJson(scriptCopy)}</script>
<script>${SCRIPT}</script>
</body>
</html>`;
}
