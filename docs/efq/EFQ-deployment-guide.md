# EFQ Deployment Guide

## 1. Database Setup & Migration

### 1.1. Database Schema Migration
```javascript
// scripts/migrate-efq.js
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Quiz = require('../src/models/Quiz');
const Attempt = require('../src/models/Attempt');

async function migrateEFQ() {
  try {
    console.log('Starting EFQ migration...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Update existing users with EFQ fields
    console.log('Updating users...');
    await User.updateMany(
      { 'rewards.totalPoints': { $exists: false } },
      {
        $set: {
          'rewards.totalPoints': 0,
          'rewards.earnedPoints': 0,
          'rewards.spentPoints': 0,
          'rewards.lastRewardCalculation': new Date(),
          'rewards.tier': 'bronze',
          'rewards.tierMultiplier': 1.0,
          'fraudFlags.riskScore': 0,
          'fraudFlags.isSuspended': false,
          'fraudFlags.blockedRewards': 0,
          'fraudFlags.totalFlaggedAttempts': 0,
          'trustScore': 50,
          'trustFactors.accountAge': 0,
          'trustFactors.totalQuizzes': 0,
          'trustFactors.totalAttempts': 0,
          'trustFactors.averageScore': 0,
          'trustFactors.reportCount': 0,
          'trustFactors.lastActivity': new Date()
        }
      }
    );
    
    // Update existing quizzes with EFQ fields
    console.log('Updating quizzes...');
    await Quiz.updateMany(
      { 'rewardStats.totalAttempts': { $exists: false } },
      {
        $set: {
          'rewardStats.totalAttempts': 0,
          'rewardStats.validAttempts': 0,
          'rewardStats.averageScore': 0,
          'rewardStats.completionRate': 0,
          'rewardStats.averageTimeSpent': 0,
          'rewardStats.totalRewardsPaid': 0,
          'rewardStats.lastRewardCalculation': new Date(),
          'rewardStats.difficultyScore': 0,
          'rewardStats.popularityScore': 0,
          'fraudIndicators.riskScore': 0,
          'fraudIndicators.flaggedAttempts': 0,
          'fraudIndicators.suspiciousIPs': [],
          'fraudIndicators.lastFraudCheck': new Date()
        }
      }
    );
    
    // Update existing attempts with EFQ fields
    console.log('Updating attempts...');
    await Attempt.updateMany(
      { 'fraudScore': { $exists: false } },
      {
        $set: {
          'sessionId': 'migrated',
          'requestId': 'migrated',
          'ipAddress': 'unknown',
          'userAgent': 'unknown',
          'deviceFingerprint': 'unknown',
          'timeSpent': 0,
          'timePerQuestion': [],
          'answerChanges': [],
          'mouseMovements': [],
          'keyboardPatterns': [],
          'fraudScore': 0,
          'fraudFlags': [],
          'isFlagged': false,
          'rewardEarned': 0,
          'rewardMultiplier': 1.0,
          'rewardReason': 'migrated'
        }
      }
    );
    
    console.log('EFQ migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateEFQ()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrateEFQ;
```

### 1.2. Create Indexes
```javascript
// scripts/create-efq-indexes.js
const mongoose = require('mongoose');

async function createEFQIndexes() {
  try {
    console.log('Creating EFQ indexes...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    // User indexes
    await mongoose.connection.db.collection('users').createIndex(
      { 'rewards.totalPoints': -1 }
    );
    await mongoose.connection.db.collection('users').createIndex(
      { 'fraudFlags.riskScore': -1 }
    );
    await mongoose.connection.db.collection('users').createIndex(
      { trustScore: -1 }
    );
    await mongoose.connection.db.collection('users').createIndex(
      { 'fraudFlags.isSuspended': 1 }
    );
    
    // Quiz indexes
    await mongoose.connection.db.collection('quizzes').createIndex(
      { 'rewardStats.totalAttempts': -1 }
    );
    await mongoose.connection.db.collection('quizzes').createIndex(
      { 'fraudIndicators.riskScore': -1 }
    );
    
    // Attempt indexes
    await mongoose.connection.db.collection('attempts').createIndex(
      { sessionId: 1 }
    );
    await mongoose.connection.db.collection('attempts').createIndex(
      { ipAddress: 1, takenAt: -1 }
    );
    await mongoose.connection.db.collection('attempts').createIndex(
      { deviceFingerprint: 1, takenAt: -1 }
    );
    await mongoose.connection.db.collection('attempts').createIndex(
      { fraudScore: -1 }
    );
    await mongoose.connection.db.collection('attempts').createIndex(
      { isFlagged: 1 }
    );
    
    // Reward indexes
    await mongoose.connection.db.collection('rewards').createIndex(
      { status: 1, createdAt: -1 }
    );
    await mongoose.connection.db.collection('rewards').createIndex(
      { riskLevel: 1, createdAt: -1 }
    );
    await mongoose.connection.db.collection('rewards').createIndex(
      { fraudScore: -1, createdAt: -1 }
    );
    
    // AuditLog indexes
    await mongoose.connection.db.collection('auditlogs').createIndex(
      { action: 1, timestamp: -1 }
    );
    await mongoose.connection.db.collection('auditlogs').createIndex(
      { ipAddress: 1, timestamp: -1 }
    );
    await mongoose.connection.db.collection('auditlogs').createIndex(
      { deviceFingerprint: 1, timestamp: -1 }
    );
    await mongoose.connection.db.collection('auditlogs').createIndex(
      { 'fraudIndicators.riskScore': -1, timestamp: -1 }
    );
    await mongoose.connection.db.collection('auditlogs').createIndex(
      { outcome: 1, timestamp: -1 }
    );
    
    console.log('EFQ indexes created successfully!');
    
  } catch (error) {
    console.error('Failed to create indexes:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  createEFQIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createEFQIndexes;
```

