export interface UserIdentity {
  id?: string;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  avatar?: string | null;
}

export function getUserDisplayName(user: UserIdentity): string {
  const trimmedDisplayName = user.displayName?.trim();
  if (trimmedDisplayName) return trimmedDisplayName;

  const trimmedName = user.name?.trim();
  if (trimmedName) return trimmedName;

  if (user.email) {
    const emailLocalPart = user.email.split('@')[0]?.trim();
    if (emailLocalPart) return emailLocalPart;
  }

  return 'User';
}
