import type { Metadata } from 'next';
import { VerifyEmailClient } from './VerifyEmailClient';

export const metadata: Metadata = {
  title: 'Verify email | RinKuzu',
  description: 'Verify your RinKuzu email address.',
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
