'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  sendTestNotification,
} from '@/lib/push-notifications';

interface UsePushNotificationsOptions {
  userId?: string;
  userType?: 'employee' | 'customer';
  autoSubscribe?: boolean;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  testNotification: () => Promise<void>;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const { userId, userType = 'employee', autoSubscribe = false } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check support and status on mount
  useEffect(() => {
    const checkStatus = async () => {
      setIsLoading(true);
      
      const supported = isPushSupported();
      setIsSupported(supported);
      
      if (!supported) {
        setPermission('unsupported');
        setIsLoading(false);
        return;
      }

      setPermission(getPushPermission());
      
      const subscribed = await isSubscribedToPush();
      setIsSubscribed(subscribed);
      
      setIsLoading(false);
    };

    checkStatus();
  }, []);

  // Auto-subscribe if enabled and user is logged in
  useEffect(() => {
    if (autoSubscribe && userId && isSupported && !isSubscribed && !isLoading) {
      subscribeToPush(userId, userType).then((result) => {
        if (result.success) {
          setIsSubscribed(true);
        }
      });
    }
  }, [autoSubscribe, userId, userType, isSupported, isSubscribed, isLoading]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setError('User ID is required');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await subscribeToPush(userId, userType);
      
      if (result.success) {
        setIsSubscribed(true);
        setPermission('granted');
        return true;
      } else {
        setError(result.error || 'Failed to subscribe');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, userType]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setError('User ID is required');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await unsubscribeFromPush(userId);
      
      if (success) {
        setIsSubscribed(false);
        return true;
      } else {
        setError('Failed to unsubscribe');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const testNotification = useCallback(async (): Promise<void> => {
    try {
      await sendTestNotification();
    } catch (err) {
      console.error('Test notification failed:', err);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    testNotification,
  };
}
