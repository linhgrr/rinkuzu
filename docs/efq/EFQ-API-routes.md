# EFQ API Routes Implementation

## 1. Reward API Routes

### 1.1. Calculate Quiz Reward
```typescript
// app/api/rewards/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RewardService } from '@/services/reward/RewardService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { quizId, timeRange = 'daily' } = await request.json();
    
    if (!quizId) {
      return NextResponse.json(
        { success: false, error: 'Quiz ID is required' },
        { status: 400 }
      );
    }

    const rewardService = new RewardService();
    const rewardData = await rewardService.calculateQuizReward(quizId, timeRange);

    return NextResponse.json({
      success: true,
      data: rewardData
    });

  } catch (error: any) {
    console.error('Calculate reward error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate reward' },
      { status: 500 }
    );
  }
}
```

### 1.2. Process All Rewards (Admin)
```typescript
// app/api/admin/rewards/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RewardService } from '@/services/reward/RewardService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { timeRange = 'daily' } = await request.json();

    const rewardService = new RewardService();
    await rewardService.processRewards(timeRange);

    return NextResponse.json({
      success: true,
      message: `Rewards processed successfully for ${timeRange}`
    });

  } catch (error: any) {
    console.error('Process rewards error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process rewards' },
      { status: 500 }
    );
  }
}
```

### 1.3. Get User Rewards
```typescript
// app/api/user/rewards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Reward from '@/models/Reward';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;
    const filter: any = { userId: (session.user as any).id };

    if (status) {
      filter.status = status;
    }

    const [rewards, total] = await Promise.all([
      Reward.find(filter)
        .populate('quizId', 'title slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Reward.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: rewards,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error: any) {
    console.error('Get user rewards error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}
```

## 2. Fraud Detection API Routes

### 2.1. Get Fraud Analytics (Admin)
```typescript
// app/api/admin/fraud-analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AuditLogService } from '@/services/logging/AuditLogService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'day';

    const auditLogService = new AuditLogService();
    const analytics = await auditLogService.getFraudAnalytics(timeRange as any);
    const patterns = await auditLogService.getSuspiciousPatterns(timeRange as any);

    // Calculate summary stats
    const totalFlagged = analytics.reduce((sum, day) => 
      sum + day.actions.filter((a: any) => a.outcome === 'flagged').reduce((s, a) => s + a.count, 0), 0
    );

    const fraudRate = analytics.length > 0 ? 
      (totalFlagged / analytics.reduce((sum, day) => 
        sum + day.actions.reduce((s, a) => s + a.count, 0), 0
      )) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        analytics,
        patterns,
        summary: {
          totalFlagged,
          fraudRate: Math.round(fraudRate * 100) / 100,
          suspiciousIPs: patterns.length,
          timeRange
        }
      }
    });

  } catch (error: any) {
    console.error('Get fraud analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fraud analytics' },
      { status: 500 }
    );
  }
}
```

### 2.2. Get Suspicious Patterns (Admin)
```typescript
// app/api/admin/fraud-patterns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AuditLogService } from '@/services/logging/AuditLogService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'day';

    const auditLogService = new AuditLogService();
    const patterns = await auditLogService.getSuspiciousPatterns(timeRange as any);

    return NextResponse.json({
      success: true,
      data: patterns
    });

  } catch (error: any) {
    console.error('Get fraud patterns error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fraud patterns' },
      { status: 500 }
    );
  }
}
```

## 3. Admin Review API Routes

### 3.1. Get Pending Reward Reviews (Admin)
```typescript
// app/api/admin/reward-reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Reward from '@/models/Reward';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'pending_review';

    const skip = (page - 1) * limit;

    const [rewards, total] = await Promise.all([
      Reward.find({ status })
        .populate('userId', 'email name')
        .populate('quizId', 'title slug')
        .populate('attemptId', 'score timeSpent')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Reward.countDocuments({ status })
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: rewards,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error: any) {
    console.error('Get reward reviews error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reward reviews' },
      { status: 500 }
    );
  }
}
```

