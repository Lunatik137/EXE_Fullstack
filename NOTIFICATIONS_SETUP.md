# Push Notifications Setup

## Backend Setup

1. **Install dependencies:**
```bash
npm install web-push
```

2. **Generate VAPID keys:**
```bash
node backend/generateVAPIDKeys.js
```

3. **Add to .env:**
```
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

4. **Ensure MongoDB has NotificationSubscription model indexed:**
```bash
# The model is already created with TTL index (30 days)
```

## Frontend Setup

1. **Add NotificationSetup component to your main layout (e.g., App.jsx or Header):**
```jsx
import NotificationSetup from './components/NotificationSetup/NotificationSetup';

// In your component:
<NotificationSetup />
```

2. **Ensure service-worker.js is in public folder** (already created)

## Usage

### Sending Notifications from Backend

**For new comments:**
```javascript
import { notifyNewComment } from './controllers/notificationController.js';

await notifyNewComment(userId, commenterName, postPreview);
```

**For new likes:**
```javascript
import { notifyNewLike } from './controllers/notificationController.js';

await notifyNewLike(userId, likerName, postPreview);
```

**For meal reminders:**
```javascript
import { notifyMealSchedule } from './controllers/notificationController.js';

await notifyMealSchedule(userId, mealName, mealTime);
```

## Testing

1. Click "Bật thông báo" button in the app
2. Allow notifications in browser prompt
3. Subscription will be saved to database
4. Test by liking/commenting on posts or triggering meal reminders

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited support (iOS 16.4+)
- Opera: Full support
