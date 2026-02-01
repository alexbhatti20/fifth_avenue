'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  ShoppingBag,
  Users,
  AlertTriangle,
  MessageSquare,
  Package,
  Clock,
  DollarSign,
  Truck,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionHeader, StatsCard } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  type PortalNotification,
} from '@/lib/portal-queries';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type NotificationType = 'order' | 'employee' | 'inventory' | 'system' | 'payment' | 'delivery' | 'review';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  order: { icon: <ShoppingBag className="h-4 w-4" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  employee: { icon: <Users className="h-4 w-4" />, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  inventory: { icon: <Package className="h-4 w-4" />, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  system: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  payment: { icon: <DollarSign className="h-4 w-4" />, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  delivery: { icon: <Truck className="h-4 w-4" />, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  review: { icon: <MessageSquare className="h-4 w-4" />, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
};

// Helper function
function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// Notification Item
function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: PortalNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        'p-4 border-b last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
        !notification.is_read && 'bg-blue-50/50 dark:bg-blue-900/10'
      )}
    >
      <div className="flex gap-3">
        <div className={cn('p-2 rounded-full h-fit', config.bgColor)}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('font-medium text-sm', !notification.is_read && 'font-semibold')}>
                {notification.title}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            </div>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
            <div className="flex items-center gap-1">
              {!notification.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onMarkRead(notification.id)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500"
                onClick={() => onDelete(notification.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Notification Settings Dialog
function NotificationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [settings, setSettings] = useState({
    orders: true,
    inventory: true,
    employees: true,
    payments: true,
    reviews: true,
    system: true,
    sound: true,
    email: false,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success('Notification settings saved');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>Configure which notifications you want to receive</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Notification Types</h4>
            {[
              { key: 'orders', label: 'Order Notifications', desc: 'New orders, status changes' },
              { key: 'inventory', label: 'Inventory Alerts', desc: 'Low stock warnings' },
              { key: 'employees', label: 'Employee Updates', desc: 'Check-ins, schedule changes' },
              { key: 'payments', label: 'Payment Notifications', desc: 'Payment confirmations' },
              { key: 'reviews', label: 'Customer Reviews', desc: 'New reviews and feedback' },
              { key: 'system', label: 'System Alerts', desc: 'Updates and maintenance' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <Label htmlFor={item.key} className="text-sm font-medium">{item.label}</Label>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  id={item.key}
                  checked={settings[item.key as keyof typeof settings] as boolean}
                  onCheckedChange={() => handleToggle(item.key as keyof typeof settings)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">Delivery Methods</h4>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sound" className="text-sm font-medium">Sound Alerts</Label>
                <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
              </div>
              <Switch
                id="sound"
                checked={settings.sound}
                onCheckedChange={() => handleToggle('sound')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Send daily summary email</p>
              </div>
              <Switch
                id="email"
                checked={settings.email}
                onCheckedChange={() => handleToggle('email')}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NotificationsClientProps {
  initialNotifications: PortalNotification[];
  initialUnreadCount: number;
}

// Main Notifications Client Component
export default function NotificationsClient({ 
  initialNotifications,
  initialUnreadCount,
}: NotificationsClientProps) {
  const { employee } = usePortalAuth();
  const [notifications, setNotifications] = useState<PortalNotification[]>(initialNotifications);
  const [isLoading, setIsLoading] = useState(initialNotifications.length === 0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, count] = await Promise.all([
        getNotifications({ userType: 'employee', limit: 100 }),
        getUnreadNotificationCount('employee'),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (error) {
      
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip initial fetch if we have server-provided data
    if (initialNotifications.length === 0) {
      fetchNotifications();
    }

    // Set up realtime subscription for new notifications
    if (!isSupabaseConfigured || !employee?.id) return;
    
    const channel = supabase
      .channel('portal_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${employee?.id}`,
        },
        (payload) => {
          const newNotification = payload.new as PortalNotification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          toast.info(newNotification.title, { description: newNotification.message });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee?.id, fetchNotifications, initialNotifications.length]);

  const filteredNotifications = notifications.filter((n) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'unread') return !n.is_read;
    return n.type === typeFilter;
  });

  const handleMarkRead = async (id: string) => {
    const result = await markNotificationRead(id);
    if (result.success) {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } else {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead('employee');
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } else {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = (id: string) => {
    // Local delete (would need delete API)
    const notification = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    toast.success('Notification deleted');
  };

  const stats = {
    total: notifications.length,
    unread: unreadCount,
    today: notifications.filter(n => {
      const date = new Date(n.created_at);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }).length,
  };

  return (
    <>
      <SectionHeader
        title="Notifications"
        description="Stay updated with the latest activities"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchNotifications}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatsCard
          title="Total"
          value={stats.total}
          icon={<Bell className="h-5 w-5" />}
        />
        <StatsCard
          title="Unread"
          value={stats.unread}
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
        />
        <StatsCard
          title="Today"
          value={stats.today}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Filter and List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Notifications</CardTitle>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="review">Reviews</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No notifications found</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <NotificationSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  );
}
