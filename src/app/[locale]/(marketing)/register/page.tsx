import type { Metadata } from 'next';
import { RegisterPageClient } from './RegisterPageClient';

export const metadata: Metadata = {
  title: 'Create Account | RinKuzu',
  description: 'Create a RinKuzu account to start building and sharing quizzes.',
};

export default function RegisterPage() {
  return <RegisterPageClient />;
}