## 2. Cron Jobs Setup

### 2.1. Reward Processing Cron Job
```javascript
// scripts/cron-reward-processor.js
const cron = require('node-cron');
const { RewardService } = require('../src/services/reward/RewardService');

class RewardProcessorCron {
  constructor() {
    this.rewardService = new RewardService();
  }

  start() {
    // Process daily rewards at 2 AM every day
    cron.schedule('0 2 * * *', async () => {
      console.log('Starting daily reward processing...');
      try {
        await this.rewardService.processRewards('daily');
        console.log('Daily reward processing completed');
      } catch (error) {
        console.error('Daily reward processing failed:', error);
      }
    });

    // Process weekly rewards on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      console.log('Starting weekly reward processing...');
      try {
        await this.rewardService.processRewards('weekly');
        console.log('Weekly reward processing completed');
      } catch (error) {
        console.error('Weekly reward processing failed:', error);
      }
    });

    // Process monthly rewards on 1st of month at 4 AM
    cron.schedule('0 4 1 * *', async () => {
      console.log('Starting monthly reward processing...');
      try {
        await this.rewardService.processRewards('monthly');
        console.log('Monthly reward processing completed');
      } catch (error) {
        console.error('Monthly reward processing failed:', error);
      }
    });

    console.log('Reward processor cron jobs started');
  }
}

module.exports = RewardProcessorCron;
```

### 2.2. Fraud Detection Monitoring
```javascript
// scripts/cron-fraud-monitor.js
const cron = require('node-cron');
const { AuditLogService } = require('../src/services/logging/AuditLogService');
const { FraudDetectionService } = require('../src/services/fraud/FraudDetectionService');

class FraudMonitorCron {
  constructor() {
    this.auditLogService = new AuditLogService();
    this.fraudDetectionService = new FraudDetectionService();
  }

  start() {
    // Monitor fraud patterns every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Starting fraud pattern monitoring...');
      try {
        const patterns = await this.auditLogService.getSuspiciousPatterns('day');
        
        // Alert if suspicious patterns detected
        if (patterns.length > 10) {
          await this.sendFraudAlert(patterns);
        }
        
        console.log(`Fraud monitoring completed. Found ${patterns.length} suspicious patterns`);
      } catch (error) {
        console.error('Fraud monitoring failed:', error);
      }
    });

    // Generate fraud analytics report daily at 6 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('Generating daily fraud analytics report...');
      try {
        const analytics = await this.auditLogService.getFraudAnalytics('day');
        await this.generateFraudReport(analytics);
        console.log('Daily fraud report generated');
      } catch (error) {
        console.error('Failed to generate fraud report:', error);
      }
    });

    console.log('Fraud monitor cron jobs started');
  }

  async sendFraudAlert(patterns) {
    // Implementation for sending fraud alerts
    console.log('Fraud alert:', patterns.slice(0, 5));
  }

  async generateFraudReport(analytics) {
    // Implementation for generating fraud reports
    console.log('Fraud report generated:', analytics);
  }
}

module.exports = FraudMonitorCron;
```

## 3. Environment Configuration

