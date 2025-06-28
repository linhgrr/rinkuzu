const mongoose = require('mongoose');

// Define Plan schema
const PlanSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  features: {
    type: [String],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const Plan = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);

// Configurable default plans
const defaultPlans = [
  {
    _id: 'basic_monthly',
    name: 'Basic Monthly',
    price: 99000,
    duration: '1 tháng',
    features: [
      'Truy cập tất cả quiz private',
      'Không giới hạn số lần làm quiz',
      'Thống kê cơ bản'
    ],
    isActive: true
  },
  {
    _id: 'premium_6months',
    name: 'Premium 6 Tháng',
    price: 199000,
    duration: '6 tháng',
    features: [
      'Truy cập tất cả quiz private',
      'Không giới hạn số lần làm quiz',
      'Thống kê chi tiết',
      'Hỗ trợ ưu tiên'
    ],
    isActive: true
  },
  {
    _id: 'premium_lifetime',
    name: 'Premium Trọn Đời',
    price: 499000,
    duration: 'Trọn đời',
    features: [
      'Truy cập tất cả quiz private',
      'Không giới hạn số lần làm quiz',
      'Thống kê chi tiết',
      'Hỗ trợ ưu tiên',
      'Tính năng mới sớm nhất',
      'Không cần gia hạn'
    ],
    isActive: true
  }
];

async function seedPlans() {
  try {
    // Connect to MongoDB - use the same connection string as in the app
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kttpm-quiz';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing plans
    await Plan.deleteMany({});
    console.log('Cleared existing plans');

    // Insert default plans
    const result = await Plan.insertMany(defaultPlans);
    console.log(`Inserted ${result.length} plans:`);
    
    result.forEach(plan => {
      console.log(`- ${plan.name} (${plan._id}): ${plan.price.toLocaleString('vi-VN')} VND`);
    });

    console.log('Plans seeded successfully!');
  } catch (error) {
    console.error('Error seeding plans:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedPlans(); 