const mongoose = require('mongoose');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz_app');
    console.warn('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Plan schema
const planSchema = new mongoose.Schema(
  {
    _id: String,
    name: String,
    price: Number,
    duration: String, // ISO 8601 format
    features: [String],
    isActive: Boolean,
  },
  { timestamps: true },
);

const Plan = mongoose.model('Plan', planSchema);

// Modern plans with ISO 8601 durations
const plansData = [
  {
    _id: 'basic-monthly',
    name: 'Basic Monthly',
    price: 99000, // 99,000 VND
    duration: 'P1M', // ISO 8601: 1 month
    features: [
      'Access to private quizzes',
      'Basic analytics',
      'Email support',
      'Mobile app access',
    ],
    isActive: true,
  },
  {
    _id: 'premium-quarterly',
    name: 'Premium Quarterly',
    price: 259000, // 259,000 VND (save 15%)
    duration: 'P3M', // ISO 8601: 3 months
    features: [
      'Access to private quizzes',
      'Advanced analytics',
      'Priority email support',
      'Mobile app access',
      'Flashcards feature',
      'Progress tracking',
    ],
    isActive: true,
  },
  {
    _id: 'pro-semi-annual',
    name: 'Pro Semi-Annual',
    price: 499000, // 499,000 VND (save 20%)
    duration: 'P6M', // ISO 8601: 6 months
    features: [
      'Access to private quizzes',
      'Advanced analytics',
      'Priority support',
      'Mobile app access',
      'Flashcards feature',
      'Progress tracking',
      'Custom quiz categories',
      'Export results',
    ],
    isActive: true,
  },
  {
    _id: 'ultimate-annual',
    name: 'Ultimate Annual',
    price: 899000, // 899,000 VND (save 25%)
    duration: 'P1Y', // ISO 8601: 1 year
    features: [
      'Access to private quizzes',
      'Advanced analytics',
      'Priority support',
      'Mobile app access',
      'Flashcards feature',
      'Progress tracking',
      'Custom quiz categories',
      'Export results',
      'AI-powered insights',
      'Team collaboration',
    ],
    isActive: true,
  },
  {
    _id: 'lifetime-premium',
    name: 'Lifetime Premium',
    price: 1999000, // 1,999,000 VND
    duration: 'PT0S', // ISO 8601: Special lifetime indicator
    features: [
      'Lifetime access to all features',
      'Access to private quizzes',
      'Advanced analytics',
      'Priority support',
      'Mobile app access',
      'Flashcards feature',
      'Progress tracking',
      'Custom quiz categories',
      'Export results',
      'AI-powered insights',
      'Team collaboration',
      'Early access to new features',
    ],
    isActive: true,
  },
];

async function seedPlans() {
  try {
    await connectDB();

    console.warn('Seeding plans with ISO 8601 durations...');

    // Clear existing plans (optional - remove in production)
    const existingCount = await Plan.countDocuments();
    console.warn(`Found ${existingCount} existing plans`);

    for (const planData of plansData) {
      try {
        const existingPlan = await Plan.findById(planData._id);

        if (existingPlan) {
          // Update existing plan
          await Plan.findByIdAndUpdate(planData._id, planData);
          console.warn(`✓ Updated plan: ${planData.name} (${planData.duration})`);
        } else {
          // Create new plan
          await Plan.create(planData);
          console.warn(`✓ Created plan: ${planData.name} (${planData.duration})`);
        }
      } catch (error) {
        console.error(`✗ Failed to process plan ${planData.name}:`, error.message);
      }
    }

    const totalPlans = await Plan.countDocuments();
    console.warn(`\n🎉 Seeding completed! Total plans: ${totalPlans}`);

    // Display summary
    console.warn('\nPlan Summary:');
    const plans = await Plan.find({}).sort({ price: 1 });
    plans.forEach((plan) => {
      const durationDisplay =
        {
          P1M: '1 Month',
          P3M: '3 Months',
          P6M: '6 Months',
          P1Y: '1 Year',
          PT0S: 'Lifetime',
        }[plan.duration] || plan.duration;

      console.warn(`- ${plan.name}: ${plan.price.toLocaleString()} VND (${durationDisplay})`);
    });
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.warn('\nDisconnected from MongoDB');
  }
}

// Validation function
async function validatePlans() {
  try {
    await connectDB();

    console.warn('Validating plans...');
    const plans = await Plan.find({});

    let validCount = 0;
    let invalidCount = 0;

    for (const plan of plans) {
      const isValidISO =
        /^(P\d+[YMD]|PT\d*[HMS]*)$/.test(plan.duration) || plan.duration === 'PT0S';

      if (isValidISO) {
        console.warn(`✓ ${plan.name}: ${plan.duration} (valid)`);
        validCount++;
      } else {
        console.warn(`✗ ${plan.name}: ${plan.duration} (invalid ISO 8601)`);
        invalidCount++;
      }
    }

    console.warn(`\nValidation Summary: ${validCount} valid, ${invalidCount} invalid`);
  } catch (error) {
    console.error('Validation failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// CLI handling
const command = process.argv[2];

if (command === 'seed') {
  seedPlans();
} else if (command === 'validate') {
  validatePlans();
} else {
  console.warn('Usage:');
  console.warn('  node seedPlansWithISO8601.js seed       # Create/update plans');
  console.warn('  node seedPlansWithISO8601.js validate   # Validate existing plans');
}
