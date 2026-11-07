'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useReducer, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProfileSettingsPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import { AVATAR_ALLOWED_MEDIA_TYPES, AVATAR_MAX_FILE_SIZE } from '@/shared/constants/avatar';
import {
  changeProfilePassword,
  fetchProfileSettingsViewModel,
  removeProfileAvatar,
  updateProfileSettingsViewModel,
  uploadProfileAvatar,
} from '@/features/profile/api/profile-settings-api';
import type { ProfileSettingsViewModel } from '@/features/profile/types/profile-settings-view-model';
import { ProfileQuotaCard } from '@/features/profile/components/ProfileQuotaCard';
import {
  ProfileHero,
  ProfileTabNavigation,
  QuickAccessCard,
} from '@/features/profile/components/ProfileControlCenter';
import type { ProfileTab } from '@/features/profile/lib/profile-tabs';
import {
  GooglePasswordCard,
  PasswordSection,
  firstInvalidPasswordField,
  validatePasswordChange,
  type PasswordField,
  type PasswordFieldErrors,
} from '@/features/profile/components/ProfileSecuritySection';
import { MarketingPreferencesPage } from '@/features/communications/components/MarketingPreferencesPage';
import {
  HiOutlineUser,
  HiOutlinePhotograph,
  HiOutlineMail,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineTrash,
} from 'react-icons/hi';

interface ProfileSettingsState {
  profile: ProfileSettingsViewModel | null;
  loading: boolean;
  displayName: string;
  bio: string;
  savingProfile: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordErrors: PasswordFieldErrors;
  showNewPassword: boolean;
  savingPassword: boolean;
  uploadingAvatar: boolean;
  showRemoveAvatarConfirm: boolean;
}

type ProfileSettingsTranslate = (key: string) => string;

interface PersonalInfoSectionProps {
  bio: string;
  displayName: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  initials: string;
  onBioChange: (value: string) => void;
  onChangeAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
  onDisplayNameChange: (value: string) => void;
  onRequestRemoveAvatar: () => void;
  onSaveProfile: () => void;
  profile: ProfileSettingsViewModel;
  savingProfile: boolean;
  t: ProfileSettingsTranslate;
  uploadingAvatar: boolean;
}

interface AccountSectionProps {
  profile: ProfileSettingsViewModel;
  t: ProfileSettingsTranslate;
}

