import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Quiz Creator - Create Interactive Quizzes from PDFs',
  description: 'A platform for teachers to create interactive quizzes from PDF files with AI-powered question extraction and admin approval workflow.',
  keywords: 'quiz, education, PDF, AI, teachers, students, assessment',
  authors: [{ name: 'Quiz Creator Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
} 