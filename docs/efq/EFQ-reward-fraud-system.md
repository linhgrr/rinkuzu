# EFQ Reward & Fraud Detection System

## 1. Tổng Quan Hệ Thống EFQ (Earn From Quiz)

Hệ thống EFQ khuyến khích người dùng đăng tải các đề thi chất lượng (đề cuối kỳ, giữa kỳ, đề đặc biệt, v.v.) bằng cách thưởng điểm (reward) dựa trên lượt làm quiz thực tế, đồng thời tích hợp cơ chế phát hiện gian lận (fraud detection) để đảm bảo công bằng và bền vững.

---

## 2. Cơ Chế Reward (Thưởng Điểm)

### 2.1. Nguyên tắc tính điểm
- **Reward dựa trên lượt làm quiz thực tế** (không phải chỉ upload là có điểm)
- **Điểm thưởng có thể điều chỉnh theo chất lượng, độ khó, độ phổ biến**
- **Có thể giảm, giữ lại hoặc chặn thưởng nếu phát hiện gian lận**

### 2.2. Công thức tính điểm cơ bản
```typescript
interface QuizReward {
  baseRewardPerAttempt: number;     // 1-5 điểm/lượt làm
  averageScoreMultiplier: number;   // 0.5-2.0x dựa trên điểm trung bình
  completionRateMultiplier: number; // 0.5-1.5x dựa trên tỷ lệ hoàn thành
  timeSpentMultiplier: number;      // 0.5-1.2x dựa trên thời gian làm
  difficultyBonus: number;          // 1-3 điểm bonus cho đề khó
  popularityBonus: number;          // 1-5 điểm bonus cho quiz phổ biến
  totalReward: number;              // Tổng điểm thưởng
}
```

### 2.3. Các yếu tố ảnh hưởng
- **Số lượt làm hợp lệ** (đã qua fraud filter)
- **Điểm trung bình của người làm** (càng cao càng tốt)
- **Tỷ lệ hoàn thành** (completion rate)
- **Thời gian làm trung bình** (không quá nhanh)
- **Độ khó đề** (dựa vào tỷ lệ đúng/sai)
- **Độ phổ biến** (số lượt làm, số người unique)

### 2.4. Reward tiers & bonus
```typescript
const REWARD_TIERS = {
  BRONZE: { minAttempts: 10, multiplier: 1.0, bonus: 0 },
  SILVER: { minAttempts: 50, multiplier: 1.2, bonus: 100 },
  GOLD: { minAttempts: 100, multiplier: 1.5, bonus: 500 },
  PLATINUM: { minAttempts: 200, multiplier: 2.0, bonus: 1000 }
}
```

### 2.5. Quy trình trả thưởng
- Tính reward định kỳ (hàng ngày/tuần/tháng)
- Chỉ trả thưởng cho lượt làm hợp lệ (không gian lận)
- Có thể giữ lại hoặc giảm thưởng nếu quiz bị flag gian lận
- Admin có thể review các trường hợp nghi ngờ

---

## 3. Fraud Detection System (Phát hiện gian lận)

### 3.1. Mục tiêu
- Phát hiện các hành vi gian lận (spam, auto, collusion, v.v.)
- Đảm bảo chỉ trả thưởng cho lượt làm hợp lệ
- Cảnh báo và hỗ trợ admin trong việc review

### 3.2. Các chỉ số và tín hiệu gian lận
- **Rapid Attempts**: Nhiều lượt làm trong thời gian ngắn
- **Same IP Addresses**: Nhiều lượt từ cùng IP
- **Similar Scores**: Điểm số quá giống nhau
- **Bot Patterns**: Hành vi giống bot (thời gian làm, mouse/keyboard pattern)
- **Perfect Score Frequency**: Tỷ lệ điểm tuyệt đối cao bất thường
- **Low Variance**: Độ lệch thời gian/điểm thấp

### 3.3. Mức độ rủi ro & hành động xử lý

| Risk Level | Reward Action      | User Impact         | Admin Action   |
|------------|-------------------|---------------------|---------------|
| Low (0-30) | Full reward       | Bình thường         | Không         |
| Medium(31-60)| 50% reward      | Giảm thưởng         | Theo dõi      |
| High(61-80)| Hold for review   | Giữ thưởng, cảnh báo| Manual review |
| Critical(81-100)| Block reward  | Không thưởng, có thể khóa | Điều tra ngay |

```typescript
enum FraudRiskLevel {
  LOW = 'low',           // 0-30
  MEDIUM = 'medium',     // 31-60
  HIGH = 'high',         // 61-80
  CRITICAL = 'critical'  // 81-100
}

enum FraudAction {
  ALLOW_FULL_REWARD = 'allow_full_reward',
  REDUCE_REWARD = 'reduce_reward',
  HOLD_REWARD = 'hold_reward',
  BLOCK_REWARD = 'block_reward',
  SUSPEND_USER = 'suspend_user'
}

interface FraudResponse {
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  rewardPercentage: number; // 0-100%
  reviewRequired: boolean;
  autoApproval: boolean;
  adminNotification: boolean;
  userNotification: boolean;
  reason: string;
  evidence: string[];
}
```