type ProfileSettingsAction =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; profile: ProfileSettingsViewModel }
  | { type: 'fetch:error' }
  | { type: 'profile:setField'; field: 'displayName' | 'bio'; value: string }
  | { type: 'profile:save:start' }
  | { type: 'profile:save:success'; profile: ProfileSettingsViewModel }
  | { type: 'profile:save:finish' }
  | { type: 'password:setField'; field: PasswordField; value: string }
  | { type: 'password:invalid'; errors: PasswordFieldErrors }
  | { type: 'password:notSet' }
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
  passwordErrors: {},
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
      // Runs once per signed-in user id: start from a clean slate so another
      // user's profile or draft input never shows while the new one loads.
      return initialState;
    case 'fetch:success':
      return {
        ...state,
        profile: action.profile,
        displayName: action.profile.displayName ?? '',
        bio: action.profile.bio ?? '',
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
        displayName: action.profile.displayName ?? '',
        bio: action.profile.bio ?? '',
        savingProfile: false,
      };
    case 'profile:save:finish':
      return { ...state, savingProfile: false };
    case 'password:setField': {
      // Editing a field clears the error it showed; the others stay until resubmit.
      const { [action.field]: _cleared, ...passwordErrors } = state.passwordErrors;
      return { ...state, [action.field]: action.value, passwordErrors };
    }
    case 'password:invalid':
      return { ...state, savingPassword: false, passwordErrors: action.errors };
    case 'password:notSet':
      // The server says there is no password (Google sign-in): swap the form for the info card.
      return {
        ...state,
        profile: state.profile ? { ...state.profile, hasPassword: false } : state.profile,
        savingPassword: false,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        passwordErrors: {},
      };
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
        passwordErrors: {},
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
}: PersonalInfoSectionProps) {
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
              aria-label={t('changeAvatar')}
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <HiOutlinePhotograph className="size-6 text-white" aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              aria-label={t('uploadAvatar')}
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

        <div className="flex justify-end">
          <Button type="button" onClick={onSaveProfile} disabled={savingProfile}>
            {savingProfile ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AccountSection({ profile, t }: AccountSectionProps) {
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
          <Link href="/subscription" className="btn btn-secondary h-9 shrink-0 px-3.5 text-sm">
            {profile.subscription?.isActive ? t('managePlan') : t('upgradePlan')}
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 pt-4 text-sm">
          <span className="text-neutral-500">{t('accountType')}</span>
          <span className="font-medium capitalize text-neutral-900">{profile.role}</span>
        </div>
      </div>
    </Card>
  );
}

export default function ProfileSettings({ initialTab = 'overview' }: { initialTab?: ProfileTab }) {
  const { data: session } = useSession();
  // The SessionProvider poll (refetchInterval) hands out a new session object
  // every few seconds, so effects key on the stable user id, not the object.
  const userId = session?.user?.id;
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(profileSettingsReducer, initialState);
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [syncedInitialTab, setSyncedInitialTab] = useState<ProfileTab>(initialTab);

  // Follow ?tab= changes (browser back/forward, links) without remounting.
  if (initialTab !== syncedInitialTab) {
    setSyncedInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const selectTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    router.replace(
      tab === 'overview'
        ? '/profile'
        : {
            pathname: '/profile',
            query: { tab },
          },
      { scroll: false },
    );
  };

  const showMutationError = useApiErrorToast();
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let isActive = true;

    const fetchProfile = async () => {
      try {
        dispatch({ type: 'fetch:start' });
        setLoadError(null);
        const data = await fetchProfileSettingsViewModel(locale);

        if (!isActive) {
          return;
        }

        dispatch({ type: 'fetch:success', profile: data });
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        dispatch({ type: 'fetch:error' });
        setLoadError(error);
      }
    };

    fetchProfile();

    return () => {
      isActive = false;
    };
  }, [userId, loadAttempt, locale]);

  const handleSaveProfile = async () => {
    dispatch({ type: 'profile:save:start' });

    try {
      const data = await updateProfileSettingsViewModel(
        {
          displayName: state.displayName,
          bio: state.bio,
        },
        locale,
      );
      dispatch({ type: 'profile:save:success', profile: data });
      toast.success(t('profileUpdated'));
    } catch (error: unknown) {
      dispatch({ type: 'profile:save:finish' });
      showMutationError(error);
    }
  };

  const rejectPassword = (errors: PasswordFieldErrors) => {
    dispatch({ type: 'password:invalid', errors });
    const field = firstInvalidPasswordField(errors);
    if (!field) return;
    const fieldRefs = {
      currentPassword: currentPasswordRef,
      newPassword: newPasswordRef,
      confirmPassword: confirmPasswordRef,
    };
    fieldRefs[field].current?.focus();
  };

  const handleChangePassword = async () => {
    const invalid = validatePasswordChange({
      currentPassword: state.currentPassword,
      newPassword: state.newPassword,
      confirmPassword: state.confirmPassword,
    });
    if (firstInvalidPasswordField(invalid)) {
      rejectPassword(invalid);
      return;
    }

    dispatch({ type: 'password:save:start' });

    try {
      await changeProfilePassword({
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
      });
      dispatch({ type: 'password:save:success' });
      toast.success(t('passwordChanged'));
    } catch (error: unknown) {
      // The server text stays hidden. `password_not_set` is an account with no password
      // (Google sign-in). Otherwise a 400 naming no field is a wrong current password;
      // one naming `newPassword` (too short, same as the current one) is about the new one.
      // Those show inline on their field (RIN-1017); network and server errors still toast.
      const described = describeApiError(error);
      if (described.code === 'password_not_set') {
        dispatch({ type: 'password:notSet' });
      } else if (described.kind === 'validation' && described.fieldErrors.includes('newPassword')) {
        rejectPassword({ newPassword: 'newPasswordRejected' });
      } else if (described.kind === 'validation' && described.fieldErrors.length === 0) {
        rejectPassword({ currentPassword: 'currentPasswordIncorrect' });
      } else {
        dispatch({ type: 'password:save:finish' });
        showMutationError(error);
      }
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!AVATAR_ALLOWED_MEDIA_TYPES.some((mediaType) => mediaType === file.type)) {
      toast.error(t('avatarInvalidType'));
      return;
    }

    if (file.size > AVATAR_MAX_FILE_SIZE) {
      toast.error(t('avatarTooLarge'));
      return;
    }

    dispatch({ type: 'avatar:upload:start' });

    try {
      const avatar = await uploadProfileAvatar(file);
      dispatch({ type: 'avatar:update', avatar });
      toast.success(t('avatarUpdated'));
    } catch (error: unknown) {
      dispatch({ type: 'avatar:upload:finish' });
      showMutationError(error);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    dispatch({ type: 'avatar:upload:start' });

    try {
      await removeProfileAvatar();
      dispatch({ type: 'avatar:update', avatar: '' });
      toast.success(t('avatarRemoved'));
    } catch (error: unknown) {
      dispatch({ type: 'avatar:upload:finish' });
      showMutationError(error);
    }
  };

  if (!state.profile) {
    if (state.loading) return <ProfileSettingsPageSkeleton label={tCommon('loading')} />;
    return loadError ? (
      <ErrorState
        error={loadError}
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
        className="mx-auto mt-6 max-w-2xl"
      />
    ) : null;
  }

  const initials = state.profile.displayName
    ? state.profile.displayName.charAt(0).toUpperCase()
    : state.profile.email.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <ProfileHero
        initials={initials}
        onEditProfile={() => selectTab('personal')}
        profile={state.profile}
        t={t}
      />

      <ProfileTabNavigation activeTab={activeTab} onChange={selectTab} t={t} />

      <section
        id={`profile-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeTab}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >
        {activeTab === 'overview' ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <AccountSection profile={state.profile} t={t} />
              <QuickAccessCard t={t} />
            </div>
            <ProfileQuotaCard variant="summary" />
          </div>
        ) : null}

        {activeTab === 'personal' ? (
          <div className="max-w-3xl">
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
          </div>
        ) : null}

        {activeTab === 'plan' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
            <AccountSection profile={state.profile} t={t} />
            <ProfileQuotaCard />
          </div>
        ) : null}

        {activeTab === 'security' ? (
          <div className="max-w-2xl">
            {state.profile.hasPassword === false ? (
              <GooglePasswordCard t={t} />
            ) : (
              <PasswordSection
                errors={state.passwordErrors}
                currentPasswordRef={currentPasswordRef}
                newPasswordRef={newPasswordRef}
                confirmPasswordRef={confirmPasswordRef}
                onFieldChange={(field, value) =>
                  dispatch({ type: 'password:setField', field, value })
                }
                onSavePassword={handleChangePassword}
                onTogglePasswordVisibility={() => dispatch({ type: 'password:toggleVisibility' })}
                savingPassword={state.savingPassword}
                showNewPassword={state.showNewPassword}
                t={t}
                values={{
                  currentPassword: state.currentPassword,
                  newPassword: state.newPassword,
                  confirmPassword: state.confirmPassword,
                }}
              />
            )}
          </div>
        ) : null}

        {activeTab === 'email' ? <MarketingPreferencesPage embedded /> : null}
      </section>

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
