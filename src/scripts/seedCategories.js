const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kttpm-quiz';

const categories = [
  {
    name: 'Mathematics',
    description: 'Mathematical problems, formulas, and concepts',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Science',
    description: 'Physics, Chemistry, Biology and other sciences',
    color: '#10B981',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'History',
    description: 'Historical events, dates, and figures',
    color: '#F59E0B',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Technology',
    description: 'Programming, computer science, and technology',
    color: '#8B5CF6',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Language',
    description: 'Grammar, vocabulary, and language skills',
    color: '#EF4444',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'General Knowledge',
    description: 'Mixed topics and general knowledge questions',
    color: '#6B7280',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function seedCategories() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const categoriesCollection = db.collection('categories');

    // Check if categories already exist
    const existingCount = await categoriesCollection.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing categories. Skipping seed.`);
      return;
    }

    // Find first admin user to set as creator
    const usersCollection = db.collection('users');
    const adminUser = await usersCollection.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.error('No admin user found! Please create an admin user first.');
      return;
    }

    // Add createdBy field to each category
    const categoriesWithCreator = categories.map(category => ({
      ...category,
      createdBy: adminUser._id
    }));

    // Insert categories
    const result = await categoriesCollection.insertMany(categoriesWithCreator);
    
    console.log(`Successfully created ${result.insertedCount} categories:`);
    categoriesWithCreator.forEach((category, index) => {
      console.log(`  - ${category.name} (${category.color})`);
    });

  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

// Run the seed function
if (require.main === module) {
  seedCategories().catch(console.error);
}

module.exports = { seedCategories }; 