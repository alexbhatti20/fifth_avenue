'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  ShoppingBag,
  Users,
  AlertTriangle,
  Package,
  DollarSign,
  Truck,
  MessageSquare,
  Clock,
  X,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useRealtimeNotifications } from '@/lib/portal-realtime';
import { usePortalAuth } from '@/hooks/usePortal';
import { cn } from '@/lib/utils';

type NotificationType = 'order' | 'employee' | 'inventory' | 'system' | 'payment' | 'delivery' | 'review';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; bgColor: string }> = {
  order: { icon: <ShoppingBag className="h-3.5 w-3.5" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  employee: { icon: <Users className="h-3.5 w-3.5" />, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  inventory: { icon: <Package className="h-3.5 w-3.5" />, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  system: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  payment: { icon: <DollarSign className="h-3.5 w-3.5" />, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  delivery: { icon: <Truck className="h-3.5 w-3.5" />, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  review: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
};

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

// Notification Item Component
function NotificationItem({
  notification,
  onMarkRead,
  onClose,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn(
        'p-3 border-b last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer',
        !notification.is_read && 'bg-blue-50/50 dark:bg-blue-900/10'
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkRead(notification.id);
        }
        if (notification.action_url) {
          onClose();
        }
      }}
    >
      <div className="flex gap-2.5">
        <div className={cn('p-1.5 rounded-full h-fit', config.bgColor)}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm line-clamp-1', !notification.is_read && 'font-medium')}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground">
              {getTimeAgo(notification.created_at)}
            </span>
            {notification.action_url && (
              <Link
                href={notification.action_url}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
                onClick={onClose}
              >
                View <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Main Notification Bell Component
export function NotificationBell() {
  const { employee } = usePortalAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // Mock notifications - in production, use useRealtimeNotifications hook
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'order',
      title: 'New Order Received',
      message: 'Order #1234 - 3 Zinger Burgers, 2 Broast Deals',
      is_read: false,
      action_url: '/portal/orders',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      type: 'inventory',
      title: 'Low Stock Alert',
      message: 'Chicken Breast is running low (8 kg remaining)',
      is_read: false,
      action_url: '/portal/inventory',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      type: 'delivery',
      title: 'Delivery Completed',
      message: 'Order #1230 delivered to DHA Phase 5',
      is_read: true,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            <Link href="/portal/notifications">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <AnimatePresence>
              {notifications.slice(0, 5).map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </AnimatePresence>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Link href="/portal/notifications" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full text-xs">
                View all notifications
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
