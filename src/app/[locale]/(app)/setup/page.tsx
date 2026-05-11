'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchApiData } from '@/lib/api/client';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setupStatus, setSetupStatus] = useState<{
    adminExists: boolean;
    setupAllowed: boolean;
    userCount: number;
    message?: string;
  } | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const data = await fetchApiData<{
        adminExists: boolean;
        setupAllowed: boolean;
        userCount: number;
        message: string;
      }>('/api/admin/setup');
      setSetupStatus(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to check setup status');
    } finally {
      setLoading(false);
    }
  };

  const createAdminAccount = async () => {
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const data = await fetchApiData<{ message: string }>('/api/admin/setup', {
        method: 'POST',
      });
      setSuccess(data.message);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create admin account');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
          <p className="mt-4 text-neutral-600">Checking setup status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-neutral-900">RinKuzu Setup</h1>
          <p className="mt-2 text-neutral-600">Initial application setup</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {setupStatus?.adminExists ? 'Setup Complete' : 'Admin Setup Required'}
            </CardTitle>
            <CardDescription className="text-center">
              {setupStatus?.adminExists
                ? 'Admin account already exists'
                : 'Create the first admin account to get started'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-md bg-green-50 p-4">
                <div className="text-sm text-green-700">{success}</div>
              </div>
            )}

            {setupStatus?.adminExists ? (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                    OK
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                    Setup Already Complete
                  </h3>
                  <p className="text-neutral-600 mb-4">
                    An admin account already exists. You can proceed to login.
                  </p>
                </div>

                <div className="flex space-x-4">
                  <Link href="/login" className="flex-1">
                    <Button className="w-full">Go to Login</Button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Home
                    </Button>
                  </Link>
                </div>
              </div>
            ) : setupStatus?.setupAllowed ? (
              <div className="space-y-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Default Admin Account
                  </h3>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>
                      <strong>Email:</strong> admin@quizcreator.com
                    </p>
                    <p>
                      <strong>Password:</strong> linhdzqua148
                    </p>
                    <p className="text-xs mt-2 text-brand-trust">
                      Please change the password after first login
                    </p>
                  </div>
                </div>

                <div className="text-sm text-neutral-600">
                  <p>
                    <strong>System Status:</strong>
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>• Admin exists: {setupStatus.adminExists ? 'Yes' : 'No'}</li>
                    <li>• Total users: {setupStatus.userCount}</li>
                    <li>• Setup allowed: {setupStatus.setupAllowed ? 'Yes' : 'No'}</li>
                  </ul>
                </div>

                <Button onClick={createAdminAccount} loading={creating} className="w-full">
                  {creating ? 'Creating Admin Account…' : 'Create Admin Account'}
                </Button>

                <div className="text-center">
                  <Link href="/" className="text-sm text-brand-trust hover:text-green-700">
                    ← Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
                    LOCK
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">Setup Not Allowed</h3>
                  <p className="text-neutral-600 mb-4">
                    Admin setup is only allowed for new installations or when no admin exists.
                  </p>
                </div>

                <div className="text-sm text-neutral-600">
                  <p>
                    <strong>Current Status:</strong>
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>• Admin exists: {setupStatus?.adminExists ? 'Yes' : 'No'}</li>
                    <li>• Total users: {setupStatus?.userCount}</li>
                  </ul>
                </div>

                <div className="flex space-x-4">
                  <Link href="/login" className="flex-1">
                    <Button className="w-full">Login</Button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Home
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center text-xs text-neutral-500">
              <p className="font-semibold mb-1">Security Notice</p>
              <p>
                This setup page is only available for initial installation. After creating an admin
                account, please change the default password immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
