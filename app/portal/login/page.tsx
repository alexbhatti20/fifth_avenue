'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified auth page
    router.replace('/auth');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Redirecting to login...</p>
      </div>
    </div>
  );
}
