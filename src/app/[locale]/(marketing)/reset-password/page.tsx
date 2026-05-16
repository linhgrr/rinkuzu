import type { Metadata } from 'next';
import { ResetPasswordClient } from './ResetPasswordClient';

export const metadata: Metadata = {
  title: 'Reset password | RinKuzu',
  description: 'Set a new password for your RinKuzu account.',
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
