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

  await mongoose.connect(mongoUrl, { bufferCommands: false });

  const now = new Date();
  const expiredSubscriptions = await Subscription.find({
    isActive: true,
    endDate: { $exists: true, $lte: now },
    status: 'completed',
  }).select('_id user');

  for (const subscription of expiredSubscriptions) {
    await Subscription.findByIdAndUpdate(subscription._id, {
      isActive: false,
      status: 'expired',
    });

    await User.findByIdAndUpdate(subscription.user, {
      'subscription.isActive': false,
    });
  }

  const usersOnlyResult = await User.updateMany(
    {
      'subscription.isActive': true,
      'subscription.endDate': { $exists: true, $lte: now },
    },
    {
      'subscription.isActive': false,
    },
  );

  return expiredSubscriptions.length + usersOnlyResult.modifiedCount;
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
