import { SubscriptionService } from '@/services/subscription/SubscriptionService';
import { SubscriptionRepository } from '@/repositories/SubscriptionRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { SubscriptionPlanRepository } from '@/repositories/SubscriptionPlanRepository';
import { PayOSService } from '@/services/payment/PayOSService';

/**
 * Build a fresh `SubscriptionService` along with its dependencies.
 *
 * Keeping subscription composition in its own module lets route handlers and
 * `QuizPlayService` reuse it without circular composition dependencies.
 */
export function createSubscriptionService(): SubscriptionService {
  const subscriptionRepository = new SubscriptionRepository();
  const userRepository = new UserRepository();
  const planRepository = new SubscriptionPlanRepository();
  const payosService = new PayOSService();

  return new SubscriptionService(
    subscriptionRepository,
    userRepository,
    payosService,
    planRepository,
  );
}
