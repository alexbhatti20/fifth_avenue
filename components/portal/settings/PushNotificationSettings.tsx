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

  if (compact) {
    return (
      <div className="flex items-center justify-between p-4 bg-white rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2.5 rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
            isSubscribed 
              ? 'bg-[#FFD200] text-black' 
              : 'bg-zinc-200 text-zinc-500'
          )}>
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bebas tracking-wide">Push Notifications</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
              {isSubscribed ? 'SYSTEM ACTIVE' : 'GET INSTANT ALERTS'}
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
      <Card className="rounded-none border-4 border-black bg-[#FFD200]/10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-none border-2 border-black bg-white">
              <BellOff className="h-5 w-5 text-black" />
            </div>
            <CardTitle className="text-lg font-bebas tracking-wider uppercase">Push Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs font-bold uppercase tracking-tight text-black/60">
            Push notifications are not supported in your browser. Try Chrome, Firefox, or Edge for the best experience.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
      <div className="h-3 bg-black border-b-2 border-black" />
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'p-3 rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-300',
              isSubscribed 
                ? 'bg-[#FFD200] text-black' 
                : 'bg-zinc-100 text-zinc-500'
            )}>
              <Bell className={cn('h-6 w-6', isSubscribed && 'animate-pulse')} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bebas tracking-wider uppercase">Push Notifications</CardTitle>
              <CardDescription className="text-xs font-bold text-black/60 uppercase tracking-widest">
                DIRECT SYSTEM ALERTS • LOW LATENCY
              </CardDescription>
            </div>
          </div>
          <Badge 
            className={cn(
              'rounded-none border-2 border-black font-bebas tracking-widest px-3 py-1 text-sm transition-all duration-300',
              isSubscribed ? 'bg-[#008A45] text-white' : 'bg-zinc-200 text-zinc-500'
            )}
          >
            {isSubscribed ? '✓ ACTIVE' : 'INACTIVE'}
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
        <div className="flex items-start gap-3 p-4 bg-black text-[#FFD200] rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs">
          <ShieldCheck className="h-5 w-5 flex-shrink-0" />
          <div className="font-bebas tracking-wide text-sm">
            <span className="text-white">Privacy First: </span>
            We use secure Web Push (VAPID) with no third-party services. Your data stays between you and Fifth Avenue.
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