### 3.4. Quy trình xử lý reward khi phát hiện gian lận
- **Low risk**: Trả thưởng bình thường
- **Medium risk**: Trả 50% thưởng, cảnh báo user
- **High risk**: Giữ thưởng, yêu cầu admin review
- **Critical risk**: Block thưởng, có thể khóa tài khoản, thông báo admin

### 3.5. Mô hình dữ liệu Reward & Fraud
```typescript
export interface IReward {
  userId: string;
  quizId: string;
  attemptId: string;
  calculatedReward: number;
  actualReward: number;
  rewardPercentage: number;
  fraudScore: number;
  fraudFlags: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow_full_reward' | 'reduce_reward' | 'hold_reward' | 'block_reward' | 'suspend_user';
  status: 'pending_review' | 'approved' | 'rejected' | 'blocked';
  reason: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. Logging & Data Collection (Ghi log & thu thập dữ liệu)

### 4.1. Mục tiêu
- Thu thập dữ liệu hành vi để phục vụ phát hiện gian lận (rule-based & ML)
- Làm audit trail cho compliance, debugging, và phân tích
- Cải thiện accuracy của fraud detection qua thời gian

### 4.2. Mô hình AuditLog
```typescript
export interface IAuditLog {
  userId?: string;
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
```

### 4.3. Các trường cần log
- **Kỹ thuật**: IP, userAgent, deviceFingerprint, geoLocation
- **Hành vi**: mouse, keyboard, scroll, timeSpent, answerChanges
- **Quiz data**: score, answers, timePerQuestion
- **Fraud**: riskScore, flags, suspiciousPatterns
- **Kết quả**: outcome, reason

### 4.4. Ứng dụng
- Làm training data cho ML model detect fraud
- Phân tích pattern gian lận vs hợp lệ
- Audit trail cho admin review
- Cảnh báo real-time khi có pattern bất thường

---

## 5. Admin & User Dashboard, Business Logic Flow, API/model proposal

### 5.1. Admin Dashboard
- **Fraud Analytics**: Thống kê số lượt flag, reward bị block, suspicious IP, fraud rate
- **Reward Review**: Danh sách các reward pending review, approve/reject reward, xem chi tiết fraud evidence
- **Suspicious Patterns**: Xem các IP, user, quiz có pattern bất thường

### 5.2. User Dashboard
- **Reward History**: Xem tổng điểm, điểm đã nhận, điểm bị giữ lại, lịch sử rút thưởng
- **Fraud Warning**: Thông báo nếu reward bị giảm/giữ/block do nghi ngờ gian lận
- **Quiz Performance**: Thống kê lượt làm, điểm trung bình, reward earned cho từng quiz

### 5.3. Business Logic Flow
1. User upload quiz → admin duyệt → quiz được publish
2. User khác làm quiz → hệ thống ghi log hành vi, tính fraud score
3. Định kỳ (hoặc real-time), hệ thống tính reward cho quiz owner dựa trên lượt làm hợp lệ
4. Nếu phát hiện gian lận:
   - Low risk: trả thưởng bình thường
   - Medium: giảm thưởng, cảnh báo
   - High: giữ thưởng, chờ admin review
   - Critical: block thưởng, có thể khóa tài khoản
5. Admin có thể override quyết định tự động
6. User được thông báo về trạng thái reward

### 5.4. API/model proposal (ví dụ)
```http
POST /api/quizzes/:id/attempt         # Ghi nhận attempt, log hành vi
POST /api/rewards/calculate           # Tính reward cho quiz owner
GET  /api/admin/fraud-analytics       # Thống kê fraud cho admin
GET  /api/admin/reward-reviews        # Danh sách reward pending review
POST /api/admin/reward-reviews/:id    # Approve/reject reward
GET  /api/user/rewards                # Lịch sử reward của user
```

### 5.5. Hướng dẫn triển khai
- Ưu tiên implement logging & fraud detection trước (càng nhiều data càng tốt)
- Bắt đầu với rule-based fraud, sau đó bổ sung ML model khi đủ data
- Tích hợp dashboard cho admin và user để tăng minh bạch
- Luôn cho phép admin override quyết định tự động
- Đảm bảo audit trail đầy đủ để phục vụ compliance và debugging

---

**File này là blueprint tổng thể cho hệ thống EFQ reward + fraud detection. Có thể mở rộng, điều chỉnh theo thực tế triển khai.** 