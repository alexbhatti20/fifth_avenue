'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PortalLoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Forward middleware-set params (redirect, reason) to the auth page
    const redirect = searchParams.get('redirect');
    const reason   = searchParams.get('reason');
    const params   = new URLSearchParams();
    if (redirect) params.set('redirect', redirect);
    if (reason)   params.set('reason', reason);
    const qs = params.toString();
    router.replace(qs ? `/auth?${qs}` : '/auth');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Redirecting to login...</p>
      </div>
    </div>
  );
}
