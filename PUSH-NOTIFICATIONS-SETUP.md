# Push Notifications Setup Guide

Free web push notifications for Zoiro Broast using the Web Push API.

## Quick Setup

### 1. Install Dependencies

```bash
npm install web-push
npm install -D @types/web-push
```

### 2. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
Public Key:
BNs0bFVr0FzfmM...

Private Key:
dGhpcyBpcyBhIG...
```

### 3. Add Environment Variables

Add to your `.env.local`:

```env
# Push Notification VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_SUBJECT=mailto:support@zoirobroast.me
```

### 4. Run Database Migration

Go to Supabase SQL Editor and run:

```sql
-- Run the contents of: supabase/push-notifications.sql
```

This creates:
- `push_subscriptions` table - stores user subscriptions
- `push_notification_queue` table - queue for notifications
- `queue_push_notification()` function - helper to queue notifications

### 5. Deploy and Test

1. Users can enable push notifications in **Settings > Security > Push Notifications**
2. Click "Enable Push Notifications" and allow the browser prompt
3. Use the "Test" button to verify it works

## API Endpoints

### Subscribe to Push
```
POST /api/push/subscribe
Body: { subscription, userId, userType }
```

### Unsubscribe
```
POST /api/push/unsubscribe
Body: { userId }
```

### Send Notification (Admin)
```
POST /api/push/send
Headers: { Authorization: "Bearer <token>" }
Body: {
  userIds?: string[],      // Specific users (optional)
  userType?: "employee" | "customer" | "all",
  title: string,
  body: string,
  type?: string,           // "order", "offer", "customer_ban", etc.
  referenceId?: string
}
```

### Check Status
```
GET /api/push/send
Returns: { configured: boolean, vapidPublicKey: string }
```

## Usage Examples

### Send to All Employees
```typescript
await fetch('/api/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    userType: 'employee',
    title: '🔔 New Order #1234',
    body: 'A new order has been placed!',
    type: 'new_order',
    referenceId: 'order-uuid-here',
  }),
});
```

### Send New Offer to Customers
```typescript
await fetch('/api/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    userType: 'customer',
    title: '🎉 New Offer!',
    body: 'Get 20% off on all broast items today!',
    type: 'offer',
  }),
});
```

### Notify Specific User (Customer Ban)
```typescript
await fetch('/api/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    userIds: ['employee-uuid-1', 'employee-uuid-2'],
    title: '⚠️ Customer Banned',
    body: 'Customer John Doe has been banned',
    type: 'customer_ban',
  }),
});
```

## Integrating with Existing Code

### In Actions/Mutations

Add push notification calls after creating notifications:

```typescript
// After creating a notification in Supabase
await supabase.from('notifications').insert({...});

// Also send push notification
await fetch('/api/push/send', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    userIds: [userId],
    title: 'Notification Title',
    body: 'Notification message',
    type: 'notification_type',
  }),
});
```

### Using Database Triggers

Uncomment the trigger in `push-notifications.sql` to automatically send push notifications when new orders are created:

```sql
CREATE TRIGGER on_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_order();
```

## Files Created

- `public/sw.js` - Service Worker for handling push events
- `lib/push-notifications.ts` - Client-side push notification utilities
- `hooks/usePushNotifications.tsx` - React hook for managing subscriptions
- `components/portal/settings/PushNotificationSettings.tsx` - UI component
- `app/api/push/subscribe/route.ts` - Subscribe API endpoint
- `app/api/push/unsubscribe/route.ts` - Unsubscribe API endpoint
- `app/api/push/send/route.ts` - Send notification API endpoint
- `supabase/push-notifications.sql` - Database migration

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: macOS 13+ and iOS 16.4+
- Opera: Full support

## Notes

- Push notifications are **completely free** using VAPID keys
- Works even when the browser is closed (but the device must be on)
- Users must explicitly enable notifications
- Notifications respect the device's Do Not Disturb settings
