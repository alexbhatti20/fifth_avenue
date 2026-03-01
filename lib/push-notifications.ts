// Push Notification Utilities for Zoiro Broast
// Uses Web Push API with VAPID keys (completely free)

// VAPID public key - generate with: npx web-push generate-vapid-keys
// Store VAPID_PRIVATE_KEY in environment variable
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Get current push permission status
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Request notification permission
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Subscribe to push notifications
export async function subscribeToPush(
  userId: string,
  userType: 'employee' | 'customer'
): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: 'VAPID key not configured' };
  }

  try {
    // Request permission first
    const permission = await requestPushPermission();
    if (!permission) {
      return { success: false, error: 'Notification permission denied' };
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Service Worker registration failed' };
    }

    // Use the active service worker, or wait briefly for it
    // If there's no active SW but one is installing/waiting, use a timeout-wrapped ready
    if (!registration.active) {
      try {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          )
        ]);
      } catch {
        // If timeout or error, try to proceed anyway - registration might still work
        console.warn('Service worker not fully ready, attempting to proceed');
      }
    }

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // If no subscription, create one
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Send subscription to server
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId,
        userType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Failed to save subscription' };
    }

    return { success: true, subscription };
  } catch (error) {
    console.error('Push subscription error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    // Check if service worker is registered first
    if (!('serviceWorker' in navigator)) {
      // Just call server to clean up any DB records
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      return true;
    }

    // Check for existing registration
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      // No service worker, just clean up server side
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      return true;
    }

    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    // Notify server to remove subscription
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    return true;
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return false;
  }
}

// Check if user is subscribed
export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// Send push notification (called from server/API)
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    type?: string;
    reference_id?: string;
    url?: string;
  };
}

// Trigger a test notification (for debugging)
export async function sendTestNotification(): Promise<void> {
  if (!isPushSupported()) {
    console.warn('Push not supported');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  
  await registration.showNotification('Test Notification', {
    body: 'Push notifications are working!',
    icon: '/assets/zoiro-logo.png',
    badge: '/assets/zoiro-logo.png',
    tag: 'test',
  });
}
