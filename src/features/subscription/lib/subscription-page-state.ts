import type {
  SubscriptionPageViewModel,
  SubscriptionPlanViewModel,
} from '@/features/subscription/types/subscription-page-view-model';
import { sortPlansByPrice } from '@/features/subscription/lib/plan-order';

export interface SubscriptionPageState {
  status: 'loading' | 'ready' | 'error';
  plans: SubscriptionPlanViewModel[];
  currentSubscription: SubscriptionPageViewModel['currentSubscription'];
  isPremium: boolean;
  selectedPlan: SubscriptionPlanViewModel | null;
  paymentLoading: boolean;
}

export type SubscriptionPageAction =
  | { type: 'patch'; value: Partial<SubscriptionPageState> }
  | { type: 'loadStart' }
  | { type: 'loadSuccess'; value: SubscriptionPageViewModel }
  | { type: 'loadError' };

export const initialSubscriptionPageState: SubscriptionPageState = {
  status: 'loading',
  plans: [],
  currentSubscription: null,
  isPremium: false,
  selectedPlan: null,
  paymentLoading: false,
};

export function subscriptionPageReducer(
  state: SubscriptionPageState,
  action: SubscriptionPageAction,
): SubscriptionPageState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loadStart':
      return { ...state, status: 'loading' };
    case 'loadSuccess':
      return {
        ...state,
        status: 'ready',
        plans: sortPlansByPrice(action.value.plans),
        currentSubscription: action.value.currentSubscription,
        isPremium: action.value.isPremium,
      };
    case 'loadError':
      return { ...state, status: 'error' };
    default:
      return state;
  }
}
