const PROFILE_TAB_IDS = ['overview', 'personal', 'plan', 'security', 'email'] as const;

export type ProfileTab = (typeof PROFILE_TAB_IDS)[number];

export function isProfileTab(value: unknown): value is ProfileTab {
  return typeof value === 'string' && PROFILE_TAB_IDS.some((tab) => tab === value);
}
