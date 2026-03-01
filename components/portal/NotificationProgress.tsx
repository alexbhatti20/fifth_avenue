'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NotificationProgressProps {
  offerId: string;
  offerName: string;
  sendPush: boolean;
  forceResend?: boolean;
  onComplete: (results: { push: { sent: number; failed: number } }) => void;
  onCancel: () => void;
}

export default function NotificationProgress({
  offerId,
  offerName,
  sendPush,
  forceResend = false,
  onComplete,
  onCancel,
}: NotificationProgressProps) {
  const [progress, setProgress] = useState(0);
  const [pushSubscriberCount, setPushSubscriberCount] = useState(0);
  const [sentCount, setSentCount] = useState({ push: 0 });
  const [failedCount, setFailedCount] = useState({ push: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalResults, setFinalResults] = useState<{ push: { sent: number; failed: number } } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const isMountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  const hasCalledCompleteRef = useRef(false);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    isMountedRef.current = true;
    hasCalledCompleteRef.current = false;
    
    // Safety timeout - if stream doesn't complete within 2 minutes, auto-close with error
    safetyTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !isComplete && !hasCalledCompleteRef.current) {
        setError('Notification request timed out. Please try again.');
        setIsComplete(true);
      }
    }, 120000);
    
    const startNotification = async () => {
      abortRef.current = new AbortController();

      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch('/api/offers/notify/stream', {
          method: 'POST',
          headers,
          body: JSON.stringify({ offerId, sendPush, forceResend }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          // Parse error body for meaningful messages (e.g. 409 already_sent)
          let errMsg = 'Failed to start notification';
          try {
            const errData = await response.json();
            errMsg = errData.message || errData.error || errMsg;
          } catch { /* ignore */ }
          throw new Error(errMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');
        
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (isMountedRef.current) {
            const { done, value } = await reader.read();
            if (done) {
              // Process any remaining buffer content when stream ends
              if (buffer.trim() && buffer.startsWith('data: ')) {
                try {
                  const data = JSON.parse(buffer.slice(6));
                  handleEvent(data);
                } catch {
                  // Skip invalid JSON
                }
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ') && isMountedRef.current) {
                try {
                  const data = JSON.parse(line.slice(6));
                  handleEvent(data);
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error.name !== 'AbortError' && isMountedRef.current) {
          setError(error.message || 'Failed to send notifications');
        }
      }
    };

    startNotification();

    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      readerRef.current?.cancel().catch(() => {});
      // Clear all timeouts on unmount
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [offerId, sendPush, isComplete]);

  const handleEvent = (data: { type: string; totalCustomers?: number; pushSubscriberCount?: number; progress?: number; phase?: string; sent?: number; failed?: number; total?: number; message?: string; results?: { push: { sent: number; failed: number } } }) => {
    if (!isMountedRef.current) return;
    
    switch (data.type) {
      case 'init':
        setPushSubscriberCount(data.pushSubscriberCount || 0);
        break;

      case 'error':
        setError(data.message || 'An error occurred while sending notifications');
        setIsComplete(true);
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        if (data.results) {
          setFinalResults(data.results);
          setSentCount({ push: data.results.push.sent });
          setFailedCount({ push: data.results.push.failed });
        }
        break;

      case 'batch_complete':
        setSentCount({ push: data.sent || 0 });
        setFailedCount({ push: data.failed || 0 });
        setProgress(data.progress || 0);
        break;

      case 'phase_complete':
        setSentCount({ push: data.sent || 0 });
        setFailedCount({ push: data.failed || 0 });
        setProgress(100);
        break;

      case 'complete':
        setIsComplete(true);
        setProgress(100);
        if (data.results) {
          setFinalResults(data.results);
          setSentCount({ push: data.results.push.sent });
          setFailedCount({ push: data.results.push.failed });
        }
        const resultsToSend = data.results || { push: { sent: sentCount.push, failed: failedCount.push } };
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        autoCloseTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            isMountedRef.current = false;
            onCompleteRef.current(resultsToSend);
          }
        }, 2000);
        break;
    }
  };

  const handleCancel = () => {
    // Clear timeouts first
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    isMountedRef.current = false;
    abortRef.current?.abort();
    readerRef.current?.cancel().catch(() => {});
    onCancel();
  };

  const handleDone = () => {
    // Clear all timeouts to prevent double-call from auto-close
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    isMountedRef.current = false;
    abortRef.current?.abort();
    readerRef.current?.cancel().catch(() => {});
    
    const results = finalResults || { push: { sent: sentCount.push, failed: failedCount.push } };
    onCompleteRef.current(results);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Stats - single push card */}
      <div className="flex justify-center">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-teal-500/20 p-4 border border-emerald-500/20 min-w-[180px]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-wider text-emerald-600/80 dark:text-emerald-400/80 uppercase">
                Push Subscribers
              </p>
              <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                {pushSubscriberCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground tracking-wide">
            {isComplete
              ? `Sent ${sentCount.push} push notifications`
              : pushSubscriberCount > 0
              ? `Sending… ${sentCount.push + failedCount.push} / ${pushSubscriberCount}`
              : `Sending push notifications…`}
          </span>
          <span className="text-sm font-semibold tracking-wider bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
            {progress}%
          </span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
          <div 
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Complete */}
      {isComplete && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-teal-500/15 p-5 border border-emerald-500/30">
          <div className="relative space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-wide bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                Notifications Sent!
              </span>
            </div>
            <div className="flex items-center gap-4 pl-1">
            <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-emerald-600" />
                <span className="tracking-wide text-emerald-700 dark:text-emerald-400 font-medium">
                  {sentCount.push} sent
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/15 to-orange-500/10 p-4 border border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-gradient-to-br from-red-500 to-orange-500">
              <XCircle className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium tracking-wide text-red-600 dark:text-red-400">{error}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end pt-2">
        {!isComplete ? (
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="rounded-xl tracking-wider font-medium"
          >
            Cancel
          </Button>
        ) : (
          <Button 
            onClick={handleDone} 
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25 tracking-wider font-medium"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
