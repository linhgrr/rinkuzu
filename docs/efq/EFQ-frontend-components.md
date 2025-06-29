# EFQ Frontend Components

## 1. User Dashboard Components

### 1.1. User Reward Dashboard
```typescript
// components/efq/UserRewardDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';

interface RewardStats {
  user: {
    totalPoints: number;
    earnedPoints: number;
    spentPoints: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    tierMultiplier: number;
    trustScore: number;
    fraudRiskScore: number;
    isSuspended: boolean;
  };
  stats: {
    totalRewards: number;
    pendingRewards: number;
    approvedRewards: number;
    blockedRewards: number;
  };
  recentRewards: Array<{
    _id: string;
    calculatedReward: number;
    actualReward: number;
    status: string;
    createdAt: string;
    quizId: {
      title: string;
      slug: string;
    };
  }>;
}

export default function UserRewardDashboard() {
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewardStats();
  }, []);

  const fetchRewardStats = async () => {
    try {
      const response = await fetch('/api/user/reward-stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch reward stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!stats) {
    return <div className="p-8 text-center">Failed to load reward stats</div>;
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'text-purple-600';
      case 'gold': return 'text-yellow-600';
      case 'silver': return 'text-gray-600';
      default: return 'text-orange-600';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return '💎';
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      default: return '🥉';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reward Dashboard</h1>
        <Button onClick={fetchRewardStats} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Suspension Warning */}
      {stats.user.isSuspended && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center text-red-700">
              <span className="mr-2">⚠️</span>
              <span>Your account is suspended due to suspicious activity. Rewards are temporarily blocked.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user.totalPoints}</div>
            <p className="text-xs text-gray-500">
              +{stats.user.earnedPoints} earned, -{stats.user.spentPoints} spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Current Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <span className="text-2xl mr-2">{getTierIcon(stats.user.tier)}</span>
              <div>
                <div className={`text-lg font-bold capitalize ${getTierColor(stats.user.tier)}`}>
                  {stats.user.tier}
                </div>
                <p className="text-xs text-gray-500">
                  {stats.user.tierMultiplier}x multiplier
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Trust Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user.trustScore}</div>
            <Progress value={stats.user.trustScore} className="mt-2" />
            <p className="text-xs text-gray-500 mt-1">
              {stats.user.trustScore >= 80 ? 'Excellent' : 
               stats.user.trustScore >= 60 ? 'Good' : 
               stats.user.trustScore >= 40 ? 'Fair' : 'Poor'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user.fraudRiskScore}</div>
            <Progress 
              value={stats.user.fraudRiskScore} 
              className="mt-2"
              style={{ 
                '--progress-color': stats.user.fraudRiskScore > 70 ? '#ef4444' : 
                                   stats.user.fraudRiskScore > 40 ? '#f59e0b' : '#10b981'
              } as any}
            />
            <p className="text-xs text-gray-500 mt-1">
              {stats.user.fraudRiskScore > 70 ? 'High Risk' : 
               stats.user.fraudRiskScore > 40 ? 'Medium Risk' : 'Low Risk'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reward Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Reward Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.stats.totalRewards}</div>
              <div className="text-sm text-gray-600">Total Rewards</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.stats.approvedRewards}</div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.stats.pendingRewards}</div>
              <div className="text-sm text-gray-600">Pending Review</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.stats.blockedRewards}</div>
              <div className="text-sm text-gray-600">Blocked</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Rewards */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentRewards.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No rewards yet</p>
          ) : (
            <div className="space-y-3">
              {stats.recentRewards.map((reward) => (
                <div key={reward._id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{reward.quizId.title}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(reward.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {reward.actualReward} / {reward.calculatedReward} points
                    </div>
                    <div className={`text-sm ${
                      reward.status === 'approved' ? 'text-green-600' :
                      reward.status === 'pending_review' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {reward.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 1.2. Quiz Performance Component
```typescript
// components/efq/QuizPerformance.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface QuizPerformance {
  _id: string;
  title: string;
  slug: string;
  rewardStats: {
    totalAttempts: number;
    validAttempts: number;
    averageScore: number;
    completionRate: number;
    averageTimeSpent: number;
    totalRewardsPaid: number;
    difficultyScore: number;
    popularityScore: number;
  };
  fraudIndicators: {
    riskScore: number;
    flaggedAttempts: number;
  };
}

export default function QuizPerformance() {
  const [quizzes, setQuizzes] = useState<QuizPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchQuizPerformance();
  }, [page]);

  const fetchQuizPerformance = async () => {
    try {
      const response = await fetch(`/api/user/quiz-performance?page=${page}&limit=10`);
      const data = await response.json();
      if (data.success) {
        if (page === 1) {
          setQuizzes(data.data);
        } else {
          setQuizzes(prev => [...prev, ...data.data]);
        }
        setHasMore(data.pagination.hasNextPage);
      }
    } catch (error) {
      console.error('Failed to fetch quiz performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore > 70) return 'text-red-600';
    if (riskScore > 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getDifficultyColor = (score: number) => {
    if (score < 30) return 'text-red-600';
    if (score < 50) return 'text-yellow-600';
    if (score < 70) return 'text-blue-600';
    return 'text-green-600';
  };

  if (loading && page === 1) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Quiz Performance</h2>
        <Button onClick={() => window.location.reload()} variant="outline">
          Refresh
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No quizzes created yet</p>
            <Link href="/create">
              <Button className="mt-4">Create Your First Quiz</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <Card key={quiz._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      <Link href={`/quiz/${quiz.slug}`} className="hover:underline">
                        {quiz.title}
                      </Link>
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getRiskColor(quiz.fraudIndicators.riskScore)}`}>
                      Risk: {quiz.fraudIndicators.riskScore}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {quiz.fraudIndicators.flaggedAttempts} flagged attempts
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">{quiz.rewardStats.totalAttempts}</div>
                    <div className="text-xs text-gray-600">Total Attempts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{quiz.rewardStats.validAttempts}</div>
                    <div className="text-xs text-gray-600">Valid Attempts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{quiz.rewardStats.averageScore.toFixed(1)}%</div>
                    <div className="text-xs text-gray-600">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{quiz.rewardStats.totalRewardsPaid}</div>
                    <div className="text-xs text-gray-600">Rewards Paid</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-sm font-medium ${getDifficultyColor(quiz.rewardStats.difficultyScore)}`}>
                      {quiz.rewardStats.difficultyScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">Difficulty</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{quiz.rewardStats.popularityScore.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Popularity</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{quiz.rewardStats.completionRate.toFixed(1)}%</div>
                    <div className="text-xs text-gray-600">Completion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {Math.round(quiz.rewardStats.averageTimeSpent / 60)}m
                    </div>
                    <div className="text-xs text-gray-600">Avg Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center">
              <Button 
                onClick={() => setPage(prev => prev + 1)}
                variant="outline"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## 2. Admin Dashboard Components

### 2.1. Admin Fraud Analytics Dashboard
```typescript
// components/admin/FraudAnalyticsDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface FraudAnalytics {
  analytics: Array<{
    _id: string;
    actions: Array<{
      action: string;
      outcome: string;
      count: number;
      avgFraudScore: number;
      uniqueUsers: number;
      uniqueIPs: number;
      uniqueDevices: number;
    }>;
  }>;
  patterns: Array<{
    _id: string;
    attempts: number;
    avgScore: number;
    avgTimeSpent: number;
    uniqueUsers: number;
    fraudFlags: string[][];
    suspiciousPatterns: string[][];
  }>;
  summary: {
    totalFlagged: number;
    fraudRate: number;
    suspiciousIPs: number;
    timeRange: string;
  };
}

