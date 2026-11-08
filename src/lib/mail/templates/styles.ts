import type { CSSProperties } from 'react';

export const main: CSSProperties = {
  backgroundColor: '#f3f4f6',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  padding: '40px 0',
};

export const logoContainer: CSSProperties = {
  textAlign: 'center',
  marginBottom: 32,
};

export const logoImg: CSSProperties = {
  display: 'inline-block',
  height: 48,
  width: 'auto',
};

export const container: CSSProperties = {
  margin: '0 auto',
  padding: '40px 32px',
  maxWidth: 520,
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
  borderTop: '5px solid #0d9488',
};

export const heading: CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  color: '#111827',
  marginBottom: 24,
  marginTop: 0,
  textAlign: 'center',
};

export const paragraph: CSSProperties = {
  fontSize: 16,
  lineHeight: '26px',
  color: '#374151',
  marginBottom: 20,
};

export const link: CSSProperties = {
  color: '#0d9488',
  textDecoration: 'underline',
  wordBreak: 'break-all',
  fontWeight: 500,
};

export const buttonContainer: CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

export const button: CSSProperties = {
  display: 'inline-block',
  padding: '14px 32px',
  fontSize: 16,
  fontWeight: 600,
  color: '#ffffff',
  background: '#0d9488',
  borderRadius: 8,
  textDecoration: 'none',
  boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.2)',
};

export const hr: CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '32px 0 24px',
  borderWidth: '1px',
  borderStyle: 'solid',
};

export const footer: CSSProperties = {
  fontSize: 13,
  lineHeight: '22px',
  color: '#6b7280',
  textAlign: 'center',
};

/** Mail clients need an absolute URL; the file is served from `public/email/logo.png`. */
export const EMAIL_LOGO_URL = 'https://www.rinkuzu.app/email/logo.png';
