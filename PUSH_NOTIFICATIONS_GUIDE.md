# Push Notifications - Hướng dẫn Hoàn Chỉnh

## Cách Hoạt Động

Push notifications được gửi **kể cả khi website không mở** thông qua:
1. **Service Worker** - Chạy ở background của browser
2. **Web Push Protocol** - Giao tiếp với push service của browser
3. **Backend Cron Job** - Tự động gửi notifications theo lịch

## Các Loại Notifications

### 1. Meal Reminders (Nhắc nhở bữa ăn)
- **Tự động gửi** theo lịch trong meal plan
- Cron job chạy mỗi phút để kiểm tra
- Gửi khi đến giờ ăn

### 2. Comment Notifications (Bình luận mới)
- Gửi khi ai đó bình luận bài viết của user
- Trigger từ `POST /api/posts/:id/comment`

### 3. Like Notifications (Lượt thích mới)
- Gửi khi ai đó thích bài viết của user
- Trigger từ `POST /api/posts/:id/like`

## Setup Hoàn Chỉnh

### Backend

1. **Cài đặt dependencies:**
```bash
npm install web-push node-cron
```

2. **Generate VAPID keys:**
```bash
node backend/generateVAPIDKeys.js
```

3. **Thêm vào .env:**
```
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

4. **Cron job tự động chạy** khi server start

### Frontend

1. **NotificationSetup component** đã được thêm vào App.jsx
2. **Service Worker** đã được tạo ở `/public/service-worker.js`

## Quy Trình Người Dùng

### Lần Đầu Tiên Truy Cập:
1. User truy cập website
2. Prompt hiển thị: "Bạn có muốn nhận thông báo?"
3. User click "Có"
4. Browser request permission
5. User click "Allow" trong browser prompt
6. Subscription được lưu vào database

### Sau Khi Cho Phép:
- Website có thể gửi notifications **bất kỳ lúc nào**
- **Kể cả khi website không mở**
- Notifications sẽ hiển thị ở system tray của OS

## Testing

### Test Notification:
```bash
curl -X POST http://localhost:4000/api/notifications/test \
  -H "token: your_token_here" \
  -H "Content-Type: application/json"
```

### Kiểm Tra Subscriptions:
```bash
# Trong MongoDB
db.notificationsubscriptions.find()
```

## Troubleshooting

### Notifications không hiển thị:
1. Kiểm tra browser permission: Settings → Privacy → Notifications
2. Kiểm tra service worker: DevTools → Application → Service Workers
3. Kiểm tra database: Có subscription được lưu không?

### Service Worker không register:
1. Kiểm tra `/public/service-worker.js` tồn tại
2. Kiểm tra browser console có error không
3. Kiểm tra HTTPS (required for production)

### Cron job không chạy:
1. Kiểm tra server logs
2. Kiểm tra meal plan có `status: 'active'` không
3. Kiểm tra meal time format: `HH:MM` (e.g., "07:00")

## API Endpoints

### Subscribe:
```
POST /api/notifications/subscribe
Headers: { token: user_token }
Body: { subscription: PushSubscription }
```

### Unsubscribe:
```
POST /api/notifications/unsubscribe
Headers: { token: user_token }
Body: { endpoint: subscription_endpoint }
```

### Get VAPID Key:
```
GET /api/notifications/vapid-key
```

### Test Notification:
```
POST /api/notifications/test
Headers: { token: user_token }
```

## Lưu Ý Quan Trọng

1. **HTTPS Required**: Push notifications chỉ hoạt động trên HTTPS (hoặc localhost)
2. **Browser Support**: Chrome, Firefox, Edge, Opera (Safari hạn chế)
3. **Subscription TTL**: Subscriptions tự động expire sau 30 ngày
4. **Expired Subscriptions**: Tự động xóa khi gửi thất bại (410 status)
