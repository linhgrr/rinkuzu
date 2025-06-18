'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

interface User {
  _id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  // Redirect if not admin
  if (!session || (session.user as any)?.role !== 'admin') {
    router.push('/');
    return null;
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (data.success) {
        setUsers(data.data.users);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (error) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser._id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser._id,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUsers(users.map(user => 
          user._id === selectedUser._id ? { ...user, role: newRole } : user
        ));
        setSuccess(`User role updated to ${newRole}`);
        setShowRoleModal(false);
        setSelectedUser(null);
      } else {
        setError(data.error || 'Failed to update user role');
      }
    } catch (error) {
      setError('Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser._id);
    try {
      const response = await fetch(`/api/admin/users?userId=${selectedUser._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setUsers(users.filter(user => user._id !== selectedUser._id));
        setSuccess('User deleted successfully');
        setShowDeleteModal(false);
        setSelectedUser(null);
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (error) {
      setError('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role === 'admin' ? 'user' : 'admin');
    setShowRoleModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                RinKuzu
              </Link>
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                Admin
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/admin/queue">
                <Button variant="outline">Quiz Queue</Button>
              </Link>
              <Link href="/create">
                <Button variant="outline">Create Quiz</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="mt-2 text-gray-600">
              Manage user accounts and permissions
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4 mb-6">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900">
                {users.length}
              </div>
              <p className="text-gray-600">Total Users</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-purple-600">
                {users.filter(u => u.role === 'admin').length}
              </div>
              <p className="text-gray-600">Administrators</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">
                {users.filter(u => u.role === 'user').length}
              </div>
              <p className="text-gray-600">Regular Users</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Manage user roles and accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.email}
                          {user.email === session.user?.email && (
                            <span className="ml-2 text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role === 'admin' ? 'Administrator' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {user.email !== session.user?.email && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRoleModal(user)}
                                disabled={actionLoading === user._id}
                              >
                                {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteModal(user)}
                                disabled={actionLoading === user._id}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Change Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Change User Role"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to change the role of <strong>{selectedUser?.email}</strong> to <strong>{newRole}</strong>?
          </p>
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowRoleModal(false)}
              disabled={actionLoading === selectedUser?._id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              loading={actionLoading === selectedUser?._id}
            >
              Change Role
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the user <strong>{selectedUser?.email}</strong>? This action cannot be undone.
          </p>
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={actionLoading === selectedUser?._id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteUser}
              loading={actionLoading === selectedUser?._id}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 