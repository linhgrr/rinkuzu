'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineShieldCheck } from '@/components/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      console.log('Attempting login for:', email);

      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });

      console.log('Login result:', result);

      if (result?.error) {
        console.error('Login error:', result.error);
        setError('Invalid email or password');
      } else if (result?.ok) {
        console.log('Login successful, redirecting...');
        router.replace('/');
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login exception:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-cyan-50 to-blue-50" />

      {/* Floating Elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-purple-500/20 rounded-full blur-xl animate-pulse" />
      <div className="absolute top-1/3 right-10 w-24 h-24 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-xl animate-pulse delay-1000" />
      <div className="absolute bottom-10 left-1/3 w-40 h-40 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-xl animate-pulse delay-2000" />

      <div className="relative flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 min-h-screen pt-16 sm:pt-20">
        {/* Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 sm:mb-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-12 h-12 sm:w-16 sm:h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <span className="text-white font-bold text-xl sm:text-2xl">R</span>
                </div>
                <div className="absolute -inset-1 gradient-primary rounded-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-300 blur-sm -z-10" />
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold gradient-text">RinKuzu</span>
                <p className="text-xs sm:text-sm text-gray-500 -mt-1">AI Quiz Platform</p>
              </div>
            </Link>
          </div>

          <div className="mt-6 sm:mt-8 text-center animate-fadeInUp">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">Welcome Back!</h1>
            <p className="text-base sm:text-lg text-gray-600">
              Sign in to continue creating amazing quizzes
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card variant="glass" className="backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp" style={{ animationDelay: '200ms' }}>
            <CardHeader className="text-center pb-4">
              <CardTitle size="lg" className="text-gray-900">Sign In</CardTitle>
              <CardDescription className="text-base">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <Card variant="bordered" className="border-red-200 bg-red-50 p-4 animate-fadeInUp">
                    <div className="flex items-center text-red-700">
                      <HiOutlineExclamationCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </Card>
                )}

                <div className="space-y-5">
                  <Input
                    label="Email Address"
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    variant="glass"
                    icon={
                      <HiOutlineMail className="w-5 h-5" />
                    }
                  />

                  <Input
                    label="Password"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    variant="glass"
                    icon={
                      <HiOutlineLockClosed className="w-5 h-5" />
                    }
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={loading}
                    variant="gradient"
                    size="lg"
                    className="w-full"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </div>
              </form>

              {/* Sign Up Link */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link
                      href="/register"
                      className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                    >
                      Create Account
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-gray-500">
              Secure login powered by advanced encryption
            </p>
            <div className="flex items-center justify-center mt-4 space-x-4 text-xs text-gray-400">
              <div className="flex items-center">
                <HiOutlineShieldCheck className="w-4 h-4 mr-1" />
                SSL Encrypted
              </div>
              <div className="flex items-center">
                <HiOutlineLockClosed className="w-4 h-4 mr-1" />
                Privacy Protected
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 