const mongoose = require('mongoose');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());
const mongoUrl = process.env.MONGODB_URI;

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'expired'],
      default: 'pending',
    },
    endDate: Date,
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true, strict: false },
);

const userSchema = new mongoose.Schema(
  {
    subscription: {
      isActive: { type: Boolean, default: false },
    },
  },
  { strict: false },
);

const Subscription =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);

async function checkExpiredSubscriptions() {
  if (!mongoUrl) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(mongoUrl, {
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  });

  const now = new Date();
  const expiredSubscriptionFilter = {
    isActive: true,
    endDate: { $exists: true, $lte: now },
    status: 'completed',
  };

  const expiredSubscriptions =
    await Subscription.find(expiredSubscriptionFilter).select('_id user');
  const expiredSubscriptionIds = expiredSubscriptions.map((subscription) => subscription._id);
  const expiredSubscriptionUserIds = [
    ...new Map(
      expiredSubscriptions.map((subscription) => [String(subscription.user), subscription.user]),
    ).values(),
  ];

  const [subscriptionsResult, usersResult, usersOnlyResult] = await Promise.all([
    expiredSubscriptionIds.length
      ? Subscription.updateMany(
          { _id: { $in: expiredSubscriptionIds } },
          {
            isActive: false,
            status: 'expired',
          },
        )
      : Promise.resolve({ modifiedCount: 0 }),
    expiredSubscriptionUserIds.length
      ? User.updateMany(
          { _id: { $in: expiredSubscriptionUserIds } },
          {
            'subscription.isActive': false,
          },
        )
      : Promise.resolve({ modifiedCount: 0 }),
    User.updateMany(
      {
        'subscription.isActive': true,
        'subscription.endDate': { $exists: true, $lte: now },
      },
      {
        'subscription.isActive': false,
      },
    ),
  ]);

  return (
    subscriptionsResult.modifiedCount + usersResult.modifiedCount + usersOnlyResult.modifiedCount
  );
}

checkExpiredSubscriptions()
  .then((count) => {
    console.warn(`Expired subscription check completed. Updated ${count} subscription(s).`);
  })
  .catch((error) => {
    console.error('Error checking expired subscriptions:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
