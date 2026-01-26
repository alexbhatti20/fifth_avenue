// Notification sound utility for delivery rider alerts

let audioContext: AudioContext | null = null;
let isAudioEnabled = false;

// Get or create AudioContext
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Enable audio - must be called from user interaction (click, touch, etc.)
export async function enableAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // Play a silent sound to "warm up" the audio context
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0, ctx.currentTime); // Silent
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.001);
    
    isAudioEnabled = true;
    return true;
  } catch (error) {
    return false;
  }
}

// Check if audio is enabled
export function isAudioContextEnabled(): boolean {
  return isAudioEnabled && audioContext?.state === 'running';
}

// Play a notification sound using Web Audio API
export async function playNotificationSound(type: 'new_order' | 'assignment' | 'alert' = 'assignment'): Promise<void> {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (needed after user interaction)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // If context still not running, try to play anyway (might work if there was prior interaction)
    if (ctx.state !== 'running') {
      }

    // Different sounds for different notification types
    switch (type) {
      case 'new_order':
        // Higher pitched triple beep for new orders
        playTripleBeep(ctx, 880, 0.1);
        break;
      case 'assignment':
        // Pleasant notification melody for assignment
        playAssignmentMelody(ctx);
        break;
      case 'alert':
        // Urgent sound for alerts
        playUrgentAlert(ctx);
        break;
      default:
        playAssignmentMelody(ctx);
    }
  } catch (error) {
    }
}

// Triple beep sound
function playTripleBeep(ctx: AudioContext, frequency: number, duration: number) {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    }, i * 150);
  }
}

// Pleasant assignment melody
function playAssignmentMelody(ctx: AudioContext) {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const duration = 0.15;

  notes.forEach((freq, i) => {
    setTimeout(() => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    }, i * 120);
  });
}

// Urgent alert sound
function playUrgentAlert(ctx: AudioContext) {
  for (let i = 0; i < 2; i++) {
    setTimeout(() => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
      oscillator.type = 'sawtooth';

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    }, i * 200);
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show browser notification with sound
export async function showNotificationWithSound(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
    soundType?: 'new_order' | 'assignment' | 'alert';
  }
) {
  // Play sound first
  playNotificationSound(options?.soundType || 'assignment');

  // Try to show browser notification
  const hasPermission = await requestNotificationPermission();
  
  if (hasPermission) {
    try {
      const notification = new Notification(title, {
        body,
        icon: options?.icon || '/assets/logo.png',
        tag: options?.tag || 'delivery-notification',
        requireInteraction: options?.requireInteraction ?? false,
        badge: '/assets/logo.png',
      });

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);

      return notification;
    } catch (error) {
      }
  }

  return null;
}

// Check if notifications are supported and enabled
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}
