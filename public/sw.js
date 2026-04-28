// =====================================================
// FIFTH AVENUE - Push Notification Service Worker
// Advanced branded notifications with offline support
// =====================================================

const CACHE_NAME = 'fifth-avenue-push-v1';
const OFFLINE_URL = '/offline.html';

// Branding configuration
const BRAND = {
  name: 'Fifth Avenue',
  icon: '/assets/fifth_avenue_urban_logo_1777394607150.png',
  badge: '/assets/fifth_avenue_urban_logo_1777394607150.png',
  defaultImage: '/assets/fifth_avenue_urban_logo_1777394607150.png',
  color: '#FFD200',
};

// Notification type icons/emojis
const NOTIFICATION_ICONS = {
  new_order: '🔔',
  order_confirmed: '✅',
  order_ready: '🍗',
  order_delivered: '🎉',
  new_offer: '🎁',
  promo: '🎁',
  customer_ban: '⚠️',
  customer_unban: '✅',
  account_reactivated: '🎉',
  broadcast: '📢',
  payment: '💰',
  review: '⭐',
  inventory: '📦',
  general: '📬',
};

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Try to cache assets but don't fail install if they're missing
      return cache.addAll([
        BRAND.icon,
        BRAND.badge,
      ]).catch(err => {
        console.warn('Failed to cache some assets:', err);
        // Don't reject - allow SW to install anyway
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Push event - handle incoming notifications
self.addEventListener('push', (event) => {
  let data = {
    title: BRAND.name,
    body: 'You have a new notification',
    type: 'general',
    icon: BRAND.icon,
    badge: BRAND.badge,
    tag: 'fifth-avenue-notification',
    data: {},
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      const type = payload.notification_type || payload.type || 'general';
      const emoji = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.general;
      
      data = {
        title: payload.title || `${emoji} ${BRAND.name}`,
        body: payload.body || data.body,
        icon: payload.icon || BRAND.icon,
        badge: payload.badge || BRAND.badge,
        image: payload.image || null,
        tag: payload.tag || `fifth-avenue-${type}-${Date.now()}`,
        type: type,
        data: {
          type: type,
          reference_id: payload.reference_id || payload.data?.reference_id,
          url: payload.url || payload.data?.url,
          ...payload.data,
        },
      };
      
      // Add emoji prefix to title if not already there
      if (!data.title.match(/^[\u{1F300}-\u{1F9FF}]/u)) {
        data.title = `${emoji} ${data.title}`;
      }
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    image: data.image,
    tag: data.tag,
    data: data.data,
    renotify: true,
    requireInteraction: ['new_order', 'order_ready', 'customer_ban'].includes(data.type),
    actions: getActionsForType(data.type),
    vibrate: [100, 50, 100, 50, 100],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Get action buttons based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'new_order':
      return [
        { action: 'view', title: 'View Order', icon: '/assets/icons/eye.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'order_confirmed':
    case 'order_ready':
      return [
        { action: 'track', title: 'Track Order', icon: '/assets/icons/track.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'new_offer':
    case 'promo':
      return [
        { action: 'view_offer', title: 'View Offer', icon: '/assets/icons/gift.png' },
        { action: 'dismiss', title: 'Later' },
      ];
    case 'review':
      return [
        { action: 'review', title: 'Leave Review', icon: '/assets/icons/star.png' },
        { action: 'dismiss', title: 'Not Now' },
      ];
    default:
      return [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
  }
}

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'dismiss') {
    return;
  }

  // Determine URL based on action and type
  let url = '/portal';

  switch (data.type) {
    case 'new_order':
      url = data.reference_id ? `/portal/orders/${data.reference_id}` : '/portal/orders';
      break;
    case 'order_confirmed':
    case 'order_ready':
    case 'order_delivered':
      url = data.reference_id ? `/track/${data.reference_id}` : '/orders';
      break;
    case 'customer_ban':
    case 'customer_unban':
      url = '/portal/customers';
      break;
    case 'new_offer':
    case 'promo':
      url = '/menu';
      break;
    case 'review':
      url = '/portal/reviews';
      break;
    case 'inventory':
      url = '/portal/inventory';
      break;
    case 'payment':
      url = '/portal/billing';
      break;
    default:
      url = data.url || '/portal/notifications';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Notification close handler (for analytics)
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  
  // Could send analytics here
  console.log('[SW] Notification dismissed:', data.type);
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncPendingNotifications());
  }
});

async function syncPendingNotifications() {
  // Sync any queued notification actions when back online
  console.log('[SW] Syncing pending notification actions...');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNewNotifications());
  }
});

async function checkForNewNotifications() {
  // Could poll for new notifications periodically
  console.log('[SW] Checking for new notifications...');
}
