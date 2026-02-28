'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface GoogleAuthHandlerProps {
  onAuthComplete?: (success: boolean, userType?: string) => void;
}

/**
 * Client-side handler for Google OAuth implicit flow
 * This component detects access_token in URL hash and processes the authentication
 */
export function GoogleAuthHandler({ onAuthComplete }: GoogleAuthHandlerProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const handleHashAuth = async () => {
      // Check if we have hash parameters (implicit OAuth flow)
      if (typeof window === 'undefined') return;
      
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) return;

      // Prevent double processing
      if (processing) return;
      setProcessing(true);

      try {
        // Parse hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const providerToken = params.get('provider_token');

        if (!accessToken) {
          console.error('No access token in hash');
          setProcessing(false);
          return;
        }

        // Set the session in Supabase
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError || !sessionData.session) {
          console.error('Failed to set session:', sessionError);
          // Clear hash and redirect to auth with error
          window.history.replaceState(null, '', window.location.pathname);
          router.push('/auth?error=' + encodeURIComponent('Failed to complete Google sign-in'));
          return;
        }

        const user = sessionData.user;
        const email = user?.email?.toLowerCase();
        const name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';

        if (!email) {
          window.history.replaceState(null, '', window.location.pathname);
          router.push('/auth?error=' + encodeURIComponent('No email received from Google'));
          return;
        }

        // Call our API to process the Google auth
        const response = await fetch('/api/auth/google/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authUserId: user.id,
            email,
            name,
            accessToken,
            refreshToken,
          }),
        });

        const result = await response.json();

        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);

        if (!response.ok || result.error) {
          // Sign out if there's an error
          await supabase.auth.signOut();
          router.push('/auth?error=' + encodeURIComponent(result.error || 'Authentication failed'));
          return;
        }

        // Store tokens in cookies (done by the API)
        // Set token in localStorage as backup
        localStorage.setItem('sb_access_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('sb_refresh_token', refreshToken);
        }

        // Notify parent component
        onAuthComplete?.(true, result.userType);

        // Redirect based on user type
        if (result.userType === 'employee' || result.userType === 'admin') {
          router.push('/portal?google_login=success');
        } else if (result.isNewUser) {
          router.push('/?google_register=success&new_user=true');
        } else {
          router.push('/?google_login=success');
        }
      } catch (error) {
        console.error('Error processing Google auth:', error);
        window.history.replaceState(null, '', window.location.pathname);
        router.push('/auth?error=' + encodeURIComponent('An unexpected error occurred'));
      }
    };

    handleHashAuth();
  }, [router, processing, onAuthComplete]);

  // Show loading indicator while processing
  if (processing) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-700">Completing Google sign-in...</p>
        </div>
      </div>
    );
  }

  return null;
}

export default GoogleAuthHandler;
