import type { AccountProfileDto, AvatarResponseDto } from '@/dtos/account';
import { fetchApiData } from '@/lib/api/client';
import { toProfileSettingsViewModel } from '@/features/profile/mappers/profile-settings.mapper';
import type {
  ChangeProfilePasswordInput,
  ProfileSettingsViewModel,
  UpdateProfileSettingsInput,
} from '@/features/profile/types/profile-settings-view-model';

export async function fetchProfileSettingsViewModel(): Promise<ProfileSettingsViewModel> {
  const data = await fetchApiData<AccountProfileDto>('/api/user/profile');
  return toProfileSettingsViewModel(data);
}

export async function updateProfileSettingsViewModel(
  input: UpdateProfileSettingsInput,
): Promise<ProfileSettingsViewModel> {
  const data = await fetchApiData<AccountProfileDto>('/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return toProfileSettingsViewModel(data);
}

export async function changeProfilePassword(input: ChangeProfilePasswordInput): Promise<void> {
  await fetchApiData<null>('/api/user/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function uploadProfileAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);
  const data = await fetchApiData<AvatarResponseDto>('/api/user/avatar', {
    method: 'PUT',
    body: formData,
  });
  return data.avatar;
}

export async function removeProfileAvatar(): Promise<void> {
  await fetchApiData<null>('/api/user/avatar', { method: 'DELETE' });
}
