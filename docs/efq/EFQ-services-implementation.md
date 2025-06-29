# EFQ Services Implementation

## 1. RewardService

```typescript
// services/reward/RewardService.ts
import { IQuiz, IAttempt, IReward, IUser } from '@/models';
import { FraudDetectionService } from './FraudDetectionService';
import { AuditLogService } from './AuditLogService';

export class RewardService {
  private fraudDetectionService: FraudDetectionService;
  private auditLogService: AuditLogService;

  constructor() {
    this.fraudDetectionService = new FraudDetectionService();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Calculate reward for a quiz based on attempts
   */
  async calculateQuizReward(
    quizId: string, 
    timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<{
    totalReward: number;
    validAttempts: number;
    fraudAttempts: number;
    rewardBreakdown: any;
  }> {
    const startDate = this.getStartDate(timeRange);
    
    // Get all attempts for this quiz in the time range
    const attempts = await Attempt.find({
      quiz: quizId,
      takenAt: { $gte: startDate }
    }).populate('user');

    // Filter out fraud attempts
    const validAttempts = attempts.filter(attempt => !attempt.isFlagged);
    const fraudAttempts = attempts.filter(attempt => attempt.isFlagged);

    // Calculate base reward
    const baseReward = validAttempts.length * this.getBaseRewardPerAttempt();

    // Calculate quality multipliers
    const qualityMultipliers = this.calculateQualityMultipliers(validAttempts);
    
    // Calculate difficulty bonus
    const difficultyBonus = await this.calculateDifficultyBonus(quizId);
    
    // Calculate popularity bonus
    const popularityBonus = this.calculatePopularityBonus(validAttempts.length);

    const totalReward = Math.round(
      baseReward * 
      qualityMultipliers.total * 
      (1 + difficultyBonus + popularityBonus)
    );

    return {
      totalReward,
      validAttempts: validAttempts.length,
      fraudAttempts: fraudAttempts.length,
      rewardBreakdown: {
        baseReward,
        qualityMultipliers,
        difficultyBonus,
        popularityBonus,
        totalReward
      }
    };
  }

  /**
   * Process rewards for all quizzes (daily/weekly/monthly)
   */
  async processRewards(timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<void> {
    const startDate = this.getStartDate(timeRange);
    
    // Get all published quizzes
    const quizzes = await Quiz.find({ 
      status: 'published',
      'rewardStats.lastRewardCalculation': { $lt: startDate }
    });

    for (const quiz of quizzes) {
      try {
        const rewardData = await this.calculateQuizReward(quiz._id, timeRange);
        
        // Get quiz author
        const author = await User.findById(quiz.author);
        if (!author) continue;

        // Apply fraud detection and reward adjustment
        const fraudResponse = await this.fraudDetectionService.processFraudResponse(
          rewardData.totalReward,
          [], // fraud flags will be calculated from attempts
          {
            quizId: quiz._id,
            userId: author._id,
            userTrustScore: author.trustScore,
            userAge: this.calculateUserAge(author.createdAt)
          }
        );

        // Create reward record
        const reward = new Reward({
          userId: author._id,
          quizId: quiz._id,
          attemptId: null, // This is a batch reward
          calculatedReward: rewardData.totalReward,
          actualReward: (rewardData.totalReward * fraudResponse.rewardPercentage) / 100,
          rewardPercentage: fraudResponse.rewardPercentage,
          fraudScore: fraudResponse.riskLevel === 'low' ? 0 : 50, // Placeholder
          fraudFlags: fraudResponse.evidence,
          riskLevel: fraudResponse.riskLevel,
          action: fraudResponse.action,
          status: fraudResponse.reviewRequired ? 'pending_review' : 'approved',
          reason: fraudResponse.reason
        });

        await reward.save();

        // Update user rewards if auto-approved
        if (!fraudResponse.reviewRequired) {
          await this.updateUserRewards(author._id, reward.actualReward);
        }

        // Update quiz reward stats
        await this.updateQuizRewardStats(quiz._id, rewardData);

        // Log the reward calculation
        await this.auditLogService.logRewardCalculation({
          userId: author._id,
          quizId: quiz._id,
          rewardData,
          fraudResponse,
          timeRange
        });

      } catch (error) {
        console.error(`Error processing rewards for quiz ${quiz._id}:`, error);
      }
    }
  }

  /**
   * Update user rewards
   */
  private async updateUserRewards(userId: string, points: number): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: {
        'rewards.totalPoints': points,
        'rewards.earnedPoints': points
      },
      'rewards.lastRewardCalculation': new Date()
    });

    // Update user tier based on total points
    await this.updateUserTier(userId);
  }

  /**
   * Update user tier based on total points
   */
  private async updateUserTier(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    const totalPoints = user.rewards.totalPoints;
    let newTier = 'bronze';
    let multiplier = 1.0;

    if (totalPoints >= 1000) {
      newTier = 'platinum';
      multiplier = 2.0;
    } else if (totalPoints >= 500) {
      newTier = 'gold';
      multiplier = 1.5;
    } else if (totalPoints >= 100) {
      newTier = 'silver';
      multiplier = 1.2;
    }

    if (newTier !== user.rewards.tier) {
      await User.findByIdAndUpdate(userId, {
        'rewards.tier': newTier,
        'rewards.tierMultiplier': multiplier
      });
    }
  }

  /**
   * Calculate quality multipliers based on attempt data
   */
  private calculateQualityMultipliers(attempts: IAttempt[]): {
    scoreMultiplier: number;
    completionMultiplier: number;
    timeMultiplier: number;
    total: number;
  } {
    if (attempts.length === 0) {
      return { scoreMultiplier: 1, completionMultiplier: 1, timeMultiplier: 1, total: 1 };
    }

    // Score multiplier (0.5 - 2.0)
    const avgScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length;
    const scoreMultiplier = Math.max(0.5, Math.min(2.0, avgScore / 50));

    // Completion multiplier (0.5 - 1.5)
    const completionRate = attempts.filter(a => a.score > 0).length / attempts.length;
    const completionMultiplier = Math.max(0.5, Math.min(1.5, completionRate * 1.5));

    // Time multiplier (0.5 - 1.2)
    const avgTimeSpent = attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0) / attempts.length;
    const timeMultiplier = Math.max(0.5, Math.min(1.2, avgTimeSpent / 300)); // 5 minutes baseline

    return {
      scoreMultiplier,
      completionMultiplier,
      timeMultiplier,
      total: scoreMultiplier * completionMultiplier * timeMultiplier
    };
  }

  /**
   * Calculate difficulty bonus based on quiz performance
   */
  private async calculateDifficultyBonus(quizId: string): Promise<number> {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return 0;

    // Difficulty based on average score (lower score = higher difficulty)
    const avgScore = quiz.rewardStats.averageScore;
    if (avgScore < 30) return 0.3; // Very difficult
    if (avgScore < 50) return 0.2; // Difficult
    if (avgScore < 70) return 0.1; // Moderate
    return 0; // Easy
  }

  /**
   * Calculate popularity bonus
   */
  private calculatePopularityBonus(attemptCount: number): number {
    if (attemptCount >= 100) return 0.5; // Very popular
    if (attemptCount >= 50) return 0.3; // Popular
    if (attemptCount >= 20) return 0.1; // Somewhat popular
    return 0; // Not popular
  }

  /**
   * Get base reward per attempt
   */
  private getBaseRewardPerAttempt(): number {
    return 2; // 2 points per valid attempt
  }

  /**
   * Calculate user age in days
   */
  private calculateUserAge(createdAt: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get start date for time range
   */
  private getStartDate(timeRange: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (timeRange) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Update quiz reward stats
   */
  private async updateQuizRewardStats(quizId: string, rewardData: any): Promise<void> {
    await Quiz.findByIdAndUpdate(quizId, {
      'rewardStats.lastRewardCalculation': new Date(),
      $inc: {
        'rewardStats.totalRewardsPaid': rewardData.totalReward
      }
    });
  }
}
```

