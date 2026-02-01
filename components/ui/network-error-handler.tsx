'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// Network status hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        toast.success('Connection restored! Refreshing data...', {
          icon: <Wifi className="h-4 w-4 text-green-500" />,
          duration: 3000,
        });
        // Auto-refresh after coming back online
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      toast.error('No internet connection. Please check your network.', {
        icon: <WifiOff className="h-4 w-4 text-red-500" />,
        duration: 10000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

// Network error banner component (shows when offline)
export function NetworkErrorBanner() {
  const { isOnline } = useNetworkStatus();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-3 shadow-lg"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 animate-pulse" />
              <div>
                <p className="font-medium">No Internet Connection</p>
                <p className="text-sm text-red-100">Please check your network and try again</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-white text-red-600 hover:bg-red-50 border-0"
            >
              {isRetrying ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Wrapper component to provide network status
export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  useNetworkStatus(); // Initialize network status monitoring
  
  return (
    <>
      <NetworkErrorBanner />
      {children}
    </>
  );
}

export default NetworkStatusProvider;
