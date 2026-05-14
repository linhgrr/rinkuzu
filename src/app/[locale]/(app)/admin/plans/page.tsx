'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchApiData } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import Sidebar from '@/components/Sidebar';
import {
  SubscriptionDurationType,
  PREDEFINED_DURATIONS,
  DurationUtils,
} from '@/types/subscription';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { HiOutlinePlus, HiOutlineCheck, HiOutlineX } from '@/components/icons';
import Navigation from '@/components/Navigation';

interface Plan {
  _id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  durationInfo?: {
    iso8601: string;
    displayName: string;
    months?: number;
  };
  isLifetime?: boolean;
}

interface NewPlanForm {
  name: string;
  price: number | '';
  duration: string;
  features: string[];
  isActive: boolean;
}

export default function AdminPlansPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { data: _session } = useSession();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Plan>>({});
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [featureToRemove, setFeatureToRemove] = useState<{
    index: number;
    isCreate: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New plan creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<NewPlanForm>({
    name: '',
    price: '',
    duration: SubscriptionDurationType.MONTHLY,
    features: [''],
    isActive: true,
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApiData<Plan[]>('/api/admin/plans');
      setPlans(data);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan._id);
    setEditForm({
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      features: [...plan.features],
      isActive: plan.isActive,
    });
  };

  const handleCancelEdit = () => {
    setEditingPlan(null);
    setEditForm({});
  };

  const handleSaveEdit = async (planId: string) => {
    try {
      await fetchApiData(`/api/admin/plans`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: planId,
          ...editForm,
        }),
      });
      setPlans(plans.map((plan) => (plan._id === planId ? { ...plan, ...editForm } : plan)));
      setSuccess('Plan updated successfully');
      setEditingPlan(null);
      setEditForm({});
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update plan');
    }
  };

  const handleCreatePlan = async () => {
    if (!createForm.name.trim() || !createForm.price || createForm.price <= 0) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      await fetchApiData('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          price: Number(createForm.price),
          duration: createForm.duration,
          features: createForm.features.filter((f) => f.trim() !== ''),
          isActive: createForm.isActive,
        }),
      });
      setSuccess('Plan created successfully');
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        price: '',
        duration: SubscriptionDurationType.MONTHLY,
        features: [''],
        isActive: true,
      });
      fetchPlans(); // Refresh plans list
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create plan');
    } finally {
      setCreateLoading(false);
    }
  };

  const deletePlan = async (planId: string, _planName: string) => {
    try {
      setDeleting(true);
      await fetchApiData('/api/admin/plans', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: planId }),
      });
      setPlans(plans.filter((plan) => plan._id !== planId));
      setSuccess('Plan deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete plan');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletePlan = async () => {
    if (!planToDelete) return;
    await deletePlan(planToDelete.id, planToDelete.name);
    setPlanToDelete(null);
  };

  const _handleDeletePlan = (planId: string, planName: string) => {
    setPlanToDelete({ id: planId, name: planName });
  };

  const handleFeatureChange = (index: number, value: string, isCreate = false) => {
    if (isCreate) {
      const newFeatures = [...createForm.features];
      newFeatures[index] = value;
      setCreateForm({ ...createForm, features: newFeatures });
    } else {
      const newFeatures = [...(editForm.features || [])];
      newFeatures[index] = value;
      setEditForm({ ...editForm, features: newFeatures });
    }
  };

  const addFeature = (isCreate = false) => {
    if (isCreate) {
      setCreateForm({
        ...createForm,
        features: [...createForm.features, ''],
      });
    } else {
      setEditForm({
        ...editForm,
        features: [...(editForm.features || []), ''],
      });
    }
  };

  const removeFeature = (index: number, isCreate = false) => {
    if (isCreate) {
      const newFeatures = [...createForm.features];
      newFeatures.splice(index, 1);
      setCreateForm({ ...createForm, features: newFeatures });
    } else {
      const newFeatures = [...(editForm.features || [])];
      newFeatures.splice(index, 1);
      setEditForm({ ...editForm, features: newFeatures });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getDurationDisplay = (duration: string) => {
    try {
      if (DurationUtils.isValidISO8601Duration(duration)) {
        const info = DurationUtils.getDurationInfo(duration);
        return info.displayName;
      }
      // Fallback for legacy durations
      if (duration === '0') return 'Lifetime';
      if (duration === '6') return '6 Months';
      if (duration === '12') return '1 Year';
      return `${duration} Months`;
    } catch {
      return duration;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main
        className={`py-8 transition-[margin] duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} max-w-none px-4 sm:px-6 lg:px-8`}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
              <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-semibold text-neutral-900">{t('plans')}</h1>
                <p className="mt-2 text-neutral-600">Manage subscription plans and pricing</p>
              </div>
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="default"
                className="flex min-h-[44px] items-center gap-2 rounded-full px-5 shadow-md"
                title="Create New Plan"
              >
                <HiOutlinePlus className="size-5" />
                Add Plan
              </Button>
            </div>

            {/* Create Plan Modal */}
            <Modal
              isOpen={showCreateForm}
              onClose={() => setShowCreateForm(false)}
              title="Create New Subscription Plan"
              description="Add a new subscription plan with ISO 8601 duration format"
              size="medium"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreatePlan();
                }}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="create-plan-name"
                        className="block text-sm font-medium text-neutral-700 mb-2"
                      >
                        Plan Name *
                      </label>
                      <Input
                        id="create-plan-name"
                        type="text"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="e.g., Premium Monthly"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="create-plan-price"
                        className="block text-sm font-medium text-neutral-700 mb-2"
                      >
                        Price (VND) *
                      </label>
                      <Input
                        id="create-plan-price"
                        type="number"
                        value={createForm.price}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            price: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        placeholder="99000"
                        min="0"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="create-plan-duration"
                        className="block text-sm font-medium text-neutral-700 mb-2"
                      >
                        Duration *
                      </label>
                      <select
                        id="create-plan-duration"
                        value={createForm.duration}
                        onChange={(e) => setCreateForm({ ...createForm, duration: e.target.value })}
                        className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-brand-trust focus:border-green-500"
                        title="Select plan duration"
                      >
                        {Object.entries(PREDEFINED_DURATIONS).map(([key, duration]) => (
                          <option key={key} value={duration.iso8601}>
                            {duration.displayName} ({duration.iso8601})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="create-plan-status"
                        className="block text-sm font-medium text-neutral-700 mb-2"
                      >
                        Status
                      </label>
                      <select
                        id="create-plan-status"
                        value={createForm.isActive.toString()}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, isActive: e.target.value === 'true' })
                        }
                        className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-brand-trust focus:border-green-500"
                        title="Select plan status"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="block text-sm font-medium text-neutral-700 mb-2">Features</p>
                    {createForm.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-x-2 mb-2">
                        <Input
                          type="text"
                          value={feature}
                          onChange={(e) => handleFeatureChange(index, e.target.value, true)}
                          placeholder="Enter feature"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() => setFeatureToRemove({ index, isCreate: true })}
                          variant="outline"
                          size="sm"
                          className="min-h-[36px] px-3 text-red-600 hover:text-red-700"
                          title="Remove this feature"
                        >
                          <span className="sr-only">Remove this feature</span>
                          <HiOutlineX className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      onClick={() => addFeature(true)}
                      variant="outline"
                      size="sm"
                      className="mt-2 min-h-[36px] px-3"
                    >
                      <HiOutlinePlus className="size-4 mr-1" /> Add Feature
                    </Button>
                  </div>
                  <div className="flex justify-end gap-x-2 pt-4">
                    <Button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      variant="outline"
                      className="min-h-[40px] px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createLoading}
                      className="min-h-[40px] bg-brand-trust px-4 text-white hover:bg-brand-trust-hover"
                    >
                      {createLoading ? 'Creating…' : tCommon('create') + ' Plan'}
                    </Button>
                  </div>
                </div>
              </form>
            </Modal>

            {/* End Create Plan Modal */}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {/* Plans Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
                  <div className="text-sm text-neutral-500">{t('loadingStatistics')}</div>
                </div>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-neutral-500">{t('noUsersFound')}</div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <Card key={plan._id} className="relative">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          {editingPlan === plan._id ? (
                            <Input
                              value={editForm.name || ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="text-xl font-bold"
                            />
                          ) : (
                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                          )}
                          <CardDescription className="mt-2">
                            {getDurationDisplay(plan.duration)}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-x-2">
                          <span
                            className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium ${
                              plan.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {plan.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Price */}
                      <div className="mb-6">
                        {editingPlan === plan._id ? (
                          <div className="space-y-2">
                            <label
                              htmlFor={`edit-plan-price-${plan._id}`}
                              className="block text-sm font-medium text-neutral-700"
                            >
                              Price (VND)
                            </label>
                            <Input
                              id={`edit-plan-price-${plan._id}`}
                              type="number"
                              value={editForm.price || 0}
                              onChange={(e) =>
                                setEditForm({ ...editForm, price: parseInt(e.target.value) })
                              }
                              className="text-2xl font-bold"
                            />
                          </div>
                        ) : (
                          <div className="text-3xl font-bold text-neutral-900">
                            {formatCurrency(plan.price)}
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-neutral-900">Features:</h4>
                        {editingPlan === plan._id ? (
                          <div className="space-y-2">
                            {(editForm.features || []).map((feature, index) => (
                              <div key={index} className="flex items-center gap-x-2">
                                <Input
                                  value={feature}
                                  onChange={(e) => handleFeatureChange(index, e.target.value)}
                                  placeholder="Feature description"
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setFeatureToRemove({ index, isCreate: false })}
                                  className="min-h-[36px] px-3 text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addFeature(false)}
                              className="min-h-[36px] w-full px-3"
                            >
                              Add Feature
                            </Button>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {plan.features.map((feature, index) => (
                              <li
                                key={index}
                                className="flex items-center text-sm text-neutral-600"
                              >
                                <HiOutlineCheck className="size-4 mr-2 text-green-500" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Status Toggle */}
                      {editingPlan === plan._id && (
                        <div className="mt-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={editForm.isActive || false}
                              onChange={(e) =>
                                setEditForm({ ...editForm, isActive: e.target.checked })
                              }
                              className="mr-2 size-4 rounded border-neutral-300 text-brand-trust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            />
                            <span className="text-sm text-neutral-700">Active</span>
                          </label>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-6 flex gap-x-2">
                        {editingPlan === plan._id ? (
                          <>
                            <Button
                              onClick={() => handleSaveEdit(plan._id)}
                              className="min-h-[40px] flex-1 px-4"
                              variant="gradient"
                            >
                              Save Changes
                            </Button>
                            <Button
                              onClick={handleCancelEdit}
                              variant="outline"
                              className="min-h-[40px] flex-1 px-4"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => handleEdit(plan)}
                            variant="outline"
                            className="min-h-[40px] w-full px-4"
                          >
                            Edit Plan
                          </Button>
                        )}
                      </div>

                      {/* Plan Info */}
                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        <div className="text-xs text-neutral-500 space-y-1">
                          <div suppressHydrationWarning>
                            {t('created')}: {new Date(plan.createdAt).toLocaleDateString()}
                          </div>
                          <div suppressHydrationWarning>
                            {t('updated')}: {new Date(plan.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <ConfirmModal
        isOpen={!!planToDelete}
        title="Delete plan?"
        message={
          planToDelete
            ? `Are you sure you want to delete the plan "${planToDelete.name}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={deleting}
        onCancel={() => setPlanToDelete(null)}
        onConfirm={confirmDeletePlan}
      />
      <ConfirmModal
        isOpen={!!featureToRemove}
        title="Remove feature?"
        message={
          featureToRemove
            ? `Remove feature ${featureToRemove.index + 1}? This change is not saved until you save the plan.`
            : ''
        }
        confirmText="Remove"
        confirmVariant="destructive"
        onCancel={() => setFeatureToRemove(null)}
        onConfirm={() => {
          if (!featureToRemove) return;
          removeFeature(featureToRemove.index, featureToRemove.isCreate);
          setFeatureToRemove(null);
        }}
      />
    </div>
  );
}