## 2. FraudDetectionService

```typescript
// services/fraud/FraudDetectionService.ts
import { IAttempt, IUser } from '@/models';

export class FraudDetectionService {
  private readonly RISK_THRESHOLDS = {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 80,
    CRITICAL: 100
  };

  private readonly RESPONSE_CONFIG = {
    low: {
      action: 'allow_full_reward',
      rewardPercentage: 100,
      reviewRequired: false,
      autoApproval: true,
      adminNotification: false,
      userNotification: false,
      reason: 'Low risk - normal processing'
    },
    medium: {
      action: 'reduce_reward',
      rewardPercentage: 50,
      reviewRequired: false,
      autoApproval: true,
      adminNotification: true,
      userNotification: true,
      reason: 'Suspicious activity detected - reduced reward'
    },
    high: {
      action: 'hold_reward',
      rewardPercentage: 0,
      reviewRequired: true,
      autoApproval: false,
      adminNotification: true,
      userNotification: true,
      reason: 'High fraud risk - reward held for review'
    },
    critical: {
      action: 'block_reward',
      rewardPercentage: 0,
      reviewRequired: true,
      autoApproval: false,
      adminNotification: true,
      userNotification: true,
      reason: 'Critical fraud risk - reward blocked'
    }
  };

  /**
   * Process fraud response for a reward
   */
  async processFraudResponse(
    calculatedReward: number,
    fraudFlags: string[],
    context: {
      quizId: string;
      userId: string;
      userTrustScore: number;
      userAge: number;
    }
  ): Promise<FraudResponse> {
    // Calculate fraud score based on various factors
    const fraudScore = await this.calculateFraudScore(context);
    
    // Determine risk level
    const riskLevel = this.calculateRiskLevel(fraudScore);
    const config = this.RESPONSE_CONFIG[riskLevel];
    
    // Adjust reward based on context
    const adjustedRewardPercentage = this.adjustRewardBasedOnContext(
      config.rewardPercentage,
      fraudFlags,
      context
    );

    const response: FraudResponse = {
      riskLevel,
      action: config.action as any,
      rewardPercentage: adjustedRewardPercentage,
      reviewRequired: config.reviewRequired,
      autoApproval: config.autoApproval,
      adminNotification: config.adminNotification,
      userNotification: config.userNotification,
      reason: config.reason,
      evidence: fraudFlags
    };

    return response;
  }

  /**
   * Calculate fraud score for a user/quiz combination
   */
  async calculateFraudScore(context: {
    quizId: string;
    userId: string;
    userTrustScore: number;
    userAge: number;
  }): Promise<number> {
    let fraudScore = 0;

    // Get recent attempts for this quiz
    const recentAttempts = await Attempt.find({
      quiz: context.quizId,
      takenAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    // Check for rapid attempts
    if (this.checkRapidAttempts(recentAttempts)) {
      fraudScore += 30;
    }

    // Check for same IP addresses
    if (this.checkSameIPAddresses(recentAttempts)) {
      fraudScore += 25;
    }

    // Check for similar scores
    if (this.checkSimilarScores(recentAttempts)) {
      fraudScore += 20;
    }

    // Check for bot patterns
    if (this.checkBotPatterns(recentAttempts)) {
      fraudScore += 35;
    }

    // Adjust based on user trust score
    fraudScore -= (context.userTrustScore / 100) * 20; // Trusted users get penalty reduction

    // Adjust based on user age
    if (context.userAge < 7) {
      fraudScore += 15; // New users get penalty
    }

    return Math.max(0, Math.min(100, fraudScore));
  }

  /**
   * Check for rapid attempts
   */
  private checkRapidAttempts(attempts: IAttempt[]): boolean {
    if (attempts.length < 2) return false;

    const sortedAttempts = attempts.sort((a, b) => 
      new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()
    );

    for (let i = 1; i < sortedAttempts.length; i++) {
      const timeDiff = new Date(sortedAttempts[i].takenAt).getTime() - 
                      new Date(sortedAttempts[i-1].takenAt).getTime();
      if (timeDiff < 300000) { // Less than 5 minutes
        return true;
      }
    }
    return false;
  }

  /**
   * Check for same IP addresses
   */
  private checkSameIPAddresses(attempts: IAttempt[]): boolean {
    const ipCounts = new Map<string, number>();
    attempts.forEach(attempt => {
      if (attempt.ipAddress) {
        ipCounts.set(attempt.ipAddress, (ipCounts.get(attempt.ipAddress) || 0) + 1);
      }
    });

    return Array.from(ipCounts.values()).some(count => count > 5);
  }

  /**
   * Check for similar scores
   */
  private checkSimilarScores(attempts: IAttempt[]): boolean {
    if (attempts.length < 3) return false;

    const scores = attempts.map(a => a.score).sort();
    const variance = this.calculateVariance(scores);

    return variance < 15; // Very low variance = suspicious
  }

  /**
   * Check for bot-like patterns
   */
  private checkBotPatterns(attempts: IAttempt[]): boolean {
    // Check for consistent time spent
    const timeSpent = attempts.map(a => a.timeSpent || 0);
    const avgTime = timeSpent.reduce((a, b) => a + b, 0) / timeSpent.length;
    const timeVariance = this.calculateVariance(timeSpent);

    // Check for too consistent timing
    if (timeVariance < 10 && avgTime < 60) return true;

    // Check for perfect scores too frequently
    const perfectScores = attempts.filter(a => a.score === 100).length;
    const perfectScoreRate = perfectScores / attempts.length;

    return perfectScoreRate > 0.3; // More than 30% perfect scores
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate risk level from fraud score
   */
  private calculateRiskLevel(fraudScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (fraudScore <= this.RISK_THRESHOLDS.LOW) return 'low';
    if (fraudScore <= this.RISK_THRESHOLDS.MEDIUM) return 'medium';
    if (fraudScore <= this.RISK_THRESHOLDS.HIGH) return 'high';
    return 'critical';
  }

  /**
   * Adjust reward based on context
   */
  private adjustRewardBasedOnContext(
    basePercentage: number, 
    flags: string[], 
    context: any
  ): number {
    let adjustedPercentage = basePercentage;

    // Reduce reward for multiple suspicious flags
    const suspiciousFlags = flags.filter(flag => 
      ['rapid_attempts', 'same_ip_addresses', 'bot_patterns'].includes(flag)
    );
    if (suspiciousFlags.length > 2) {
      adjustedPercentage *= 0.7; // 30% reduction
    }

    // Increase reward for trusted users
    if (context.userTrustScore > 80) {
      adjustedPercentage = Math.min(100, adjustedPercentage * 1.2); // 20% bonus
    }

    // Reduce reward for new users
    if (context.userAge < 7) {
      adjustedPercentage *= 0.8; // 20% reduction
    }

    return Math.round(adjustedPercentage);
  }
}

interface FraudResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow_full_reward' | 'reduce_reward' | 'hold_reward' | 'block_reward' | 'suspend_user';
  rewardPercentage: number;
  reviewRequired: boolean;
  autoApproval: boolean;
  adminNotification: boolean;
  userNotification: boolean;
  reason: string;
  evidence: string[];
}
```

