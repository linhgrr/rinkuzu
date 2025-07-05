# Subscription Time Management

## Overview

Hệ thống quản lý thời gian subscription được thiết kế để tự động theo dõi và cập nhật trạng thái của các subscription đã hết hạn.

## Architecture

### 3-Layer Architecture Compliance

```
┌─────────────────────────────────────────┐
│               Interface Layer            │
│  ISubscriptionService, IPayOSService    │
│  ISubscriptionRepository                 │
├─────────────────────────────────────────┤
│               Service Layer              │
│  SubscriptionService, PayOSService      │
├─────────────────────────────────────────┤
│              Repository Layer            │
│  SubscriptionRepository                  │
└─────────────────────────────────────────┘
```

### Key Components

1. **ISubscriptionService Interface**: Định nghĩa contract cho subscription operations
2. **SubscriptionService**: Business logic implementation với dependency injection
3. **ISubscriptionRepository Interface**: Data access contract
4. **SubscriptionRepository**: MongoDB data access implementation
5. **IPayOSService Interface**: Payment service contract
6. **PayOSService**: External payment service wrapper

## Time Management Features

### 1. Subscription Types

- **Lifetime**: `endDate` = `undefined` - Không bao giờ hết hạn
- **Time-limited**: `endDate` = calculated date - Có thời hạn cụ thể

### 2. Expiration Logic

```typescript
// Check if subscription is premium
async isUserPremium(userId: string): Promise<boolean> {
  const subscription = await this.getUserSubscription(userId);
  if (!subscription) return false;

  // Check if subscription is active
  if (!subscription.isActive) return false;

  // Check if subscription has end date
  if (subscription.endDate) {
    return new Date() < subscription.endDate;
  }

  // If no end date, assume it's a lifetime subscription
  return true;
}
```

### 3. Automated Expiration Management

#### Background Job
- **Script**: `src/scripts/checkExpiredSubscriptions.js`
- **Schedule**: Daily at 1:00 AM
- **Function**: Finds and updates expired subscriptions

#### Manual Trigger
- **API Endpoint**: `POST /api/admin/subscriptions/check-expired`
- **Access**: Admin only
- **Usage**: Manual trigger for testing or emergency updates

### 4. Expiration Process

1. **Find Expired Subscriptions**:
   ```sql
   {
     isActive: true,
     endDate: { $exists: true, $lt: new Date() },
     status: 'completed'
   }
   ```

2. **Update Subscription Record**:
   - Set `isActive: false`
   - Set `status: 'expired'`

3. **Update User Record**:
   - Set `subscription.isActive: false`

## Duration Calculation

### Plan Duration Parsing
```typescript
const durationText = plan.duration.toLowerCase();
if (durationText.includes('tháng') || durationText.includes('month')) {
  const months = parseInt(durationText.match(/\d+/)?.[0] || '0');
  if (months > 0) {
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
  }
}
```

### Supported Duration Formats
- `"1 tháng"` → 1 month
- `"3 tháng"` → 3 months
- `"12 tháng"` → 12 months
- `"lifetime"` → No expiration

## Deployment Setup

### 1. Cron Job Setup (Production)

```bash
# Add to server crontab
0 1 * * * cd /path/to/app && node src/scripts/checkExpiredSubscriptions.js
```

### 2. Docker Setup

```dockerfile
# Add to Dockerfile
COPY src/scripts/checkExpiredSubscriptions.js /app/scripts/
```

### 3. Environment Variables

```env
# Required for PayOS integration
PAYOS_CLIENT_ID=your_client_id
PAYOS_API_KEY=your_api_key
PAYOS_CHECKSUM_KEY=your_checksum_key
```

## Monitoring & Logging

### Log Messages
- `Starting expired subscription check...`
- `Expired subscription check completed successfully`
- `Error checking expired subscriptions: [error]`

### Admin Dashboard
- View subscription status in `/admin/subscriptions`
- Manual status updates
- Bulk operations support

## Best Practices

### 1. Error Handling
- Graceful failure handling in background jobs
- Comprehensive logging for debugging
- Retry mechanism for failed updates

### 2. Performance
- Efficient database queries with indexes
- Batch processing for large datasets
- Connection pooling for database operations

### 3. Testing
- Unit tests for time calculation logic
- Integration tests for expiration process
- Mock external dependencies (PayOS)

## API Endpoints

### Check User Subscription Status
```
GET /api/subscription/status
Returns: { subscription, isPremium }
```

### Admin: Manual Expiration Check
```
POST /api/admin/subscriptions/check-expired
Access: Admin only
Returns: { success, message }
```

### Admin: View All Subscriptions
```
GET /api/admin/subscriptions
Query params: page, limit, status, search
Returns: paginated subscription list
```

## Database Schema

### Subscription Model
```typescript
{
  user: ObjectId,
  userEmail: string,
  type: string, // Plan ID
  amount: number,
  currency: 'VND',
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired',
  payosOrderId: string,
  payosTransactionId?: string,
  payosPaymentUrl?: string,
  startDate?: Date,
  endDate?: Date, // undefined for lifetime
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### User Subscription Field
```typescript
user.subscription = {
  type: string,
  startDate: Date,
  endDate?: Date,
  isActive: boolean,
  payosOrderId: string,
  payosTransactionId?: string
}
```

## Troubleshooting

### Common Issues

1. **Subscription không tự động expire**
   - Check cron job status
   - Verify script permissions
   - Check database connection

2. **Thời gian tính toán sai**
   - Verify plan duration format
   - Check timezone settings
   - Validate date calculation logic

3. **PayOS integration issues**
   - Verify environment variables
   - Check API credentials
   - Review PayOS documentation

### Debug Commands

```bash
# Manual run expiration check
node src/scripts/checkExpiredSubscriptions.js

# Check subscription status
curl -X GET /api/subscription/status

# Admin trigger expiration check
curl -X POST /api/admin/subscriptions/check-expired
``` 