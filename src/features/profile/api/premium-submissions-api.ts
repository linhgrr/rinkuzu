import { fetchApiData } from '@/lib/api/client';

export type ProfilePremiumSubmissionStatus =
  | 'pending'
  | 'changes_requested'
  | 'rejected'
  | 'approved'
  | 'withdrawn';

export interface ProfilePremiumSubmission {
  sourceQuizId: string;
  version: number;
  status: ProfilePremiumSubmissionStatus;
  awardedCredits: number;
}

interface ProfilePremiumSubmissionList {
  items: ProfilePremiumSubmission[];
}

export async function fetchMyPremiumSubmissions(): Promise<ProfilePremiumSubmission[]> {
  const data = await fetchApiData<ProfilePremiumSubmissionList>(
    '/api/premium-submissions/mine?page=1&limit=100',
  );
  return data.items;
}
