import { fetchApiData } from '@/lib/api/client';

export interface CreditWalletSummaryViewModel {
  wallet: CreditWalletBalanceViewModel;
}

interface CreditWalletBalanceViewModel {
  balance: number;
}

export function fetchCreditWallet(key: string): Promise<CreditWalletSummaryViewModel> {
  return fetchApiData(key, { cache: 'no-store' });
}
