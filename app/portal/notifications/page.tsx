import { getNotificationsServer, getUnreadNotificationCountServer } from '@/lib/server-queries';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificationsPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const [notifications, unreadCount] = await Promise.all([
    getNotificationsServer({ userType: 'employee', limit: 100 }),
    getUnreadNotificationCountServer('employee'),
  ]);

  return (
    <NotificationsClient
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    />
  );
}