export default function FraudAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<FraudAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('day');

  useEffect(() => {
    fetchFraudAnalytics();
  }, [timeRange]);

  const fetchFraudAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/fraud-analytics?timeRange=${timeRange}`);
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch fraud analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!analytics) {
    return <div className="p-8 text-center">Failed to load fraud analytics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Fraud Analytics Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Select
            value={timeRange}
            onValueChange={setTimeRange}
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </Select>
          <Button onClick={fetchFraudAnalytics} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Flagged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {analytics.summary.totalFlagged}
            </div>
            <p className="text-xs text-gray-500">
              Suspicious activities detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Fraud Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analytics.summary.fraudRate}%
            </div>
            <p className="text-xs text-gray-500">
              Percentage of flagged activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Suspicious IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {analytics.summary.suspiciousIPs}
            </div>
            <p className="text-xs text-gray-500">
              IPs with suspicious patterns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Time Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}
            </div>
            <p className="text-xs text-gray-500">
              Data period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Analytics Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.analytics.map((day) => (
              <div key={day._id} className="border rounded-lg p-4">
                <div className="font-medium mb-2">{day._id}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {day.actions.map((action) => (
                    <div key={`${action.action}-${action.outcome}`} className="text-center">
                      <div className="text-lg font-bold">
                        {action.count}
                      </div>
                      <div className="text-xs text-gray-600">
                        {action.action} - {action.outcome}
                      </div>
                      {action.avgFraudScore > 0 && (
                        <div className="text-xs text-red-600">
                          Avg Risk: {action.avgFraudScore.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suspicious Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Suspicious IP Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.patterns.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No suspicious patterns detected</p>
          ) : (
            <div className="space-y-4">
              {analytics.patterns.slice(0, 10).map((pattern) => (
                <div key={pattern._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono text-sm">{pattern._id}</div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {pattern.attempts} attempts
                      </div>
                      <div className="text-xs text-gray-500">
                        {pattern.uniqueUsers} unique users
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Avg Score:</span>
                      <span className="ml-1 font-medium">{pattern.avgScore.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg Time:</span>
                      <span className="ml-1 font-medium">
                        {Math.round(pattern.avgTimeSpent / 60)}m
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Flags:</span>
                      <span className="ml-1 font-medium">
                        {pattern.fraudFlags.flat().length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Patterns:</span>
                      <span className="ml-1 font-medium">
                        {pattern.suspiciousPatterns.flat().length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2.2. Admin Reward Review Component
```typescript
// components/admin/RewardReviewPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';

