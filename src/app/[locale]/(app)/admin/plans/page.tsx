'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminPlansPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SubscriptionDurationType, PREDEFINED_DURATIONS } from '@/types/subscription';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { HiOutlinePlus, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import {
  createAdminBillingPlan,
  deleteAdminBillingPlan,
  fetchAdminBillingPlanViewModels,
  updateAdminBillingPlan,
} from '@/features/admin/plans/api/admin-plans-api';
import type {
  AdminBillingPlanMutationInput,
  AdminBillingPlanViewModel,
} from '@/features/admin/plans/types/admin-plans-view-model';

interface FeatureField {
  id: string;
  value: string;
}

interface PlanFormState {
  name: string;
  price: number | '';
  duration: string;
  features: FeatureField[];
  isActive: boolean;
}

interface PageStatus {
  loading: boolean;
  error: string;
  success: string;
}

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: AdminBillingPlanMutationInput) => Promise<boolean>;
  createLabel: string;
}

interface PlanCardProps {
  plan: AdminBillingPlanViewModel;
  onSave: (planId: string, payload: AdminBillingPlanMutationInput) => Promise<boolean>;
  onDelete: (planId: string, planName: string) => Promise<boolean>;
}

function createFeatureField(value = ''): FeatureField {
  return { id: crypto.randomUUID(), value };
}

function createPlanFormState(): PlanFormState {
  return {
    name: '',
    price: '',
    duration: SubscriptionDurationType.MONTHLY,
    features: [createFeatureField()],
    isActive: true,
  };
}

function createEditFormState(plan: AdminBillingPlanViewModel): PlanFormState {
  return {
    name: plan.name,
    price: plan.price,
    duration: plan.duration,
    features: plan.features.length
      ? plan.features.map((feature) => createFeatureField(feature))
      : [createFeatureField()],
    isActive: plan.isActive,
  };
}

function serializeFeatureFields(features: FeatureField[]) {
  return features.reduce<string[]>((values, feature) => {
    const normalizedValue = feature.value.trim();
    if (normalizedValue) {
      values.push(normalizedValue);
    }
    return values;
  }, []);
}

function CreatePlanModal({ isOpen, onClose, onCreate, createLabel }: CreatePlanModalProps) {
  const t = useTranslations('admin');
  const [form, setForm] = useState<PlanFormState>(createPlanFormState);
  const [uiState, setUiState] = useState({
    createLoading: false,
    featureToRemoveId: null as string | null,
  });

  const resetForm = () => {
    setForm(createPlanFormState());
    setUiState({
      createLoading: false,
      featureToRemoveId: null,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFeatureChange = (featureId: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((feature) =>
        feature.id === featureId ? { ...feature, value } : feature,
      ),
    }));
  };

  const handleAddFeature = () => {
    setForm((prev) => ({
      ...prev,
      features: [...prev.features, createFeatureField()],
    }));
  };

  const handleRemoveFeature = () => {
    if (!uiState.featureToRemoveId) return;

    setForm((prev) => {
      const nextFeatures = prev.features.filter(
        (feature) => feature.id !== uiState.featureToRemoveId,
      );
      return {
        ...prev,
        features: nextFeatures.length ? nextFeatures : [createFeatureField()],
      };
    });
    setUiState((prev) => ({ ...prev, featureToRemoveId: null }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price || form.price <= 0) return;

    setUiState((prev) => ({ ...prev, createLoading: true }));

    const didCreate = await onCreate({
      name: form.name.trim(),
      price: Number(form.price),
      duration: form.duration,
      features: serializeFeatureFields(form.features),
      isActive: form.isActive,
    });

    setUiState((prev) => ({ ...prev, createLoading: false }));

    if (didCreate) {
      handleClose();
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Create New Subscription Plan"
        description="Add a new subscription plan with ISO 8601 duration format"
        size="medium"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="create-plan-name"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Plan Name *
              </label>
              <Input
                id="create-plan-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('planNamePlaceholder')}
                className="w-full"
              />
            </div>
            <div>
              <label
                htmlFor="create-plan-price"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Price (VND) *
              </label>
              <Input
                id="create-plan-price"
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    price: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                placeholder="99000"
                min="0"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="create-plan-duration"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Duration *
              </label>
              <select
                id="create-plan-duration"
                value={form.duration}
                onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                className="w-full rounded-md border border-neutral-300 p-2 focus:border-green-500 focus:ring-2 focus:ring-brand-trust"
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
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Status
              </label>
              <select
                id="create-plan-status"
                value={form.isActive.toString()}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    isActive: e.target.value === 'true',
                  }))
                }
                className="w-full rounded-md border border-neutral-300 p-2 focus:border-green-500 focus:ring-2 focus:ring-brand-trust"
                title="Select plan status"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 block text-sm font-medium text-neutral-700">Features</p>
            {form.features.map((feature) => (
              <div key={feature.id} className="mb-2 flex items-center gap-x-2">
                <Input
                  type="text"
                  value={feature.value}
                  onChange={(e) => handleFeatureChange(feature.id, e.target.value)}
                  placeholder={t('enterFeature')}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, featureToRemoveId: feature.id }))}
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
              onClick={handleAddFeature}
              variant="outline"
              size="sm"
              className="mt-2 min-h-[36px] px-3"
            >
              <HiOutlinePlus className="mr-1 size-4" /> Add Feature
            </Button>
          </div>

          <div className="flex justify-end gap-x-2 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="min-h-[40px] px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                uiState.createLoading || !form.name.trim() || !form.price || form.price <= 0
              }
              className="min-h-[40px] bg-brand-trust px-4 text-white hover:bg-brand-trust-hover"
            >
              {uiState.createLoading ? 'Creating…' : createLabel}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!uiState.featureToRemoveId}
        title="Remove feature?"
        message="Remove this feature? This change is not saved until you create the plan."
        confirmText="Remove"
        confirmVariant="destructive"
        onCancel={() => setUiState((prev) => ({ ...prev, featureToRemoveId: null }))}
        onConfirm={handleRemoveFeature}
      />
    </>
  );
}