## 3. AuditLogService

```typescript
// services/logging/AuditLogService.ts
import AuditLog from '@/models/AuditLog';
import { generateDeviceFingerprint, getGeoLocation } from '@/lib/utils';

export class AuditLogService {
  /**
   * Log quiz attempt with behavioral data
   */
  async logQuizAttempt(data: {
    userId?: string;
    userEmail?: string;
    sessionId: string;
    requestId: string;
    quizId: string;
    score: number;
    answers: (number | number[])[];
    timeSpent: number;
    timePerQuestion: number[];
    answerChanges: Array<{
      questionIndex: number;
      oldAnswer: number | number[];
      newAnswer: number | number[];
      timestamp: number;
    }>;
    mouseMovements: Array<{ x: number; y: number; timestamp: number }>;
    keyboardPatterns: Array<{ key: string; timestamp: number; timeBetweenKeys: number }>;
    ipAddress: string;
    userAgent: string;
    fraudScore: number;
    fraudFlags: string[];
    outcome: 'success' | 'flagged' | 'blocked';
  }) {
    const now = new Date();
    const deviceFingerprint = generateDeviceFingerprint(data.userAgent);
    const geoLocation = await getGeoLocation(data.ipAddress);

    const auditLog = new AuditLog({
      userId: data.userId,
      userEmail: data.userEmail,
      sessionId: data.sessionId,
      requestId: data.requestId,
      action: 'quiz_attempt',
      resourceType: 'attempt',
      resourceId: data.quizId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceFingerprint,
      geoLocation,
      timestamp: now,
      timeSpent: data.timeSpent,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      mouseMovements: data.mouseMovements,
      keyboardPatterns: data.keyboardPatterns,
      quizAttemptData: {
        quizId: data.quizId,
        score: data.score,
        answers: data.answers,
        correctAnswers: this.calculateCorrectAnswers(data.answers),
        totalQuestions: data.answers.length,
        timePerQuestion: data.timePerQuestion,
        answerChanges: data.answerChanges,
      },
      fraudIndicators: {
        riskScore: data.fraudScore,
        flags: data.fraudFlags,
        suspiciousPatterns: this.analyzeSuspiciousPatterns(data),
      },
      outcome: data.outcome,
      metadata: {
        browserInfo: this.extractBrowserInfo(data.userAgent),
        screenResolution: this.getScreenResolution(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    await auditLog.save();
    return auditLog;
  }

  /**
   * Log fraud detection event
   */
  async logFraudDetection(data: {
    userId?: string;
    userEmail?: string;
    sessionId: string;
    requestId: string;
    resourceType: 'quiz' | 'user' | 'attempt' | 'reward';
    resourceId: string;
    fraudScore: number;
    flags: string[];
    suspiciousPatterns: string[];
    machineLearningScore?: number;
    ipAddress: string;
    userAgent: string;
    outcome: 'flagged' | 'blocked';
    reason: string;
  }) {
    const now = new Date();
    const deviceFingerprint = generateDeviceFingerprint(data.userAgent);
    const geoLocation = await getGeoLocation(data.ipAddress);

    const auditLog = new AuditLog({
      userId: data.userId,
      userEmail: data.userEmail,
      sessionId: data.sessionId,
      requestId: data.requestId,
      action: 'fraud_detected',
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceFingerprint,
      geoLocation,
      timestamp: now,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      fraudIndicators: {
        riskScore: data.fraudScore,
        flags: data.flags,
        suspiciousPatterns: data.suspiciousPatterns,
        machineLearningScore: data.machineLearningScore,
      },
      outcome: data.outcome,
      outcomeReason: data.reason,
      metadata: {
        detectionMethod: 'rule_based_and_ml',
        confidence: data.machineLearningScore || data.fraudScore / 100,
      },
    });

    await auditLog.save();
    return auditLog;
  }

  /**
   * Log reward calculation
   */
  async logRewardCalculation(data: {
    userId: string;
    quizId: string;
    rewardData: any;
    fraudResponse: any;
    timeRange: string;
  }) {
    const now = new Date();

    const auditLog = new AuditLog({
      userId: data.userId,
      sessionId: 'system',
      requestId: `reward_${Date.now()}`,
      action: 'reward_earned',
      resourceType: 'reward',
      resourceId: data.quizId,
      ipAddress: 'system',
      userAgent: 'system',
      deviceFingerprint: 'system',
      timestamp: now,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      outcome: data.fraudResponse.reviewRequired ? 'flagged' : 'success',
      outcomeReason: data.fraudResponse.reason,
      metadata: {
        rewardData: data.rewardData,
        fraudResponse: data.fraudResponse,
        timeRange: data.timeRange,
      },
    });

    await auditLog.save();
    return auditLog;
  }

  /**
   * Get fraud analytics
   */
  async getFraudAnalytics(timeRange: 'day' | 'week' | 'month' = 'day') {
    const startDate = this.getStartDate(timeRange);
    
    const analytics = await AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          action: { $in: ['quiz_attempt', 'fraud_detected'] }
        }
      },
      {
        $group: {
          _id: {
            action: '$action',
            outcome: '$outcome',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
          },
          count: { $sum: 1 },
          avgFraudScore: { $avg: '$fraudIndicators.riskScore' },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueIPs: { $addToSet: '$ipAddress' },
          uniqueDevices: { $addToSet: '$deviceFingerprint' }
        }
      },
      {
        $group: {
          _id: '$_id.day',
          actions: {
            $push: {
              action: '$_id.action',
              outcome: '$_id.outcome',
              count: '$count',
              avgFraudScore: '$avgFraudScore',
              uniqueUsers: { $size: '$uniqueUsers' },
              uniqueIPs: { $size: '$uniqueIPs' },
              uniqueDevices: { $size: '$uniqueDevices' }
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return analytics;
  }

  /**
   * Get suspicious patterns
   */
  async getSuspiciousPatterns(timeRange: 'day' | 'week' | 'month' = 'day') {
    const startDate = this.getStartDate(timeRange);
    
    const patterns = await AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          'fraudIndicators.riskScore': { $gte: 70 }
        }
      },
      {
        $group: {
          _id: '$ipAddress',
          attempts: { $sum: 1 },
          avgScore: { $avg: '$quizAttemptData.score' },
          avgTimeSpent: { $avg: '$timeSpent' },
          uniqueUsers: { $addToSet: '$userId' },
          fraudFlags: { $addToSet: '$fraudIndicators.flags' },
          suspiciousPatterns: { $addToSet: '$fraudIndicators.suspiciousPatterns' }
        }
      },
      {
        $match: {
          $or: [
            { attempts: { $gte: 10 } },
            { 'uniqueUsers.length': { $gte: 5 } }
          ]
        }
      },
      { $sort: { attempts: -1 } },
      { $limit: 50 }
    ]);

    return patterns;
  }

  private calculateCorrectAnswers(answers: (number | number[])[]): number {
    // Implementation depends on quiz structure
    return 0; // Placeholder
  }

  private analyzeSuspiciousPatterns(data: any): string[] {
    const patterns: string[] = [];
    
    // Analyze mouse movements
    if (data.mouseMovements.length < 10) {
      patterns.push('minimal_mouse_movement');
    }
    
    // Analyze keyboard patterns
    if (data.keyboardPatterns.length < 5) {
      patterns.push('minimal_keyboard_activity');
    }
    
    // Analyze time patterns
    if (data.timeSpent < 30) {
      patterns.push('too_fast_completion');
    }
    
    return patterns;
  }

  private extractBrowserInfo(userAgent: string): any {
    return {
      userAgent,
      // Add more parsing logic
    };
  }

  private getScreenResolution(): string {
    return '1920x1080'; // Placeholder
  }

  private getStartDate(timeRange: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}
```

## 4. Utility Functions

```typescript
// lib/utils.ts

/**
 * Generate device fingerprint from user agent
 */
export function generateDeviceFingerprint(userAgent: string): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx!.textBaseline = 'top';
  ctx!.font = '14px Arial';
  ctx!.fillText('Device fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ].join('|');
  
  return btoa(fingerprint).slice(0, 32);
}

/**
 * Get geo location from IP address
 */
export async function getGeoLocation(ipAddress: string): Promise<{
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}> {
  try {
    // Use a free IP geolocation service
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    const data = await response.json();
    
    return {
      country: data.country_name,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
    };
  } catch (error) {
    console.error('Error getting geo location:', error);
    return {};
  }
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
``` 