### 3.2. Review Reward (Admin)
```typescript
// app/api/admin/reward-reviews/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Reward from '@/models/Reward';
import User from '@/models/User';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { action, notes } = await request.json();
    
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    await connectDB();

    const reward = await Reward.findById(params.id);
    if (!reward) {
      return NextResponse.json(
        { success: false, error: 'Reward not found' },
        { status: 404 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    // Update reward status
    await Reward.findByIdAndUpdate(params.id, {
      status: newStatus,
      reviewedBy: (session.user as any).id,
      reviewedAt: new Date(),
      reviewNotes: notes
    });

    // If approved, update user rewards
    if (action === 'approve') {
      await User.findByIdAndUpdate(reward.userId, {
        $inc: {
          'rewards.totalPoints': reward.actualReward,
          'rewards.earnedPoints': reward.actualReward
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Reward ${action}d successfully`
    });

  } catch (error: any) {
    console.error('Review reward error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to review reward' },
      { status: 500 }
    );
  }
}
```

## 4. Enhanced Quiz Attempt API

### 4.1. Submit Quiz Attempt with Fraud Detection
```typescript
// app/api/quizzes/[slug]/attempt/route.ts (Updated)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { QuizService } from '@/services/quiz/QuizService';
import { FraudDetectionService } from '@/services/fraud/FraudDetectionService';
import { AuditLogService } from '@/services/logging/AuditLogService';
import { generateSessionId, generateRequestId } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { answers, timeSpent, timePerQuestion, answerChanges, mouseMovements, keyboardPatterns } = await request.json();

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Generate session and request IDs
    const sessionId = generateSessionId();
    const requestId = generateRequestId();

    const quizService = new QuizService();
    const fraudDetectionService = new FraudDetectionService();
    const auditLogService = new AuditLogService();

    // Submit quiz attempt
    const attemptResult = await quizService.submitQuizAttempt(
      params.slug,
      answers,
      session,
      session?.user?.email
    );

    if (!attemptResult.success) {
      return NextResponse.json(attemptResult, { status: 400 });
    }

    // Calculate fraud score
    const fraudScore = await fraudDetectionService.calculateFraudScore({
      quizId: attemptResult.data.quizId,
      userId: session?.user?.id || 'anonymous',
      userTrustScore: 50, // Default for anonymous users
      userAge: 0 // Default for anonymous users
    });

    // Determine fraud flags
    const fraudFlags: string[] = [];
    if (fraudScore > 70) fraudFlags.push('high_risk');
    if (timeSpent < 30) fraudFlags.push('too_fast');
    if (mouseMovements.length < 10) fraudFlags.push('minimal_mouse');
    if (keyboardPatterns.length < 5) fraudFlags.push('minimal_keyboard');

    // Create enhanced attempt record
    const attempt = new Attempt({
      user: session?.user?.id || session?.user?.email,
      quiz: attemptResult.data.quizId,
      score: attemptResult.data.score,
      totalQuestions: attemptResult.data.totalQuestions,
      answers,
      takenAt: new Date(),
      sessionId,
      requestId,
      ipAddress,
      userAgent,
      deviceFingerprint: 'placeholder', // Will be generated on client
      timeSpent,
      timePerQuestion,
      answerChanges,
      mouseMovements,
      keyboardPatterns,
      fraudScore,
      fraudFlags,
      isFlagged: fraudScore > 70,
      flaggedReason: fraudFlags.length > 0 ? fraudFlags.join(', ') : undefined
    });

    await attempt.save();

    // Log the attempt
    await auditLogService.logQuizAttempt({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      sessionId,
      requestId,
      quizId: attemptResult.data.quizId,
      score: attemptResult.data.score,
      answers,
      timeSpent,
      timePerQuestion,
      answerChanges,
      mouseMovements,
      keyboardPatterns,
      ipAddress,
      userAgent,
      fraudScore,
      fraudFlags,
      outcome: fraudScore > 70 ? 'flagged' : 'success'
    });

    return NextResponse.json({
      success: true,
      data: {
        ...attemptResult.data,
        fraudScore,
        fraudFlags,
        isFlagged: fraudScore > 70
      }
    });

  } catch (error: any) {
    console.error('Submit quiz attempt error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit quiz attempt' },
      { status: 500 }
    );
  }
}
```

## 5. User Dashboard API Routes

### 5.1. Get User Reward Stats
```typescript
// app/api/user/reward-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Reward from '@/models/Reward';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findById((session.user as any).id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get reward statistics
    const [totalRewards, pendingRewards, approvedRewards, blockedRewards] = await Promise.all([
      Reward.countDocuments({ userId: user._id }),
      Reward.countDocuments({ userId: user._id, status: 'pending_review' }),
      Reward.countDocuments({ userId: user._id, status: 'approved' }),
      Reward.countDocuments({ userId: user._id, status: 'blocked' })
    ]);

    // Get recent rewards
    const recentRewards = await Reward.find({ userId: user._id })
      .populate('quizId', 'title slug')
      .sort({ createdAt: -1 })
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          totalPoints: user.rewards.totalPoints,
          earnedPoints: user.rewards.earnedPoints,
          spentPoints: user.rewards.spentPoints,
          tier: user.rewards.tier,
          tierMultiplier: user.rewards.tierMultiplier,
          trustScore: user.trustScore,
          fraudRiskScore: user.fraudFlags.riskScore,
          isSuspended: user.fraudFlags.isSuspended
        },
        stats: {
          totalRewards,
          pendingRewards,
          approvedRewards,
          blockedRewards
        },
        recentRewards
      }
    });

  } catch (error: any) {
    console.error('Get user reward stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reward stats' },
      { status: 500 }
    );
  }
}
```

### 5.2. Get Quiz Performance
```typescript
// app/api/user/quiz-performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const [quizzes, total] = await Promise.all([
      Quiz.find({ author: (session.user as any).id, status: 'published' })
        .select('title slug rewardStats fraudIndicators')
        .sort({ 'rewardStats.totalAttempts': -1 })
        .skip(skip)
        .limit(limit),
      Quiz.countDocuments({ author: (session.user as any).id, status: 'published' })
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: quizzes,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error: any) {
    console.error('Get quiz performance error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quiz performance' },
      { status: 500 }
    );
  }
}
```

## 6. Client-side Tracking

### 6.1. Client Logging Service
```typescript
// lib/clientLogging.ts
export class ClientLoggingService {
  private mouseMovements: Array<{ x: number; y: number; timestamp: number }> = [];
  private keyboardPatterns: Array<{ key: string; timestamp: number; timeBetweenKeys: number }> = [];
  private scrollPatterns: Array<{ scrollY: number; timestamp: number }> = [];
  private lastKeyTime = 0;
  private startTime = Date.now();