function PlanCard({ plan, onSave, onDelete }: PlanCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PlanFormState>(() => createEditFormState(plan));
  const tPlanCard = useTranslations('admin');
  const [uiState, setUiState] = useState({
    featureToRemoveId: null as string | null,
    showDeleteConfirm: false,
    isDeleting: false,
  });

  const resetForm = () => {
    setForm(createEditFormState(plan));
  };

  const handleStartEdit = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetForm();
    setUiState((prev) => ({ ...prev, featureToRemoveId: null }));
    setIsEditing(false);
  };

  const handleFeatureChange = (featureId: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((feature) =>
        feature.id === featureId ? { ...feature, value } : feature,
      ),
    }));
  };

  const handleAddFeature = () => {
    setForm((prev) => ({
      ...prev,
      features: [...prev.features, createFeatureField()],
    }));
  };

  const handleRemoveFeature = () => {
    if (!uiState.featureToRemoveId) return;

    setForm((prev) => {
      const nextFeatures = prev.features.filter(
        (feature) => feature.id !== uiState.featureToRemoveId,
      );
      return {
        ...prev,
        features: nextFeatures.length ? nextFeatures : [createFeatureField()],
      };
    });
    setUiState((prev) => ({ ...prev, featureToRemoveId: null }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || form.price <= 0) return;

    const didSave = await onSave(plan.id, {
      name: form.name.trim(),
      price: Number(form.price),
      duration: form.duration,
      features: serializeFeatureFields(form.features),
      isActive: form.isActive,
    });

    if (didSave) {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setUiState((prev) => ({ ...prev, isDeleting: true }));
    const didDelete = await onDelete(plan.id, plan.name);
    setUiState((prev) => ({
      ...prev,
      isDeleting: false,
      showDeleteConfirm: didDelete ? false : prev.showDeleteConfirm,
    }));
  };

  return (
    <>
      <Card className="relative">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              {isEditing ? (
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="text-xl font-bold"
                />
              ) : (
                <CardTitle className="text-xl">{plan.name}</CardTitle>
              )}
              <CardDescription className="mt-2">{plan.durationLabel}</CardDescription>
            </div>
            <div className="flex items-center gap-x-2">
              <span
                className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium ${
                  plan.isActive ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            {isEditing ? (
              <div className="space-y-2">
                <label
                  htmlFor={`edit-plan-price-${plan.id}`}
                  className="block text-sm font-medium text-neutral-700"
                >
                  Price (VND)
                </label>
                <Input
                  id={`edit-plan-price-${plan.id}`}
                  type="number"
                  value={form.price}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      price: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  className="text-2xl font-bold"
                />
              </div>
            ) : (
              <div className="text-3xl font-bold text-neutral-900">{plan.priceLabel}</div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-neutral-900">Features:</h4>
            {isEditing ? (
              <div className="space-y-2">
                {form.features.map((feature) => (
                  <div key={feature.id} className="flex items-center gap-x-2">
                    <Input
                      value={feature.value}
                      onChange={(e) => handleFeatureChange(feature.id, e.target.value)}
                      placeholder={tPlanCard('featureDescription')}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setUiState((prev) => ({ ...prev, featureToRemoveId: feature.id }))
                      }
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
                  onClick={handleAddFeature}
                  className="min-h-[36px] w-full px-3"
                >
                  Add Feature
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={`${plan.id}-${feature}`}
                    className="flex items-center text-sm text-neutral-600"
                  >
                    <HiOutlineCheck className="mr-2 size-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isEditing ? (
            <>
              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="mr-2 size-4 rounded border-neutral-300 text-brand-trust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="text-sm text-neutral-700">Active</span>
                </label>
              </div>

              <div className="mt-6 flex gap-x-2">
                <Button
                  onClick={handleSave}
                  className="min-h-[40px] flex-1 px-4"
                  variant="gradient"
                  disabled={!form.name.trim() || !form.price || form.price <= 0}
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
              </div>
            </>
          ) : (
            <div className="mt-6 flex gap-x-2">
              <Button
                onClick={handleStartEdit}
                variant="outline"
                className="min-h-[40px] flex-1 px-4"
              >
                Edit Plan
              </Button>
              <Button
                onClick={() => setUiState((prev) => ({ ...prev, showDeleteConfirm: true }))}
                variant="outline"
                className="min-h-[40px] px-4 text-red-600 hover:text-red-700"
              >
                Delete
              </Button>
            </div>
          )}

          <div className="mt-4 border-t border-neutral-100 pt-4">
            <div className="space-y-1 text-xs text-neutral-500">
              <div>
                Created: <time dateTime={plan.createdAt}>{plan.createdAtLabel}</time>
              </div>
              <div>
                Updated: <time dateTime={plan.updatedAt}>{plan.updatedAtLabel}</time>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={!!uiState.featureToRemoveId}
        title="Remove feature?"
        message="Remove this feature? This change is not saved until you save the plan."
        confirmText="Remove"
        confirmVariant="destructive"
        onCancel={() => setUiState((prev) => ({ ...prev, featureToRemoveId: null }))}
        onConfirm={handleRemoveFeature}
      />

      <ConfirmModal
        isOpen={uiState.showDeleteConfirm}
        title="Delete plan?"
        message={`Are you sure you want to delete the plan "${plan.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={uiState.isDeleting}
        onCancel={() => setUiState((prev) => ({ ...prev, showDeleteConfirm: false }))}
        onConfirm={handleDelete}
      />
    </>
  );
}

export default function AdminPlansPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [plans, setPlans] = useState<AdminBillingPlanViewModel[]>([]);
  const [status, setStatus] = useState<PageStatus>({
    loading: true,
    error: '',
    success: '',
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const pushSuccess = (message: string) => {
    setStatus((prev) => ({ ...prev, success: message, error: '' }));
    globalThis.setTimeout(() => {
      setStatus((prev) => (prev.success === message ? { ...prev, success: '' } : prev));
    }, 3000);
  };

  const refreshPlans = async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      setPlans(await fetchAdminBillingPlanViewModels());
      setStatus((prev) => ({ ...prev, loading: false, error: '' }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    void fetchAdminBillingPlanViewModels(controller.signal)
      .then((data) => {
        setPlans(data);
        setStatus((prev) => ({ ...prev, loading: false, error: '' }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch plans',
        }));
      });

    return () => controller.abort();
  }, []);

  const handleSavePlan = async (planId: string, payload: AdminBillingPlanMutationInput) => {
    try {
      await updateAdminBillingPlan({ planId, payload });
      await refreshPlans();
      pushSuccess('Plan updated successfully');
      return true;
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update plan',
      }));
      return false;
    }
  };

  const handleCreatePlan = async (payload: AdminBillingPlanMutationInput) => {
    try {
      await createAdminBillingPlan(payload);
      await refreshPlans();
      pushSuccess('Plan created successfully');
      return true;
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create plan',
      }));
      return false;
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await deleteAdminBillingPlan(planId);
      setPlans((prev) => prev.filter((plan) => plan.id !== planId));
      pushSuccess('Plan deleted successfully');
      return true;
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete plan',
      }));
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
        {status.loading ? (
          <AdminPlansPageSkeleton />
        ) : (
          <div className="mx-auto max-w-6xl">
            <AdminPageHeader
              title={t('plans')}
              description="Manage subscription plans and pricing"
              actions={
                <Button
                  onClick={() => setShowCreateForm(true)}
                  variant="default"
                  className="flex min-h-[44px] items-center gap-2 rounded-full px-5 shadow-md"
                  title="Create New Plan"
                >
                  <HiOutlinePlus className="size-5" />
                  Add Plan
                </Button>
              }
            />

            <CreatePlanModal
              isOpen={showCreateForm}
              onClose={() => setShowCreateForm(false)}
              onCreate={handleCreatePlan}
              createLabel={`${tCommon('create')} Plan`}
            />

            {status.error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {status.error}
              </div>
            )}

            {status.success && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
                {status.success}
              </div>
            )}

            {plans.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-neutral-500">{t('noUsersFound')}</div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onSave={handleSavePlan}
                    onDelete={(planId) => handleDeletePlan(planId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
