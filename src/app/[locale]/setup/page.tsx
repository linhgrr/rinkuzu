'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

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
  } | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/admin/setup');
      const data = await response.json();

      if (data.success) {
        setSetupStatus(data.data);
      } else {
        setError('Failed to check setup status');
      }
    } catch (error) {
      setError('Failed to check setup status');
    } finally {
      setLoading(false);
    }
  };

  const createAdminAccount = async () => {
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(data.error || 'Failed to create admin account');
      }
    } catch (error) {
      setError('Failed to create admin account');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking setup status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">RinKuzu Setup</h1>
          <p className="mt-2 text-gray-600">Initial application setup</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {setupStatus?.adminExists ? '✅ Setup Complete' : '🚀 Admin Setup Required'}
            </CardTitle>
            <CardDescription className="text-center">
              {setupStatus?.adminExists 
                ? 'Admin account already exists' 
                : 'Create the first admin account to get started'
              }
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
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Setup Already Complete
                  </h3>
                  <p className="text-gray-600 mb-4">
                    An admin account already exists. You can proceed to login.
                  </p>
                </div>
                
                <div className="flex space-x-4">
                  <Link href="/login" className="flex-1">
                    <Button className="w-full">
                      Go to Login
                    </Button>
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
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Default Admin Account
                  </h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p><strong>Email:</strong> admin@quizcreator.com</p>
                    <p><strong>Password:</strong> linhdzqua148</p>
                    <p className="text-xs mt-2 text-blue-600">
                      ⚠️ Please change the password after first login
                    </p>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <p><strong>System Status:</strong></p>
                  <ul className="mt-2 space-y-1">
                    <li>• Admin exists: {setupStatus.adminExists ? 'Yes' : 'No'}</li>
                    <li>• Total users: {setupStatus.userCount}</li>
                    <li>• Setup allowed: {setupStatus.setupAllowed ? 'Yes' : 'No'}</li>
                  </ul>
                </div>

                <Button 
                  onClick={createAdminAccount}
                  loading={creating}
                  className="w-full"
                >
                  {creating ? 'Creating Admin Account...' : 'Create Admin Account'}
                </Button>

                <div className="text-center">
                  <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
                    ← Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🔒</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Setup Not Allowed
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Admin setup is only allowed for new installations or when no admin exists.
                  </p>
                </div>
                
                <div className="text-sm text-gray-600">
                  <p><strong>Current Status:</strong></p>
                  <ul className="mt-2 space-y-1">
                    <li>• Admin exists: {setupStatus?.adminExists ? 'Yes' : 'No'}</li>
                    <li>• Total users: {setupStatus?.userCount}</li>
                  </ul>
                </div>

                <div className="flex space-x-4">
                  <Link href="/login" className="flex-1">
                    <Button className="w-full">
                      Login
                    </Button>
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
            <div className="text-center text-xs text-gray-500">
              <p className="font-semibold mb-1">🔐 Security Notice</p>
              <p>
                This setup page is only available for initial installation.
                After creating an admin account, please change the default password immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 