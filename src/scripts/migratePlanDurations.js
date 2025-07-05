const mongoose = require('mongoose');
const { DurationUtils } = require('../types/subscription');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz_app');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Plan schema for migration
const planSchema = new mongoose.Schema({
  _id: String,
  name: String,
  price: Number,
  duration: String,
  features: [String],
  isActive: Boolean,
}, { timestamps: true });

const Plan = mongoose.model('Plan', planSchema);

async function migratePlanDurations() {
  console.log('Starting plan duration migration...');
  
  try {
    await connectDB();
    
    // Find all plans
    const plans = await Plan.find({});
    console.log(`Found ${plans.length} plans to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const plan of plans) {
      try {
        const currentDuration = plan.duration;
        
        // Skip if already in ISO 8601 format
        if (DurationUtils.isValidISO8601Duration(currentDuration)) {
          console.log(`✓ Plan "${plan.name}" already has ISO 8601 duration: ${currentDuration}`);
          skippedCount++;
          continue;
        }
        
        // Convert legacy duration to ISO 8601
        const iso8601Duration = DurationUtils.fromLegacyDuration(currentDuration);
        
        // Update the plan
        await Plan.findByIdAndUpdate(plan._id, {
          duration: iso8601Duration
        });
        
        console.log(`✓ Migrated plan "${plan.name}": "${currentDuration}" → "${iso8601Duration}"`);
        migratedCount++;
        
      } catch (error) {
        console.error(`✗ Failed to migrate plan "${plan.name}" with duration "${plan.duration}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\nMigration Summary:');
    console.log(`- Migrated: ${migratedCount} plans`);
    console.log(`- Skipped: ${skippedCount} plans (already ISO 8601)`);
    console.log(`- Errors: ${errorCount} plans`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the failed plans manually.');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Dry run function to preview changes
async function dryRunMigration() {
  console.log('Starting dry run - no changes will be made...');
  
  try {
    await connectDB();
    
    const plans = await Plan.find({});
    console.log(`Found ${plans.length} plans to analyze\n`);
    
    const changes = [];
    
    for (const plan of plans) {
      try {
        const currentDuration = plan.duration;
        
        if (DurationUtils.isValidISO8601Duration(currentDuration)) {
          console.log(`✓ Plan "${plan.name}" - No change needed (already ISO 8601): ${currentDuration}`);
        } else {
          const iso8601Duration = DurationUtils.fromLegacyDuration(currentDuration);
          console.log(`📝 Plan "${plan.name}" - Will change: "${currentDuration}" → "${iso8601Duration}"`);
          changes.push({
            planName: plan.name,
            from: currentDuration,
            to: iso8601Duration
          });
        }
      } catch (error) {
        console.error(`❌ Plan "${plan.name}" - Cannot convert "${plan.duration}":`, error.message);
      }
    }
    
    console.log(`\nDry run summary: ${changes.length} plans will be migrated`);
    
  } catch (error) {
    console.error('Dry run failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// CLI handling
const command = process.argv[2];

if (command === 'dry-run') {
  dryRunMigration();
} else if (command === 'migrate') {
  migratePlanDurations();
} else {
  console.log('Usage:');
  console.log('  node migratePlanDurations.js dry-run    # Preview changes');
  console.log('  node migratePlanDurations.js migrate    # Execute migration');
} 