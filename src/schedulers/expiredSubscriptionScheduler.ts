import cron from 'node-cron'
import { SubscriptionRepository } from '@/repositories/SubscriptionRepository'
import { UserRepository } from '@/repositories/UserRepository'
import { PayOSService } from '@/services/payment/PayOSService'
import { SubscriptionService } from '@/services/subscription/SubscriptionService'

// Prevent multiple scheduler instances in dev (hot-reload) or across imports
if (!(global as any)._expiredSubscriptionSchedulerInitialized) {
  (global as any)._expiredSubscriptionSchedulerInitialized = true

  const subscriptionRepository = new SubscriptionRepository()
  const userRepository = new UserRepository()
  const payosService = new PayOSService()
  const subscriptionService = new SubscriptionService(
    subscriptionRepository,
    userRepository,
    payosService
  )

  // Run once on startup
  void subscriptionService.checkAndUpdateExpiredSubscriptions()
    .then(() => console.log('[Scheduler] Initial expired subscription check done'))
    .catch(err => console.error('[Scheduler] Initial check failed', err))

  // Schedule to run every day at 00:00 AM server time
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[Scheduler] Running daily expired subscription check')
      await subscriptionService.checkAndUpdateExpiredSubscriptions()
      console.log('[Scheduler] Completed daily expired subscription check')
    } catch (err) {
      console.error('[Scheduler] Failed during daily expired subscription check', err)
    }
  })

  console.log('[Scheduler] Expired subscription scheduler initialized (runs daily at 00:00)')
} 