export interface UserProfileData {
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
