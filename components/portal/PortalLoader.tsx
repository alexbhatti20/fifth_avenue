'use client';

import { useEffect } from 'react';
import { usePortalAuthContext } from '@/components/portal/PortalProvider';

interface PortalLoaderProps {
  /** Toggling true triggers the content-area loader overlay */
  visible: boolean;
  /** Kept for API compatibility — no longer rendered as text */
  label?: string;
}

/**
 * Thin wrapper — delegates to PortalProvider's content loader.
 * The actual WebM overlay is rendered inside <main> (absolute),
 * so it never covers the sidebar.
 */
export function PortalLoader({ visible }: PortalLoaderProps) {
  const { setContentLoading } = usePortalAuthContext();

  useEffect(() => {
    setContentLoading(visible);
    // Always clear on unmount to prevent a stuck loader
    return () => setContentLoading(false);
  }, [visible, setContentLoading]);

  return null;}