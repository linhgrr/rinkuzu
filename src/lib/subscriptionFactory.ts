import { SubscriptionRepository } from '@/repositories/SubscriptionRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { PayOSService } from '@/services/payment/PayOSService';
import { SubscriptionService } from '@/services/subscription/SubscriptionService';

export function createSubscriptionService(): SubscriptionService {
  const subscriptionRepository = new SubscriptionRepository();
  const userRepository = new UserRepository();
  const payosService = new PayOSService();

  return new SubscriptionService(subscriptionRepository, userRepository, payosService);
}
