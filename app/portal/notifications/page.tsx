import { getNotificationsServer, getUnreadNotificationCountServer } from '@/lib/server-queries';
import NotificationsClient from './NotificationsClient';
import type { PortalNotification } from '@/lib/portal-queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificationsPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const [notifications, unreadCount] = await Promise.all([
    getNotificationsServer({ userType: 'employee', limit: 100 }),
    getUnreadNotificationCountServer('employee'),
  ]);

  // Transform server notifications to client format (add default user fields)
  const clientNotifications: PortalNotification[] = notifications.map(n => ({
    ...n,
    user_id: '',
    user_type: 'employee' as const,
  }));

  return (
    <NotificationsClient
      initialNotifications={clientNotifications}
      initialUnreadCount={unreadCount}
    />
  );
}