interface RewardReview {
  _id: string;
  calculatedReward: number;
  actualReward: number;
  rewardPercentage: number;
  fraudScore: number;
  fraudFlags: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  status: string;
  reason: string;
  createdAt: string;
  userId: {
    email: string;
    name?: string;
  };
  quizId: {
    title: string;
    slug: string;
  };
  attemptId?: {
    score: number;
    timeSpent: number;
  };
}

export default function RewardReviewPanel() {
  const [rewards, setRewards] = useState<RewardReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedReward, setSelectedReward] = useState<RewardReview | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    fetchRewardReviews();
  }, [page]);

  const fetchRewardReviews = async () => {
    try {
      const response = await fetch(`/api/admin/reward-reviews?page=${page}&limit=20`);
      const data = await response.json();
      if (data.success) {
        if (page === 1) {
          setRewards(data.data);
        } else {
          setRewards(prev => [...prev, ...data.data]);
        }
        setHasMore(data.pagination.hasNextPage);
      }
    } catch (error) {
      console.error('Failed to fetch reward reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedReward) return;

    try {
      setReviewing(true);
      const response = await fetch(`/api/admin/reward-reviews/${selectedReward._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: reviewNotes })
      });

      const data = await response.json();
      if (data.success) {
        // Remove the reviewed reward from the list
        setRewards(prev => prev.filter(r => r._id !== selectedReward._id));
        setSelectedReward(null);
        setReviewNotes('');
      }
    } catch (error) {
      console.error('Failed to review reward:', error);
    } finally {
      setReviewing(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  if (loading && page === 1) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reward Reviews</h1>
        <Button onClick={() => window.location.reload()} variant="outline">
          Refresh
        </Button>
      </div>

      {rewards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No pending reward reviews</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rewards.map((reward) => (
            <Card key={reward._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{reward.quizId.title}</CardTitle>
                    <p className="text-sm text-gray-600">
                      by {reward.userId.name || reward.userId.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(reward.riskLevel)}`}>
                      {reward.riskLevel.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(reward.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">{reward.calculatedReward}</div>
                    <div className="text-xs text-gray-600">Calculated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{reward.actualReward}</div>
                    <div className="text-xs text-gray-600">Actual</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{reward.fraudScore}%</div>
                    <div className="text-xs text-gray-600">Risk Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{reward.fraudFlags.length}</div>
                    <div className="text-xs text-gray-600">Flags</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Reason:</span>
                    <span className="text-sm text-gray-600 ml-2">{reward.reason}</span>
                  </div>
                  {reward.fraudFlags.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Flags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {reward.fraudFlags.map((flag, index) => (
                          <span key={index} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {reward.attemptId && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Score:</span>
                        <span className="ml-2 font-medium">{reward.attemptId.score}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Time:</span>
                        <span className="ml-2 font-medium">
                          {Math.round(reward.attemptId.timeSpent / 60)}m
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    onClick={() => setSelectedReward(reward)}
                    variant="outline"
                    size="sm"
                  >
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center">
              <Button 
                onClick={() => setPage(prev => prev + 1)}
                variant="outline"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={!!selectedReward}
        onClose={() => setSelectedReward(null)}
        title="Review Reward"
      >
        {selectedReward && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">{selectedReward.quizId.title}</h3>
              <p className="text-sm text-gray-600">
                by {selectedReward.userId.name || selectedReward.userId.email}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium">Calculated:</span>
                <div className="text-lg font-bold">{selectedReward.calculatedReward} points</div>
              </div>
              <div>
                <span className="text-sm font-medium">Actual:</span>
                <div className="text-lg font-bold">{selectedReward.actualReward} points</div>
              </div>
            </div>

            <div>
              <span className="text-sm font-medium">Risk Level:</span>
              <div className={`inline-block px-2 py-1 rounded text-sm font-medium ${getRiskColor(selectedReward.riskLevel)}`}>
                {selectedReward.riskLevel.toUpperCase()}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium">Reason:</span>
              <p className="text-sm text-gray-600 mt-1">{selectedReward.reason}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Review Notes:</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about your decision..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => setSelectedReward(null)}
                variant="outline"
                disabled={reviewing}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleReview('reject')}
                variant="destructive"
                disabled={reviewing}
              >
                Reject
              </Button>
              <Button
                onClick={() => handleReview('approve')}
                disabled={reviewing}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
```

## 3. Enhanced Quiz Components

### 3.1. Quiz Attempt with Behavioral Tracking
```typescript
// components/quiz/QuizAttemptTracker.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ClientLoggingService } from '@/lib/clientLogging';

interface QuizAttemptTrackerProps {
  onComplete: (data: any) => void;
  quizId: string;
}

export default function QuizAttemptTracker({ onComplete, quizId }: QuizAttemptTrackerProps) {
  const [answers, setAnswers] = useState<(number | number[])[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState<number[]>([]);
  const [answerChanges, setAnswerChanges] = useState<Array<{
    questionIndex: number;
    oldAnswer: number | number[];
    newAnswer: number | number[];
    timestamp: number;
  }>>([]);
  const [isComplete, setIsComplete] = useState(false);
  
  const loggingService = useRef<ClientLoggingService>();
  const questionStartTime = useRef<number>(Date.now());
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    loggingService.current = new ClientLoggingService();
    
    const timer = setInterval(() => {
      setTimeSpent(Date.now() - startTime.current);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    questionStartTime.current = Date.now();
  }, [currentQuestion]);

  const handleAnswerChange = (questionIndex: number, newAnswer: number | number[]) => {
    const oldAnswer = answers[questionIndex];
    
    if (oldAnswer !== undefined && JSON.stringify(oldAnswer) !== JSON.stringify(newAnswer)) {
      setAnswerChanges(prev => [...prev, {
        questionIndex,
        oldAnswer,
        newAnswer,
        timestamp: Date.now() - startTime.current
      }]);
    }

    const newAnswers = [...answers];
    newAnswers[questionIndex] = newAnswer;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    const questionTime = Date.now() - questionStartTime.current;
    setTimePerQuestion(prev => [...prev, questionTime]);
    
    if (currentQuestion < 10) { // Assuming 10 questions
      setCurrentQuestion(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    if (isComplete) return;
    
    setIsComplete(true);
    
    const behavioralData = loggingService.current?.getBehavioralData();
    
    onComplete({
      answers,
      timeSpent,
      timePerQuestion,
      answerChanges,
      mouseMovements: behavioralData?.mouseMovements || [],
      keyboardPatterns: behavioralData?.keyboardPatterns || [],
      deviceFingerprint: loggingService.current?.generateDeviceFingerprint()
    });
  };

  return (
    <div className="space-y-4">
      {/* Progress and Timer */}
      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
        <div className="text-sm">
          Question {currentQuestion + 1} of 10
        </div>
        <div className="text-sm font-medium">
          Time: {Math.floor(timeSpent / 60000)}:{(Math.floor(timeSpent / 1000) % 60).toString().padStart(2, '0')}
        </div>
      </div>

      {/* Question Content */}
      <div className="p-6 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">
          Question {currentQuestion + 1}
        </h3>
        
        {/* Question content would go here */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name={`question-${currentQuestion}`}
              value="0"
              checked={answers[currentQuestion] === 0}
              onChange={() => handleAnswerChange(currentQuestion, 0)}
            />
            <span>Option A</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name={`question-${currentQuestion}`}
              value="1"
              checked={answers[currentQuestion] === 1}
              onChange={() => handleAnswerChange(currentQuestion, 1)}
            />
            <span>Option B</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name={`question-${currentQuestion}`}
              value="2"
              checked={answers[currentQuestion] === 2}
              onChange={() => handleAnswerChange(currentQuestion, 2)}
            />
            <span>Option C</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name={`question-${currentQuestion}`}
              value="3"
              checked={answers[currentQuestion] === 3}
              onChange={() => handleAnswerChange(currentQuestion, 3)}
            />
            <span>Option D</span>
          </label>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
          disabled={currentQuestion === 0}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
        >
          Previous
        </button>
        
        {currentQuestion < 9 ? (
          <button
            onClick={handleNextQuestion}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={isComplete}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {isComplete ? 'Submitting...' : 'Complete Quiz'}
          </button>
        )}
      </div>
    </div>
  );
}
``` 