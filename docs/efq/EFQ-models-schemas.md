# EFQ Models & Schemas

## 1. User Model (Cập nhật)

```typescript
// models/User.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  name?: string;
  role: 'admin' | 'user';
  isAnonymous?: boolean;
  
  // Subscription (existing)
  subscription?: {
    type: string;
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
    payosOrderId?: string;
    payosTransactionId?: string;
  };
  
  // EFQ Rewards (new)
  rewards: {
    totalPoints: number;
    earnedPoints: number;
    spentPoints: number;
    lastRewardCalculation: Date;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    tierMultiplier: number;
  };
  
  // Fraud Detection (new)
  fraudFlags: {
    riskScore: number;
    flaggedAt?: Date;
    reason?: string;
    isSuspended: boolean;
    suspendedAt?: Date;
    suspensionReason?: string;
    blockedRewards: number;
    lastBlockedAt?: Date;
    totalFlaggedAttempts: number;
  };
  
  // Trust Score (new)
  trustScore: number;
  trustFactors: {
    accountAge: number;
    totalQuizzes: number;
    totalAttempts: number;
    averageScore: number;
    reportCount: number;
    lastActivity: Date;
  };
  
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: function(this: IUser) {
      return !this.isAnonymous;
    },
    minlength: [6, 'Password must be at least 6 characters'],
  },
  name: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  
  // Subscription (existing)
  subscription: {
    type: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    payosOrderId: {
      type: String,
    },
    payosTransactionId: {
      type: String,
    },
  },
  
  // EFQ Rewards (new)
  rewards: {
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    earnedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    spentPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRewardCalculation: {
      type: Date,
      default: Date.now,
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
    tierMultiplier: {
      type: Number,
      default: 1.0,
      min: 1.0,
      max: 2.0,
    },
  },
  
  // Fraud Detection (new)
  fraudFlags: {
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    flaggedAt: Date,
    reason: String,
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspendedAt: Date,
    suspensionReason: String,
    blockedRewards: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastBlockedAt: Date,
    totalFlaggedAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  
  // Trust Score (new)
  trustScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
  },
  trustFactors: {
    accountAge: {
      type: Number,
      default: 0,
    },
    totalQuizzes: {
      type: Number,
      default: 0,
    },
    totalAttempts: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ 'rewards.totalPoints': -1 });
UserSchema.index({ 'fraudFlags.riskScore': -1 });
UserSchema.index({ trustScore: -1 });
UserSchema.index({ 'fraudFlags.isSuspended': 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
```

## 2. Quiz Model (Cập nhật)

```typescript
// models/Quiz.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuiz extends Document {
  title: string;
  description?: string;
  category: Types.ObjectId;
  status: 'pending' | 'published' | 'rejected';
  author: Types.ObjectId;
  slug: string;
  questions: IQuestion[];
  isPrivate: boolean;
  
  // EFQ Reward Stats (new)
  rewardStats: {
    totalAttempts: number;
    validAttempts: number;
    averageScore: number;
    completionRate: number;
    averageTimeSpent: number;
    totalRewardsPaid: number;
    lastRewardCalculation: Date;
    difficultyScore: number;
    popularityScore: number;
  };
  
  // Fraud Detection (new)
  fraudIndicators: {
    riskScore: number;
    flaggedAttempts: number;
    suspiciousIPs: string[];
    lastFraudCheck: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema = new Schema<IQuiz>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  status: {
    type: String,
    enum: ['pending', 'published', 'rejected'],
    default: 'pending',
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required'],
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
  },
  questions: {
    type: [QuestionSchema],
    required: [true, 'Questions are required'],
    validate: {
      validator: function(questions: IQuestion[]) {
        return questions.length > 0;
      },
      message: 'At least one question is required',
    },
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  
  // EFQ Reward Stats (new)
  rewardStats: {
    totalAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    validAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    averageTimeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRewardsPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRewardCalculation: {
      type: Date,
      default: Date.now,
    },
    difficultyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  
  // Fraud Detection (new)
  fraudIndicators: {
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    flaggedAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    suspiciousIPs: [String],
    lastFraudCheck: {
      type: Date,
      default: Date.now,
    },
  },
}, {
  timestamps: true,
});

// Indexes
QuizSchema.index({ status: 1, createdAt: -1 });
QuizSchema.index({ author: 1, createdAt: -1 });
QuizSchema.index({ 'rewardStats.totalAttempts': -1 });
QuizSchema.index({ 'fraudIndicators.riskScore': -1 });

export default mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', QuizSchema);
```

