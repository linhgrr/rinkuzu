'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
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

export default function ProfileSettings() {
  const { data: session } = useSession();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setDisplayName(data.data.displayName || '');
        setBio(data.data.bio || '');
      }
    } catch {
      toast.error(t('errorLoadingProfile'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (session) fetchProfile();
  }, [session, fetchProfile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, ...data.data } : prev));
        toast.success(t('profileUpdated'));
      } else {
        toast.error(data.error || t('errorUpdatingProfile'));
      }
    } catch {
      toast.error(t('errorUpdatingProfile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('passwordMinLength'));
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('passwordChanged'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || t('errorChangingPassword'));
      }
    } catch {
      toast.error(t('errorChangingPassword'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(t('avatarInvalidType'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'));
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('/api/user/avatar', { method: 'PUT', body: formData });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, avatar: data.data.avatar } : prev));
        toast.success(t('avatarUpdated'));
      } else {
        toast.error(data.error || t('errorUploadingAvatar'));
      }
    } catch {
      toast.error(t('errorUploadingAvatar'));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, avatar: '' } : prev));
        toast.success(t('avatarRemoved'));
      } else {
        toast.error(data.error || t('errorRemovingAvatar'));
      }
    } catch {
      toast.error(t('errorRemovingAvatar'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.displayName
    ? profile.displayName.charAt(0).toUpperCase()
    : profile.email.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Section: Personal Info */}
      <Card className="overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <HiOutlineUser className="w-5 h-5 text-brand-trust" />
            <h2 className="text-lg font-semibold text-neutral-900">{t('personalInfo')}</h2>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover border-2 border-neutral-200"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-trust flex items-center justify-center text-white text-2xl font-semibold border-2 border-neutral-200">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <HiOutlinePhotograph className="w-6 h-6 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
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
                <HiOutlinePhotograph className="w-4 h-4 mr-1.5" />
                {uploadingAvatar ? t('uploading') : t('changeAvatar')}
              </Button>
              {profile.avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <HiOutlineTrash className="w-4 h-4 mr-1.5" />
                  {t('removeAvatar')}
                </Button>
              )}
            </div>
          </div>

          {/* Display Name */}
          <Input
            label={t('displayName')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('displayNamePlaceholder')}
            maxLength={50}
            icon={<HiOutlineUser className="w-full h-full" />}
          />

          {/* Bio */}
          <div>
            <Textarea
              label={t('bioLabel')}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('bioPlaceholder')}
              maxLength={160}
              className="min-h-[80px]"
            />
            <p className="text-xs text-neutral-400 mt-1 text-right">{bio.length}/160</p>
          </div>

          {/* Email (read-only) */}
          <Input
            label={t('emailLabel')}
            value={profile.email}
            readOnly
            disabled
            icon={<HiOutlineMail className="w-full h-full" />}
          />

          {/* Join date */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-neutral-700">
              {t('joinDate')}
            </label>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <HiOutlineCalendar className="w-4 h-4 text-neutral-400" />
              {new Date(profile.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Section: Change Password */}
      <Card className="overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <HiOutlineLockClosed className="w-5 h-5 text-brand-trust" />
            <h2 className="text-lg font-semibold text-neutral-900">{t('changePassword')}</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <Input
            label={t('currentPassword')}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t('currentPasswordPlaceholder')}
            autoComplete="current-password"
            icon={<HiOutlineLockClosed className="w-full h-full" />}
            iconPosition="left"
          />

          <Input
            label={t('newPassword')}
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('newPasswordPlaceholder')}
            autoComplete="new-password"
            icon={<HiOutlineLockClosed className="w-full h-full" />}
            error={
              newPassword.length > 0 && newPassword.length < 6 ? t('passwordMinLength') : undefined
            }
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="text-xs text-neutral-500 hover:text-neutral-700 -mt-2 flex items-center gap-1"
          >
            {showNewPassword ? (
              <HiOutlineEyeOff className="w-3.5 h-3.5" />
            ) : (
              <HiOutlineEye className="w-3.5 h-3.5" />
            )}
            {showNewPassword ? t('hidePassword') : t('showPassword')}
          </button>

          <Input
            label={t('confirmNewPassword')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmNewPasswordPlaceholder')}
            autoComplete="new-password"
            icon={<HiOutlineLockClosed className="w-full h-full" />}
            error={
              confirmPassword.length > 0 && confirmPassword !== newPassword
                ? t('passwordsDoNotMatch')
                : undefined
            }
          />

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {savingPassword ? t('saving') : t('updatePassword')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Section: Account */}
      <Card className="overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <HiOutlineShieldCheck className="w-5 h-5 text-brand-trust" />
            <h2 className="text-lg font-semibold text-neutral-900">{t('accountSection')}</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Subscription */}
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
            <div className="flex items-center gap-3">
              <HiOutlineSparkles className="w-5 h-5 text-yellow-500" />
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

          {/* Account Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">{t('accountType')}</span>
              <span className="font-medium text-neutral-900 capitalize">{profile.role}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">{t('emailLabel')}</span>
              <span className="font-medium text-neutral-900">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">{t('joinDate')}</span>
              <span className="font-medium text-neutral-900">
                {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
