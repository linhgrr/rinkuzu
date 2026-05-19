import { SubscriptionService } from '@/services/subscription/SubscriptionService';
import { SubscriptionRepository } from '@/repositories/SubscriptionRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { PayOSService } from '@/services/payment/PayOSService';

/**
 * Build a fresh `SubscriptionService` along with its dependencies.
 *
 * Lives in its own module so callers (route handlers, ServiceFactory,
 * QuizPlayService) can import it without going through ServiceFactory —
 * which would create a circular import in CommonJS module resolution.
 */
export function createSubscriptionService(): SubscriptionService {
  const subscriptionRepository = new SubscriptionRepository();
  const userRepository = new UserRepository();
  const payosService = new PayOSService();

  return new SubscriptionService(subscriptionRepository, userRepository, payosService);
}
