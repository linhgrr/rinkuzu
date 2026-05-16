import type { Metadata } from 'next';
import { ForgotPasswordClient } from './ForgotPasswordClient';

export const metadata: Metadata = {
  title: 'Forgot password | RinKuzu',
  description: 'Request a password reset link for your RinKuzu account.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