### 3.1. Environment Variables
```bash
# .env.local
# EFQ Configuration
EFQ_ENABLED=true
EFQ_BASE_REWARD_PER_ATTEMPT=2
EFQ_MAX_REWARD_PER_QUIZ=1000
EFQ_FRAUD_THRESHOLD_LOW=30
EFQ_FRAUD_THRESHOLD_MEDIUM=60
EFQ_FRAUD_THRESHOLD_HIGH=80
EFQ_FRAUD_THRESHOLD_CRITICAL=100

# Fraud Detection
FRAUD_DETECTION_ENABLED=true
FRAUD_ML_MODEL_ENABLED=false
FRAUD_ALERT_EMAIL=admin@example.com
FRAUD_ALERT_WEBHOOK=https://hooks.slack.com/...

# Reward Processing
REWARD_PROCESSING_ENABLED=true
REWARD_AUTO_APPROVAL_ENABLED=true
REWARD_REVIEW_REQUIRED_THRESHOLD=70

# Monitoring
MONITORING_ENABLED=true
MONITORING_WEBHOOK=https://hooks.slack.com/...
MONITORING_ALERT_THRESHOLD=100

# Database
MONGODB_URI=mongodb://localhost:27017/ck_quiz
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2

# Redis (for caching and rate limiting)
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/efq.log
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90
```

### 3.2. Configuration Service
```typescript
// lib/config.ts
export class Config {
  static get efq() {
    return {
      enabled: process.env.EFQ_ENABLED === 'true',
      baseRewardPerAttempt: parseInt(process.env.EFQ_BASE_REWARD_PER_ATTEMPT || '2'),
      maxRewardPerQuiz: parseInt(process.env.EFQ_MAX_REWARD_PER_QUIZ || '1000'),
      fraudThresholds: {
        low: parseInt(process.env.EFQ_FRAUD_THRESHOLD_LOW || '30'),
        medium: parseInt(process.env.EFQ_FRAUD_THRESHOLD_MEDIUM || '60'),
        high: parseInt(process.env.EFQ_FRAUD_THRESHOLD_HIGH || '80'),
        critical: parseInt(process.env.EFQ_FRAUD_THRESHOLD_CRITICAL || '100')
      }
    };
  }

  static get fraudDetection() {
    return {
      enabled: process.env.FRAUD_DETECTION_ENABLED === 'true',
      mlModelEnabled: process.env.FRAUD_ML_MODEL_ENABLED === 'true',
      alertEmail: process.env.FRAUD_ALERT_EMAIL,
      alertWebhook: process.env.FRAUD_ALERT_WEBHOOK
    };
  }

  static get rewardProcessing() {
    return {
      enabled: process.env.REWARD_PROCESSING_ENABLED === 'true',
      autoApprovalEnabled: process.env.REWARD_AUTO_APPROVAL_ENABLED === 'true',
      reviewRequiredThreshold: parseInt(process.env.REWARD_REVIEW_REQUIRED_THRESHOLD || '70')
    };
  }

  static get monitoring() {
    return {
      enabled: process.env.MONITORING_ENABLED === 'true',
      webhook: process.env.MONITORING_WEBHOOK,
      alertThreshold: parseInt(process.env.MONITORING_ALERT_THRESHOLD || '100')
    };
  }

  static get database() {
    return {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ck_quiz',
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2')
    };
  }

  static get redis() {
    return {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: parseInt(process.env.REDIS_TTL || '3600')
    };
  }

  static get logging() {
    return {
      level: process.env.LOG_LEVEL || 'info',
      filePath: process.env.LOG_FILE_PATH || './logs/efq.log',
      auditLogEnabled: process.env.AUDIT_LOG_ENABLED === 'true',
      auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90')
    };
  }
}
```

## 4. Monitoring & Alerting

### 4.1. Health Check Endpoint
```typescript
// app/api/health/efq/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import { Config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        rewardProcessing: 'unknown',
        fraudDetection: 'unknown',
        auditLogging: 'unknown'
      },
      metrics: {
        totalUsers: 0,
        totalQuizzes: 0,
        totalAttempts: 0,
        totalRewards: 0,
        pendingReviews: 0,
        fraudRate: 0
      }
    };

    // Check database connection
    try {
      await connectDB();
      const { db } = mongoose.connection;
      await db.admin().ping();
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check reward processing
    if (Config.rewardProcessing.enabled) {
      health.services.rewardProcessing = 'enabled';
    } else {
      health.services.rewardProcessing = 'disabled';
    }

    // Check fraud detection
    if (Config.fraudDetection.enabled) {
      health.services.fraudDetection = 'enabled';
    } else {
      health.services.fraudDetection = 'disabled';
    }

    // Check audit logging
    if (Config.logging.auditLogEnabled) {
      health.services.auditLogging = 'enabled';
    } else {
      health.services.auditLogging = 'disabled';
    }

    // Get basic metrics
    try {
      const [userCount, quizCount, attemptCount, rewardCount, pendingCount] = await Promise.all([
        User.countDocuments(),
        Quiz.countDocuments(),
        Attempt.countDocuments(),
        Reward.countDocuments(),
        Reward.countDocuments({ status: 'pending_review' })
      ]);

      health.metrics = {
        totalUsers: userCount,
        totalQuizzes: quizCount,
        totalAttempts: attemptCount,
        totalRewards: rewardCount,
        pendingReviews: pendingCount,
        fraudRate: attemptCount > 0 ? (pendingCount / attemptCount) * 100 : 0
      };
    } catch (error) {
      console.error('Failed to get metrics:', error);
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error.message 
      },
      { status: 503 }
    );
  }
}
```

