'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  HiOutlineUser,
  HiOutlineLockClosed,
  HiOutlinePhotograph,
  HiOutlineCalendar,
  HiOutlineMail,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineTrash,
} from '@/components/icons';

interface ProfileData {
  email: string;
  displayName: string;
  bio: string;
  avatar: string;
  role: string;
  createdAt: string;
  subscription?: {
    type: string;
    isActive: boolean;
    endDate?: string;
  };
}

interface ProfileSettingsState {
  profile: ProfileData | null;
  loading: boolean;
  displayName: string;
  bio: string;
  savingProfile: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showNewPassword: boolean;
  savingPassword: boolean;
  uploadingAvatar: boolean;
  showRemoveAvatarConfirm: boolean;
}

type ProfileSettingsAction =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; profile: ProfileData }
  | { type: 'fetch:error' }
  | { type: 'profile:setField'; field: 'displayName' | 'bio'; value: string }
  | { type: 'profile:save:start' }
  | { type: 'profile:save:success'; profile: ProfileData }
  | { type: 'profile:save:finish' }
  | {
      type: 'password:setField';
      field: 'currentPassword' | 'newPassword' | 'confirmPassword';
      value: string;
    }
  | { type: 'password:toggleVisibility' }
  | { type: 'password:save:start' }
  | { type: 'password:save:success' }
  | { type: 'password:save:finish' }
  | { type: 'avatar:upload:start' }
  | { type: 'avatar:update'; avatar: string }
  | { type: 'avatar:upload:finish' }
  | { type: 'avatar:confirm:open' }
  | { type: 'avatar:confirm:close' };

const initialState: ProfileSettingsState = {
  profile: null,
  loading: true,
  displayName: '',
  bio: '',
  savingProfile: false,
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  showNewPassword: false,
  savingPassword: false,
  uploadingAvatar: false,
  showRemoveAvatarConfirm: false,
};

function profileSettingsReducer(
  state: ProfileSettingsState,
  action: ProfileSettingsAction,
): ProfileSettingsState {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true };
    case 'fetch:success':
      return {
        ...state,
        profile: action.profile,
        displayName: action.profile.displayName || '',
        bio: action.profile.bio || '',
        loading: false,
      };
    case 'fetch:error':
      return { ...state, loading: false };
    case 'profile:setField':
      return { ...state, [action.field]: action.value };
    case 'profile:save:start':
      return { ...state, savingProfile: true };
    case 'profile:save:success':
      return {
        ...state,
        profile: state.profile ? { ...state.profile, ...action.profile } : action.profile,
        displayName: action.profile.displayName || '',
        bio: action.profile.bio || '',
        savingProfile: false,
      };
    case 'profile:save:finish':
      return { ...state, savingProfile: false };
    case 'password:setField':
      return { ...state, [action.field]: action.value };
    case 'password:toggleVisibility':
      return { ...state, showNewPassword: !state.showNewPassword };
    case 'password:save:start':
      return { ...state, savingPassword: true };
    case 'password:save:success':
      return {
        ...state,
        savingPassword: false,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      };
    case 'password:save:finish':
      return { ...state, savingPassword: false };
    case 'avatar:upload:start':
      return { ...state, uploadingAvatar: true };
    case 'avatar:update':
      return {
        ...state,
        profile: state.profile ? { ...state.profile, avatar: action.avatar } : state.profile,
        uploadingAvatar: false,
        showRemoveAvatarConfirm: false,
      };
    case 'avatar:upload:finish':
      return { ...state, uploadingAvatar: false };
    case 'avatar:confirm:open':
      return { ...state, showRemoveAvatarConfirm: true };
    case 'avatar:confirm:close':
      return { ...state, showRemoveAvatarConfirm: false };
    default:
      return state;
  }
}

function JoinDateLabel({ value }: { value: string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    setLabel(new Date(value).toLocaleDateString());
  }, [value]);

  return <span suppressHydrationWarning>{label}</span>;
}

