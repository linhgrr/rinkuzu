import type { Metadata } from 'next';
import { CheckEmailClient } from './CheckEmailClient';

export const metadata: Metadata = {
  title: 'Check your email | RinKuzu',
  description: 'Resend the verification email for your RinKuzu account.',
};

export default function CheckEmailPage() {
  return <CheckEmailClient />;
}