### 4.2. Metrics Collection
```typescript
// lib/metrics.ts
import { Config } from './config';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, number> = new Map();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  increment(metric: string, value: number = 1) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  set(metric: string, value: number) {
    this.metrics.set(metric, value);
  }

  get(metric: string): number {
    return this.metrics.get(metric) || 0;
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  async sendToMonitoring() {
    if (!Config.monitoring.enabled || !Config.monitoring.webhook) {
      return;
    }

    try {
      const payload = {
        timestamp: new Date().toISOString(),
        metrics: this.getAll(),
        environment: process.env.NODE_ENV
      };

      await fetch(Config.monitoring.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }

  reset() {
    this.metrics.clear();
  }
}

export const metrics = MetricsCollector.getInstance();
```

## 5. Deployment Checklist

### 5.1. Pre-deployment Checklist
- [ ] Database migration script tested
- [ ] Indexes created successfully
- [ ] Environment variables configured
- [ ] Cron jobs configured and tested
- [ ] Monitoring endpoints working
- [ ] Fraud detection thresholds calibrated
- [ ] Reward calculation logic tested
- [ ] Admin dashboard accessible
- [ ] User dashboard working
- [ ] Behavioral tracking implemented

### 5.2. Production Deployment Steps
```bash
# 1. Backup existing database
mongodump --uri="mongodb://localhost:27017/ck_quiz" --out=./backup

# 2. Run database migration
npm run migrate:efq

# 3. Create indexes
npm run create:indexes

# 4. Deploy application
npm run build
npm run start

# 5. Start cron jobs
npm run cron:start

# 6. Verify health check
curl http://localhost:3000/api/health/efq

# 7. Test reward processing
curl -X POST http://localhost:3000/api/admin/rewards/process \
  -H "Content-Type: application/json" \
  -d '{"timeRange": "daily"}'
```

### 5.3. Post-deployment Verification
- [ ] Health check endpoint returns healthy
- [ ] Admin can access fraud analytics
- [ ] Users can see their reward dashboard
- [ ] Quiz attempts are being tracked
- [ ] Fraud detection is working
- [ ] Reward processing cron job is running
- [ ] Audit logs are being generated
- [ ] Monitoring alerts are configured
- [ ] Performance is acceptable
- [ ] Error logs are clean

## 6. Performance Optimization

### 6.1. Database Optimization
```javascript
// Optimize queries with proper indexing
// Use aggregation pipelines for complex queries
// Implement caching for frequently accessed data
// Use read replicas for analytics queries
```

### 6.2. Caching Strategy
```typescript
// lib/cache.ts
import Redis from 'ioredis';
import { Config } from './config';

class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(Config.redis.url);
  }

  async get(key: string): Promise<any> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = Config.redis.ttl): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushall();
  }
}

export const cache = new CacheService();
```

### 6.3. Rate Limiting
```typescript
// lib/rateLimit.ts
import { cache } from './cache';

export class RateLimiter {
  static async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await cache.get(`rate_limit:${key}`) || 0;
    
    if (current >= limit) {
      return false;
    }

    await cache.set(`rate_limit:${key}`, current + 1, window);
    return true;
  }
}
```

## 7. Security Considerations

### 7.1. Data Privacy
- Implement data retention policies
- Anonymize sensitive data in logs
- Use encryption for stored behavioral data
- Implement GDPR compliance measures

### 7.2. Access Control
- Implement role-based access control
- Audit admin actions
- Use API rate limiting
- Implement session management

### 7.3. Fraud Prevention
- Monitor for unusual patterns
- Implement progressive security measures
- Use machine learning for pattern detection
- Regular security audits

## 8. Maintenance & Updates

### 8.1. Regular Maintenance Tasks
```bash
# Weekly
npm run cleanup:logs
npm run optimize:database
npm run backup:data

# Monthly
npm run update:fraud:model
npm run analyze:performance
npm run review:security
```

### 8.2. Update Procedures
1. Test updates in staging environment
2. Backup production data
3. Deploy updates during low-traffic periods
4. Monitor system health post-update
5. Rollback plan ready if needed

This deployment guide provides a comprehensive approach to implementing the EFQ system with proper monitoring, security, and maintenance procedures. 