function PersonalInfoSection({
  bio,
  displayName,
  fileInputRef,
  initials,
  onBioChange,
  onChangeAvatar,
  onDisplayNameChange,
  onRequestRemoveAvatar,
  onSaveProfile,
  profile,
  savingProfile,
  t,
  uploadingAvatar,
}: {
  bio: string;
  displayName: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  initials: string;
  onBioChange: (value: string) => void;
  onChangeAvatar: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDisplayNameChange: (value: string) => void;
  onRequestRemoveAvatar: () => void;
  onSaveProfile: () => void;
  profile: ProfileData;
  savingProfile: boolean;
  t: (key: string) => string;
  uploadingAvatar: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <HiOutlineUser className="size-5 text-brand-trust" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('personalInfo')}</h2>
        </div>
      </div>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-5">
          <div className="group relative">
            {profile.avatar ? (
              <Image
                src={profile.avatar}
                alt="Avatar"
                width={80}
                height={80}
                className="size-20 rounded-full border-2 border-neutral-200 object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full border-2 border-neutral-200 bg-brand-trust text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <HiOutlinePhotograph className="size-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Upload avatar"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onChangeAvatar}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <HiOutlinePhotograph className="mr-1.5 size-4" />
              {uploadingAvatar ? t('uploading') : t('changeAvatar')}
            </Button>
            {profile.avatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRequestRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                <HiOutlineTrash className="mr-1.5 size-4" />
                {t('removeAvatar')}
              </Button>
            )}
          </div>
        </div>

        <Input
          label={t('displayName')}
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          placeholder={t('displayNamePlaceholder')}
          maxLength={50}
          icon={<HiOutlineUser className="size-full" />}
        />

        <div>
          <Textarea
            label={t('bioLabel')}
            value={bio}
            onChange={(event) => onBioChange(event.target.value)}
            placeholder={t('bioPlaceholder')}
            maxLength={160}
            className="min-h-[80px]"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">{bio.length}/160</p>
        </div>

        <Input
          label={t('emailLabel')}
          value={profile.email}
          readOnly
          disabled
          icon={<HiOutlineMail className="size-full" />}
        />

        <div>
          <label className="mb-1 block text-[12px] font-semibold text-neutral-700">
            {t('joinDate')}
          </label>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <HiOutlineCalendar className="size-4 text-neutral-400" />
            <JoinDateLabel value={profile.createdAt} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onSaveProfile} disabled={savingProfile}>
            {savingProfile ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PasswordSection({
  confirmPassword,
  currentPassword,
  newPassword,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSavePassword,
  onTogglePasswordVisibility,
  savingPassword,
  showNewPassword,
  t,
}: {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSavePassword: () => void;
  onTogglePasswordVisibility: () => void;
  savingPassword: boolean;
  showNewPassword: boolean;
  t: (key: string) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <HiOutlineLockClosed className="size-5 text-brand-trust" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('changePassword')}</h2>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <Input
          label={t('currentPassword')}
          type="password"
          value={currentPassword}
          onChange={(event) => onCurrentPasswordChange(event.target.value)}
          placeholder={t('currentPasswordPlaceholder')}
          autoComplete="current-password"
          icon={<HiOutlineLockClosed className="size-full" />}
          iconPosition="left"
        />

        <Input
          label={t('newPassword')}
          type={showNewPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          autoComplete="new-password"
          icon={<HiOutlineLockClosed className="size-full" />}
          error={
            newPassword.length > 0 && newPassword.length < 6 ? t('passwordMinLength') : undefined
          }
        />
        <button
          type="button"
          onClick={onTogglePasswordVisibility}
          className="-mt-2 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
        >
          {showNewPassword ? (
            <HiOutlineEyeOff className="size-3.5" />
          ) : (
            <HiOutlineEye className="size-3.5" />
          )}
          {showNewPassword ? t('hidePassword') : t('showPassword')}
        </button>

        <Input
          label={t('confirmNewPassword')}
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder={t('confirmNewPasswordPlaceholder')}
          autoComplete="new-password"
          icon={<HiOutlineLockClosed className="size-full" />}
          error={
            confirmPassword.length > 0 && confirmPassword !== newPassword
              ? t('passwordsDoNotMatch')
              : undefined
          }
        />

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={onSavePassword}
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {savingPassword ? t('saving') : t('updatePassword')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AccountSection({ profile, t }: { profile: ProfileData; t: (key: string) => string }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <HiOutlineShieldCheck className="size-5 text-brand-trust" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('accountSection')}</h2>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            <HiOutlineSparkles className="size-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{t('subscription')}</p>
              <p className="text-xs text-neutral-500">
                {profile.subscription?.isActive ? t('premiumActive') : t('freePlan')}
              </p>
            </div>
          </div>
          <Link href="/subscription">
            <Button type="button" variant="outline" size="sm">
              {profile.subscription?.isActive ? t('managePlan') : t('upgradePlan')}
            </Button>
          </Link>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">{t('accountType')}</span>
            <span className="capitalize font-medium text-neutral-900">{profile.role}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">{t('emailLabel')}</span>
            <span className="font-medium text-neutral-900">{profile.email}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">{t('joinDate')}</span>
            <span className="font-medium text-neutral-900">
              <JoinDateLabel value={profile.createdAt} />
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ProfileSettings() {
  const { data: session } = useSession();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(profileSettingsReducer, initialState);

  useEffect(() => {
    if (!session) {
      return;
    }

    let isActive = true;

    const fetchProfile = async () => {
      try {
        dispatch({ type: 'fetch:start' });
        const data = await fetchApiData<ProfileData>('/api/user/profile');

        if (!isActive) {
          return;
        }

        dispatch({ type: 'fetch:success', profile: data });
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        dispatch({ type: 'fetch:error' });
        toast.error(extractUnknownErrorMessage(error, t('errorLoadingProfile')));
      }
    };

    fetchProfile();

    return () => {
      isActive = false;
    };
  }, [session, t]);

  const handleSaveProfile = async () => {
    dispatch({ type: 'profile:save:start' });

    try {
      const data = await fetchApiData<ProfileData>('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: state.displayName, bio: state.bio }),
      });
      dispatch({ type: 'profile:save:success', profile: data });
      toast.success(t('profileUpdated'));
    } catch (error: unknown) {
      dispatch({ type: 'profile:save:finish' });
      toast.error(extractUnknownErrorMessage(error, t('errorUpdatingProfile')));
    }
  };

  const handleChangePassword = async () => {
    if (state.newPassword !== state.confirmPassword) {
      toast.error(t('passwordsDoNotMatch'));
      return;
    }

    if (state.newPassword.length < 6) {
      toast.error(t('passwordMinLength'));
      return;
    }

    dispatch({ type: 'password:save:start' });

    try {
      await fetchApiData<null>('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: state.currentPassword,
          newPassword: state.newPassword,
        }),
      });
      dispatch({ type: 'password:save:success' });
      toast.success(t('passwordChanged'));
    } catch (error: unknown) {
      dispatch({ type: 'password:save:finish' });
      toast.error(extractUnknownErrorMessage(error, t('errorChangingPassword')));
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(t('avatarInvalidType'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'));
      return;
    }

    dispatch({ type: 'avatar:upload:start' });

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const data = await fetchApiData<{ avatar: string }>('/api/user/avatar', {
        method: 'PUT',
        body: formData,
      });
      dispatch({ type: 'avatar:update', avatar: data.avatar });
      toast.success(t('avatarUpdated'));
    } catch (error: unknown) {
      dispatch({ type: 'avatar:upload:finish' });
      toast.error(extractUnknownErrorMessage(error, t('errorUploadingAvatar')));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    dispatch({ type: 'avatar:upload:start' });

    try {
      await fetchApiData<null>('/api/user/avatar', { method: 'DELETE' });
      dispatch({ type: 'avatar:update', avatar: '' });
      toast.success(t('avatarRemoved'));
    } catch (error: unknown) {
      dispatch({ type: 'avatar:upload:finish' });
      toast.error(extractUnknownErrorMessage(error, t('errorRemovingAvatar')));
    }
  };

  if (state.loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  if (!state.profile) {
    return null;
  }

  const initials = state.profile.displayName
    ? state.profile.displayName.charAt(0).toUpperCase()
    : state.profile.email.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <PersonalInfoSection
        bio={state.bio}
        displayName={state.displayName}
        fileInputRef={fileInputRef}
        initials={initials}
        onBioChange={(value) => dispatch({ type: 'profile:setField', field: 'bio', value })}
        onChangeAvatar={handleAvatarUpload}
        onDisplayNameChange={(value) =>
          dispatch({ type: 'profile:setField', field: 'displayName', value })
        }
        onRequestRemoveAvatar={() => dispatch({ type: 'avatar:confirm:open' })}
        onSaveProfile={handleSaveProfile}
        profile={state.profile}
        savingProfile={state.savingProfile}
        t={t}
        uploadingAvatar={state.uploadingAvatar}
      />

      <PasswordSection
        confirmPassword={state.confirmPassword}
        currentPassword={state.currentPassword}
        newPassword={state.newPassword}
        onConfirmPasswordChange={(value) =>
          dispatch({ type: 'password:setField', field: 'confirmPassword', value })
        }
        onCurrentPasswordChange={(value) =>
          dispatch({ type: 'password:setField', field: 'currentPassword', value })
        }
        onNewPasswordChange={(value) =>
          dispatch({ type: 'password:setField', field: 'newPassword', value })
        }
        onSavePassword={handleChangePassword}
        onTogglePasswordVisibility={() => dispatch({ type: 'password:toggleVisibility' })}
        savingPassword={state.savingPassword}
        showNewPassword={state.showNewPassword}
        t={t}
      />

      <AccountSection profile={state.profile} t={t} />

      <ConfirmModal
        isOpen={state.showRemoveAvatarConfirm}
        title={t('removeAvatarConfirmTitle')}
        message={t('removeAvatarConfirmMessage')}
        confirmText={t('removeAvatar')}
        onCancel={() => dispatch({ type: 'avatar:confirm:close' })}
        onConfirm={handleRemoveAvatar}
        isLoading={state.uploadingAvatar}
      />
    </div>
  );
}
