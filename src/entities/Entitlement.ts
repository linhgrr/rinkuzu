export interface CurrentEntitlement {
  userId: string;
  planId: string;
  planName: string;
  startDate: Date;
  endDate?: Date;
  perpetual: boolean;
  isActive: boolean;
}
