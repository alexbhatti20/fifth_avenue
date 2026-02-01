/**
 * FIX #18: Shared Timer Manager
 * 
 * Instead of each order card creating its own setInterval,
 * this provides a single shared timer that updates all subscribers.
 * 
 * This dramatically improves performance when displaying many orders.
 * With 50 orders, instead of 50 intervals, we have just 1.
 */

type TimerCallback = (currentTime: number) => void;

class SharedTimerManager {
  private callbacks: Set<TimerCallback> = new Set();
  private intervalId: NodeJS.Timeout | null = null;
  private currentTime: number = Date.now();

  subscribe(callback: TimerCallback): () => void {
    this.callbacks.add(callback);
    
    // Start timer if this is the first subscriber
    if (this.callbacks.size === 1) {
      this.startTimer();
    }
    
    // Immediately call with current time
    callback(this.currentTime);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
      
      // Stop timer if no more subscribers
      if (this.callbacks.size === 0) {
        this.stopTimer();
      }
    };
  }

  private startTimer(): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.currentTime = Date.now();
      this.callbacks.forEach(callback => {
        try {
          callback(this.currentTime);
        } catch (e) {
          // Ignore callback errors
        }
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getCurrentTime(): number {
    return this.currentTime;
  }
}

// Singleton instance
export const sharedTimer = new SharedTimerManager();

/**
 * React hook for using the shared timer
 * @param startTime - The start time to calculate elapsed from
 * @returns elapsed time in seconds
 */
import { useState, useEffect } from 'react';

export function useSharedTimer(startTime: Date | string): number {
  const [elapsed, setElapsed] = useState(() => {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    return Math.floor((Date.now() - start.getTime()) / 1000);
  });

  useEffect(() => {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const startMs = start.getTime();

    const unsubscribe = sharedTimer.subscribe((currentTime) => {
      const newElapsed = Math.floor((currentTime - startMs) / 1000);
      setElapsed(newElapsed);
    });

    return unsubscribe;
  }, [startTime]);

  return elapsed;
}

/**
 * Format elapsed time as MM:SS
 */
export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get elapsed minutes from seconds
 */
export function getElapsedMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}
