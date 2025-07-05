const cron = require('node-cron')
const { ServiceFactory } = require('../lib/serviceFactory')

async function checkExpiredSubscriptions() {
  try {
    console.log('Starting expired subscription check...')
    
    const subscriptionService = ServiceFactory.createSubscriptionService()
    await subscriptionService.checkAndUpdateExpiredSubscriptions()
    
    console.log('Expired subscription check completed successfully')
  } catch (error) {
    console.error('Error checking expired subscriptions:', error)
  }
}

// Run immediately when script starts
checkExpiredSubscriptions()

// Schedule to run every day at 1 AM
cron.schedule('0 1 * * *', () => {
  console.log('Running scheduled expired subscription check...')
  checkExpiredSubscriptions()
})

console.log('Expired subscription checker started. Will run daily at 1 AM.') 