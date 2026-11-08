import { fetchApiData } from '@/lib/api/client';

export interface CreditWalletSummaryViewModel {
  wallet: CreditWalletBalanceViewModel;
}

interface CreditWalletBalanceViewModel {
  balance: number;
}

/** SWR key shared by the header credit pill and the Premium unlock card (RIN-1014). */
export const CREDIT_WALLET_KEY = '/api/credits';

export function fetchCreditWallet(key: string): Promise<CreditWalletSummaryViewModel> {
  return fetchApiData(key, { cache: 'no-store' });
}