## 3. Attempt Model (Cập nhật)

```typescript
// models/Attempt.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttempt extends Document {
  user?: Types.ObjectId | string;
  quiz: Types.ObjectId;
  score: number;
  totalQuestions: number;
  answers: (number | number[])[];
  takenAt: Date;
  
  // Enhanced logging fields (new)
  sessionId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  
  // Behavioral data (new)
  timeSpent: number;
  timePerQuestion: number[];
  answerChanges: Array<{
    questionIndex: number;
    oldAnswer: number | number[];
    newAnswer: number | number[];
    timestamp: number;
  }>;
  
  // Mouse and keyboard tracking (new)
  mouseMovements: Array<{
    x: number;
    y: number;
    timestamp: number;
  }>;
  keyboardPatterns: Array<{
    key: string;
    timestamp: number;
    timeBetweenKeys: number;
  }>;
  
  // Fraud detection (new)
  fraudScore: number;
  fraudFlags: string[];
  isFlagged: boolean;
  flaggedAt?: Date;
  flaggedReason?: string;
  
  // Reward calculation (new)
  rewardEarned: number;
  rewardMultiplier: number;
  rewardReason: string;
}

const AttemptSchema = new Schema<IAttempt>({
  user: {
    type: Schema.Types.Mixed,
    ref: 'User',
    required: false,
  },
  quiz: {
    type: Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required'],
  },
  score: {
    type: Number,
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative'],
    max: [100, 'Score cannot exceed 100'],
  },
  totalQuestions: {
    type: Number,
    required: [true, 'Total questions is required'],
  },
  answers: {
    type: [Schema.Types.Mixed],
    required: [true, 'Answers are required'],
  },
  takenAt: {
    type: Date,
    default: Date.now,
  },
  
  // Enhanced logging fields (new)
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  requestId: {
    type: String,
    required: true,
    index: true,
  },
  ipAddress: {
    type: String,
    required: true,
    index: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  deviceFingerprint: {
    type: String,
    required: true,
    index: true,
  },
  
  // Behavioral data (new)
  timeSpent: {
    type: Number,
    required: true,
    min: 0,
  },
  timePerQuestion: [{
    type: Number,
    min: 0,
  }],
  answerChanges: [{
    questionIndex: {
      type: Number,
      required: true,
    },
    oldAnswer: Schema.Types.Mixed,
    newAnswer: Schema.Types.Mixed,
    timestamp: {
      type: Number,
      required: true,
    },
  }],
  
  // Mouse and keyboard tracking (new)
  mouseMovements: [{
    x: Number,
    y: Number,
    timestamp: Number,
  }],
  keyboardPatterns: [{
    key: String,
    timestamp: Number,
    timeBetweenKeys: Number,
  }],
  
  // Fraud detection (new)
  fraudScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  fraudFlags: [String],
  isFlagged: {
    type: Boolean,
    default: false,
  },
  flaggedAt: Date,
  flaggedReason: String,
  
  // Reward calculation (new)
  rewardEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
  rewardMultiplier: {
    type: Number,
    default: 1.0,
    min: 0,
  },
  rewardReason: String,
});

// Indexes
AttemptSchema.index({ user: 1, takenAt: -1 });
AttemptSchema.index({ quiz: 1, takenAt: -1 });
AttemptSchema.index({ sessionId: 1 });
AttemptSchema.index({ ipAddress: 1, takenAt: -1 });
AttemptSchema.index({ deviceFingerprint: 1, takenAt: -1 });
AttemptSchema.index({ fraudScore: -1 });
AttemptSchema.index({ isFlagged: 1 });

export default mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);
```

## 4. Reward Model (Mới)

