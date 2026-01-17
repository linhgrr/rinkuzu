'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiCheck,
  HiOutlineShieldCheck,
  HiOutlineInbox,
  HiOutlineHeart
} from '@/components/icons';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-cyan-50 to-violet-50" />

      {/* Floating Elements */}
      <div className="absolute top-20 right-20 w-28 h-28 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-xl animate-pulse" />
      <div className="absolute top-1/2 left-10 w-36 h-36 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-xl animate-pulse delay-1000" />
      <div className="absolute bottom-20 right-1/3 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-purple-500/20 rounded-full blur-xl animate-pulse delay-2000" />

      <div className="relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 min-h-screen pt-20">
        {/* Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <span className="text-white font-bold text-2xl">R</span>
                </div>
                <div className="absolute -inset-1 gradient-primary rounded-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-300 blur-sm -z-10" />
              </div>
              <div>
                <span className="text-3xl font-bold gradient-text">RinKuzu</span>
                <p className="text-sm text-gray-500 -mt-1">AI Quiz Platform</p>
              </div>
            </Link>
          </div>

          <div className="mt-8 text-center animate-fadeInUp">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Join RinKuzu!</h1>
            <p className="text-lg text-gray-600">
              Create your account and start building amazing quizzes
            </p>
          </div>
        </div>

        {/* Register Form */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card variant="glass" className="backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp" style={{ animationDelay: '200ms' }}>
            <CardHeader className="text-center pb-4">
              <CardTitle size="lg" className="text-gray-900">Create Account</CardTitle>
              <CardDescription className="text-base">
                Enter your details to get started with RinKuzu
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

                {success && (
                  <Card variant="bordered" className="border-emerald-200 bg-emerald-50 p-4 animate-fadeInUp">
                    <div className="flex items-center text-emerald-700">
                      <HiOutlineCheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium">{success}</span>
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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password (min 6 characters)"
                    variant="glass"
                    icon={
                      <HiOutlineLockClosed className="w-5 h-5" />
                    }
                  />

                  <Input
                    label="Confirm Password"
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    variant="glass"
                    icon={
                      <HiCheck className="w-5 h-5" />
                    }
                  />
                </div>

                {/* Password Requirements */}
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Password Requirements:</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li className="flex items-center">
                      <HiCheck className="w-3 h-3 mr-2 text-blue-600" strokeWidth={3} />
                      At least 6 characters long
                    </li>
                    <li className="flex items-center">
                      <HiCheck className="w-3 h-3 mr-2 text-blue-600" strokeWidth={3} />
                      Use a unique password for this account
                    </li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={loading}
                    variant="gradient"
                    size="lg"
                    className="w-full"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </div>
              </form>

              {/* Sign In Link */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link
                      href="/login"
                      className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center animate-fadeInUp" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-gray-500">
              By creating an account, you agree to our Terms of Service
            </p>
            <div className="flex items-center justify-center mt-4 space-x-6 text-xs text-gray-400">
              <div className="flex items-center">
                <HiOutlineShieldCheck className="w-4 h-4 mr-1" />
                Secure Registration
              </div>
              <div className="flex items-center">
                <HiOutlineInbox className="w-4 h-4 mr-1" />
                No Spam Policy
              </div>
              <div className="flex items-center">
                <HiOutlineHeart className="w-4 h-4 mr-1" />
                100% Free
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 