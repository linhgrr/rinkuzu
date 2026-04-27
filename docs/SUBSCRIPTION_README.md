# Hệ Thống Subscription với PayOS

## Tổng Quan

Hệ thống subscription đã được tích hợp vào ứng dụng quiz với PayOS để cung cấp 2 loại gói thanh toán:

- **Premium 6 Tháng**: 199,000 VND
- **Premium Trọn Đời**: 499,000 VND

## Tính Năng

### User Thường (Free)

- Truy cập các quiz public
- Giới hạn số lần làm quiz
- Tính năng cơ bản

### User Premium

- Truy cập tất cả quiz private
- Không giới hạn số lần làm quiz
- Thống kê chi tiết
- Hỗ trợ ưu tiên
- Tính năng mới sớm nhất (cho gói lifetime)

## Cấu Trúc Database

### User Model (Cập nhật)

```typescript
subscription?: {
  type: 'free' | 'premium_6months' | 'premium_lifetime';
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}
```

### Subscription Model (Mới)

```typescript
{
  user: ObjectId;
  userEmail: string;
  type: 'premium_6months' | 'premium_lifetime';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payosOrderId: string;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}
```

## API Endpoints

### 1. Lấy danh sách gói subscription

```
GET /api/subscription/plans
```

### 2. Tạo yêu cầu thanh toán

```
POST /api/subscription/create-payment
Body: { planId: 'premium_6months' | 'premium_lifetime' }
```

### 3. Xác minh thanh toán

```
POST /api/subscription/verify
Body: { orderCode: string }
```

### 4. Lấy trạng thái subscription

```
GET /api/subscription/status
```

## Trang Web

### 1. Trang Subscription

- **URL**: `/subscription`
- **Chức năng**: Hiển thị các gói subscription và cho phép mua

### 2. Trang Thanh Toán Thành Công

- **URL**: `/payment/success`
- **Chức năng**: Xác minh và kích hoạt subscription

### 3. Trang Thanh Toán Bị Hủy

- **URL**: `/payment/cancel`
- **Chức năng**: Xử lý khi user hủy thanh toán

## Tích Hợp PayOS

### Environment Variables

```env
PAYOS_CLIENT_ID=ef17ed2e-db7e-4c03-9ce4-c8a5842ce4b8
PAYOS_API_KEY=***REMOVED***
PAYOS_CHECKSUM_KEY=***REMOVED***
```

### PayOSService

- Tạo yêu cầu thanh toán
- Xác minh thanh toán
- Xử lý webhook

### SubscriptionService

- Quản lý subscription
- Kiểm tra quyền truy cập
- Xử lý thanh toán

## Bảo Mật

### Kiểm Tra Quyền Truy Cập

- Quiz private chỉ cho phép:
  - Admin
  - Tác giả quiz
  - User có subscription premium

### Validation

- Kiểm tra subscription còn hạn
- Xác minh thanh toán với PayOS
- Bảo vệ API endpoints

## Workflow Thanh Toán

1. **User chọn gói** → `/subscription`
2. **Tạo yêu cầu thanh toán** → PayOS API
3. **Chuyển hướng đến PayOS** → Thanh toán
4. **Callback thành công** → `/payment/success`
5. **Xác minh thanh toán** → Kích hoạt subscription
6. **Cập nhật user** → Truy cập premium features

## Testing

### Chạy Test Script

```bash
node src/scripts/testSubscription.js
```

### Test Cases

- Tạo subscription
- Kiểm tra quyền truy cập
- Xác minh hết hạn
- Cleanup test data

## Monitoring

### Logs

- Payment requests
- Subscription activations
- Access attempts
- Error handling

### Metrics

- Subscription conversions
- Revenue tracking
- User engagement

## Troubleshooting

### Lỗi Thường Gặp

1. **Payment Failed**
   - Kiểm tra PayOS credentials
   - Verify webhook URLs
   - Check network connectivity

2. **Subscription Not Activated**
   - Verify payment status
   - Check order code
   - Review database updates

3. **Access Denied**
   - Check user subscription status
   - Verify quiz privacy settings
   - Review permission logic

### Debug Commands

```bash
# Check subscription status
curl -X GET /api/subscription/status

# Test payment creation
curl -X POST /api/subscription/create-payment \
  -H "Content-Type: application/json" \
  -d '{"planId": "premium_6months"}'
```

## Future Enhancements

1. **Auto-renewal** cho gói 6 tháng
2. **Trial period** cho user mới
3. **Referral system** với discount
4. **Analytics dashboard** cho admin
5. **Email notifications** cho subscription events
6. **Multiple payment methods** (VNPay, Momo, etc.)

## Support

Để hỗ trợ kỹ thuật hoặc báo cáo lỗi, vui lòng liên hệ:

- Email: support@rinkuzu.com
- Documentation: [PayOS API Docs](https://docs.payos.vn/)