```typescript
// models/Reward.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReward extends Document {
  userId: Types.ObjectId;
  quizId: Types.ObjectId;
  attemptId: Types.ObjectId;
  
  // Reward calculation
  calculatedReward: number;
  actualReward: number;
  rewardPercentage: number;
  
  // Fraud detection
  fraudScore: number;
  fraudFlags: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow_full_reward' | 'reduce_reward' | 'hold_reward' | 'block_reward' | 'suspend_user';
  
  // Status
  status: 'pending_review' | 'approved' | 'rejected' | 'blocked';
  reason: string;
  
  // Review process
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema = new Schema<IReward>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  quizId: {
    type: Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true,
  },
  attemptId: {
    type: Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    index: true,
  },
  calculatedReward: {
    type: Number,
    required: true,
    min: 0,
  },
  actualReward: {
    type: Number,
    required: true,
    min: 0,
  },
  rewardPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  fraudScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  fraudFlags: [String],
  riskLevel: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
  },
  action: {
    type: String,
    required: true,
    enum: ['allow_full_reward', 'reduce_reward', 'hold_reward', 'block_reward', 'suspend_user'],
  },
  status: {
    type: String,
    required: true,
    enum: ['pending_review', 'approved', 'rejected', 'blocked'],
    default: 'pending_review',
  },
  reason: {
    type: String,
    required: true,
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
  reviewNotes: String,
}, {
  timestamps: true,
});

// Indexes
RewardSchema.index({ userId: 1, createdAt: -1 });
RewardSchema.index({ status: 1, createdAt: -1 });
RewardSchema.index({ riskLevel: 1, createdAt: -1 });
RewardSchema.index({ fraudScore: -1, createdAt: -1 });

export default mongoose.models.Reward || mongoose.model<IReward>('Reward', RewardSchema);
```

## 5. AuditLog Model (Mới)

```typescript
// models/AuditLog.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId | string;
  userEmail?: string;
  sessionId: string;
  requestId: string;
  action: 'quiz_attempt' | 'quiz_creation' | 'user_login' | 'user_register' | 'reward_earned' | 'fraud_detected';
  resourceType: 'quiz' | 'user' | 'attempt' | 'reward';
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  geoLocation?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  timestamp: Date;
  timeSpent?: number;
  timeOfDay: number;
  dayOfWeek: number;
  mouseMovements?: Array<{ x: number; y: number; timestamp: number }>;
  keyboardPatterns?: Array<{ key: string; timestamp: number; timeBetweenKeys: number }>;
  scrollPatterns?: Array<{ scrollY: number; timestamp: number }>;
  quizAttemptData?: {
    quizId: string;
    score: number;
    answers: (number | number[])[];
    correctAnswers: number;
    totalQuestions: number;
    timePerQuestion: number[];
    answerChanges: Array<{
      questionIndex: number;
      oldAnswer: number | number[];
      newAnswer: number | number[];
      timestamp: number;
    }>;
  };
  fraudIndicators?: {
    riskScore: number;
    flags: string[];
    suspiciousPatterns: string[];
    machineLearningScore?: number;
  };
  outcome: 'success' | 'failure' | 'flagged' | 'blocked';
  outcomeReason?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: {
    type: Schema.Types.Mixed,
    ref: 'User',
    required: false,
  },
  userEmail: {
    type: String,
    required: false,
    lowercase: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  requestId: {
    type: String,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['quiz_attempt', 'quiz_creation', 'user_login', 'user_register', 'reward_earned', 'fraud_detected'],
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['quiz', 'user', 'attempt', 'reward'],
  },
  resourceId: {
    type: String,
    required: false,
  },
  ipAddress: {
    type: String,
    required: true,
    index: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  deviceFingerprint: {
    type: String,
    required: true,
    index: true,
  },
  geoLocation: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number,
  },
  timestamp: {
    type: Date,
    required: true,
    index: true,
  },
  timeSpent: {
    type: Number,
    required: false,
  },
  timeOfDay: {
    type: Number,
    required: true,
    min: 0,
    max: 23,
  },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6,
  },
  mouseMovements: [{
    x: Number,
    y: Number,
    timestamp: Number,
  }],
  keyboardPatterns: [{
    key: String,
    timestamp: Number,
    timeBetweenKeys: Number,
  }],
  scrollPatterns: [{
    scrollY: Number,
    timestamp: Number,
  }],
  quizAttemptData: {
    quizId: String,
    score: Number,
    answers: [Schema.Types.Mixed],
    correctAnswers: Number,
    totalQuestions: Number,
    timePerQuestion: [Number],
    answerChanges: [{
      questionIndex: Number,
      oldAnswer: Schema.Types.Mixed,
      newAnswer: Schema.Types.Mixed,
      timestamp: Number,
    }],
  },
  fraudIndicators: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    flags: [String],
    suspiciousPatterns: [String],
    machineLearningScore: Number,
  },
  outcome: {
    type: String,
    required: true,
    enum: ['success', 'failure', 'flagged', 'blocked'],
  },
  outcomeReason: String,
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ deviceFingerprint: 1, timestamp: -1 });
AuditLogSchema.index({ 'fraudIndicators.riskScore': -1, timestamp: -1 });
AuditLogSchema.index({ outcome: 1, timestamp: -1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
``` 