'use client';

import { Bell, BellOff, Loader2, CheckCircle, AlertCircle, Send, Smartphone, Zap, ShieldCheck, Volume2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PushNotificationSettingsProps {
  userId: string;
  userType?: 'employee' | 'customer';
  compact?: boolean;
}

export default function PushNotificationSettings({
  userId,
  userType = 'employee',
  compact = false,
}: PushNotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    testNotification,
  } = usePushNotifications({ userId, userType });

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await subscribe();
      if (success) {
        toast.success('🔔 Push notifications enabled!', {
          description: 'You will receive alerts even when the browser is closed.',
        });
      } else {
        toast.error('Failed to enable notifications');
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        toast.success('Push notifications disabled');
      } else {
        toast.error('Failed to disable notifications');
      }
    }
  };

  const handleTestNotification = async () => {
    await testNotification();
    toast.info('Test notification sent!', {
      description: 'Check your device for the notification.',
    });
  };

  // Compact version for inline use
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            isSubscribed 
              ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' 
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
          )}>
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Push Notifications</p>
            <p className="text-xs text-muted-foreground">
              {isSubscribed ? 'Enabled' : 'Get instant alerts'}
            </p>
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={!isSupported || permission === 'denied'}
          />
        )}
      </div>
    );
  }

  // Not supported fallback
  if (!isSupported) {
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50/50 dark:border-amber-900 dark:from-amber-950/20 dark:to-yellow-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <BellOff className="h-5 w-5 text-amber-600" />
            </div>
            <CardTitle className="text-base">Push Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported in your browser. Try Chrome, Firefox, or Edge for the best experience.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-red-50/30 dark:from-zinc-900 dark:to-red-950/10">
      {/* Header with animated gradient */}
      <div className="relative h-2 bg-gradient-to-r from-red-500 via-red-400 to-orange-500">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-red-400 to-orange-500 animate-pulse opacity-50" />
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-xl shadow-lg transition-all duration-300',
              isSubscribed 
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/30' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            )}>
              <Bell className={cn('h-5 w-5', isSubscribed && 'animate-pulse')} />
            </div>
            <div>
              <CardTitle className="text-lg">Push Notifications</CardTitle>
              <CardDescription className="text-xs">
                100% Free • No external API needed
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={isSubscribed ? 'default' : 'secondary'}
            className={cn(
              'transition-all duration-300',
              isSubscribed && 'bg-gradient-to-r from-red-500 to-red-600 border-0'
            )}
          >
            {isSubscribed ? '✓ Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-5">
        {/* Error/Warning States */}
        <AnimatePresence>
          {permission === 'denied' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Notifications Blocked
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Click the lock icon in your browser's address bar to allow notifications.
                </p>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Toggle */}
        <div className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl">
          <div className="space-y-1">
            <Label htmlFor="push-toggle" className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Enable Push Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              Get alerts even when the browser is closed
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          ) : (
            <Switch
              id="push-toggle"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
              disabled={permission === 'denied'}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-red-500 data-[state=checked]:to-red-600"
            />
          )}
        </div>

        {/* Enabled State Info */}
        <AnimatePresence>
          {isSubscribed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-900"
            >
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span>Push notifications active</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTestNotification}
                className="gap-1.5 text-green-700 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
              >
                <Send className="h-3.5 w-3.5" />
                Test
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features List */}
        <div className="pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            {userType === 'customer' ? 'You will be notified about:' : 'Notifications include:'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {userType === 'customer' ? (
              <>
                <FeatureItem icon={CheckCircle} text="Order confirmations" />
                <FeatureItem icon={Bell} text="Order ready alerts" />
                <FeatureItem icon={Send} text="Delivery updates" />
                <FeatureItem icon={Zap} text="Special offers" />
              </>
            ) : (
              <>
                <FeatureItem icon={Bell} text="New orders" />
                <FeatureItem icon={CheckCircle} text="Order updates" />
                <FeatureItem icon={AlertCircle} text="Customer alerts" />
                <FeatureItem icon={Zap} text="System notifications" />
              </>
            )}
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-start gap-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Privacy First: </span>
            We use secure Web Push (VAPID) with no third-party services. Your data stays between you and Zoiro.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-red-500" />
      <span>{text}</span>
    </div>
  );
}