  constructor() {
    this.initializeTracking();
  }

  private initializeTracking() {
    // Mouse movement tracking
    document.addEventListener('mousemove', (e) => {
      this.mouseMovements.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now() - this.startTime,
      });
    });

    // Keyboard tracking
    document.addEventListener('keydown', (e) => {
      const now = Date.now() - this.startTime;
      this.keyboardPatterns.push({
        key: e.key,
        timestamp: now,
        timeBetweenKeys: this.lastKeyTime > 0 ? now - this.lastKeyTime : 0,
      });
      this.lastKeyTime = now;
    });

    // Scroll tracking
    document.addEventListener('scroll', () => {
      this.scrollPatterns.push({
        scrollY: window.scrollY,
        timestamp: Date.now() - this.startTime,
      });
    });
  }

  getBehavioralData() {
    return {
      mouseMovements: this.mouseMovements.slice(-100), // Keep last 100 movements
      keyboardPatterns: this.keyboardPatterns.slice(-50), // Keep last 50 patterns
      scrollPatterns: this.scrollPatterns.slice(-20), // Keep last 20 patterns
      timeSpent: Date.now() - this.startTime
    };
  }

  generateDeviceFingerprint(): string {
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

  clearData() {
    this.mouseMovements = [];
    this.keyboardPatterns = [];
    this.scrollPatterns = [];
    this.lastKeyTime = 0;
    this.startTime = Date.now();
  }
}
``` 