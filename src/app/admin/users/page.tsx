'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import Sidebar from '@/components/Sidebar';

interface User {
  _id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  subscription?: {
    type: string;
    startDate?: string;
    endDate?: string;
    isActive: boolean;
  };
}

interface Plan {
  _id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subscriptionDuration, setSubscriptionDuration] = useState(180); // Default 6 months

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    if ((session.user as any)?.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchUsers();
    fetchPlans();
  }, [session, status, router]);

  const fetchUsers = async (page: number = 1, search: string = '') => {
    if (!session) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data.users);
        setPagination({
          page: data.data.pagination.currentPage,
          limit: data.data.pagination.itemsPerPage,
          total: data.data.pagination.totalItems,
          totalPages: data.data.pagination.totalPages
        });
        setError('');
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (error) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/admin/plans');
      const data = await response.json();
      
      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchUsers(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchUsers(newPage, searchTerm);
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

  const handleAddSubscription = async () => {
    if (!selectedUser || !selectedPlanId) return;

    setActionLoading(selectedUser._id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser._id,
          planId: selectedPlanId,
          duration: subscriptionDuration,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update user in the list with new subscription
        setUsers(users.map(user => 
          user._id === selectedUser._id ? { 
            ...user, 
            subscription: {
              type: selectedPlanId,
              startDate: new Date().toISOString(),
              endDate: data.data.endDate,
              isActive: true
            }
          } : user
        ));
        setSuccess(`Subscription added successfully for ${selectedUser.email}`);
        setShowSubscriptionModal(false);
        setSelectedUser(null);
        setSelectedPlanId('');
        setSubscriptionDuration(180);
      } else {
        setError(data.error || 'Failed to add subscription');
      }
    } catch (error) {
      setError('Failed to add subscription');
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

  const openSubscriptionModal = (user: User) => {
    setSelectedUser(user);
    setSelectedPlanId('');
    setSubscriptionDuration(180);
    setShowSubscriptionModal(true);
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  const getSubscriptionBadgeColor = (subscription?: User['subscription']) => {
    if (!subscription) return 'bg-gray-100 text-gray-800';
    if (!subscription.isActive) return 'bg-red-100 text-red-800';
    if (subscription.type === 'lifetime') return 'bg-purple-100 text-purple-800';
    return 'bg-green-100 text-green-800';
  };

  const getSubscriptionText = (subscription?: User['subscription']) => {
    if (!subscription) return 'No Subscription';
    if (!subscription.isActive) return 'Inactive';
    if (subscription.type === 'lifetime') return 'Lifetime';
    return 'Active';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - giống như trang chính */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
              </Link>
              <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                Admin
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {session ? (
                <>
                  <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                    All Quizzes
                  </Link>
                  
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                        <button 
                          onClick={() => signOut()}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
                aria-label="Toggle mobile menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="space-y-2">
                {session ? (
                  <>
                    <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      All Quizzes
                    </Link>
                    <button 
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Sign In
                    </Link>
                    <Link href="/register" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main className={`py-8 transition-all duration-300 ${
        session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
      } max-w-none px-4 sm:px-6 lg:px-8`}>
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : !session ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Redirecting to login...</div>
          </div>
        ) : (session.user as any)?.role !== 'admin' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Access denied. Admin privileges required.</div>
          </div>
        ) : (
        <>
        <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="mt-2 text-gray-600">
              Manage user accounts and permissions
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search users by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" variant="gradient">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </Button>
            {searchTerm && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  fetchUsers(1, '');
                }}
              >
                Clear
              </Button>
            )}
          </form>
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
                {pagination.total}
              </div>
              <p className="text-gray-600">Total Users</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-purple-600">
                {users.filter(u => u.role === 'admin').length}
              </div>
              <p className="text-gray-600">Administrators (Current Page)</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">
                {users.filter(u => u.role === 'user').length}
              </div>
              <p className="text-gray-600">Regular Users (Current Page)</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Showing {users.length} of {pagination.total} users
            {searchTerm && (
              <span className="ml-2">
                matching "<strong>{searchTerm}</strong>"
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
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
                      Subscription
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSubscriptionBadgeColor(user.subscription)}`}>
                            {getSubscriptionText(user.subscription)}
                          </span>
                          {user.subscription?.startDate && (
                            <span className="text-xs text-gray-500">
                              {formatDate(user.subscription.startDate)}
                            </span>
                          )}
                        </div>
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
                                onClick={() => openSubscriptionModal(user)}
                                disabled={actionLoading === user._id}
                                className="text-green-600 border-green-300 hover:bg-green-50"
                              >
                                Add Subscription
                              </Button>
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
                  {searchTerm ? `No users found matching "${searchTerm}"` : 'No users found'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              className="justify-center"
            />
          </div>
        )}
        </div>
        </>
        )}
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

      {/* Add Subscription Modal */}
      <Modal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        title="Add Subscription"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a subscription plan for <strong>{selectedUser?.email}</strong>:
          </p>
          
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan._id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedPlanId === plan._id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedPlanId(plan._id);
                  setSubscriptionDuration(plan.duration === 'lifetime' ? 0 : plan.duration === 'monthly' ? 30 : 180);
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-600">{formatCurrency(plan.price)}</p>
                    <p className="text-xs text-gray-500">{plan.duration}</p>
                  </div>
                  {selectedPlanId === plan._id && (
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedPlanId && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Selected Plan Details:</h4>
              {plans.find(p => p._id === selectedPlanId) && (
                <div className="text-sm text-gray-600">
                  <p><strong>Plan:</strong> {plans.find(p => p._id === selectedPlanId)?.name}</p>
                  <p><strong>Price:</strong> {formatCurrency(plans.find(p => p._id === selectedPlanId)?.price || 0)}</p>
                  <p><strong>Duration:</strong> {plans.find(p => p._id === selectedPlanId)?.duration}</p>
                  <p><strong>Features:</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    {plans.find(p => p._id === selectedPlanId)?.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowSubscriptionModal(false)}
              disabled={actionLoading === selectedUser?._id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSubscription}
              loading={actionLoading === selectedUser?._id}
              disabled={!selectedPlanId}
            >
              Add Subscription
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 