'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Global handler for Google OAuth implicit flow
 * This component detects access_token in URL hash and processes the authentication
 * It should be placed in the root layout to handle OAuth redirects on any page
 */
export function GlobalGoogleAuthHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Completing Google sign-in...');
  const processedRef = useRef(false);

  useEffect(() => {
    const handleHashAuth = async () => {
      // Skip if on portal pages or api routes
      if (pathname?.startsWith('/portal') || pathname?.includes('/api/')) return;
      
      // Check if we have hash parameters (implicit OAuth flow)
      if (typeof window === 'undefined') return;
      
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) return;

      // Prevent double processing
      if (processedRef.current || processing) return;
      processedRef.current = true;
      setProcessing(true);

      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.error('Google auth processing timed out');
        window.history.replaceState(null, '', window.location.pathname);
        setProcessing(false);
        processedRef.current = false;
        router.push('/auth?error=' + encodeURIComponent('Sign-in timed out. Please try again.'));
      }, 30000); // 30 second timeout

      try {
        // Parse hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken) {
          console.error('No access token in hash');
          clearTimeout(timeoutId);
          window.history.replaceState(null, '', window.location.pathname);
          setProcessing(false);
          processedRef.current = false;
          return;
        }

        setStatusMessage('Setting up your session...');

        // Set the session in Supabase
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError || !sessionData.session) {
          console.error('Failed to set session:', sessionError);
          clearTimeout(timeoutId);
          window.history.replaceState(null, '', window.location.pathname);
          setProcessing(false);
          processedRef.current = false;
          router.push('/auth?error=' + encodeURIComponent('Failed to complete Google sign-in: ' + (sessionError?.message || 'Session error')));
          return;
        }

        const user = sessionData.user;
        const email = user?.email?.toLowerCase();
        const name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';

        if (!email) {
          clearTimeout(timeoutId);
          window.history.replaceState(null, '', window.location.pathname);
          setProcessing(false);
          processedRef.current = false;
          router.push('/auth?error=' + encodeURIComponent('No email received from Google'));
          return;
        }

        setStatusMessage('Creating your account...');

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

        clearTimeout(timeoutId);

        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          window.history.replaceState(null, '', window.location.pathname);
          setProcessing(false);
          processedRef.current = false;
          router.push('/auth?error=' + encodeURIComponent('Server error. Please try again.'));
          return;
        }

        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);

        if (!response.ok || result.error) {
          console.error('API error:', result.error);
          // Sign out if there's an error
          await supabase.auth.signOut();
          setProcessing(false);
          processedRef.current = false;
          router.push('/auth?error=' + encodeURIComponent(result.error || 'Authentication failed'));
          return;
        }

        setStatusMessage('Redirecting...');

        // IMPORTANT: Clear ALL old auth data first to prevent stale data issues
        localStorage.removeItem('user_type');
        localStorage.removeItem('user_data');
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
        localStorage.removeItem('auth_token');

        // Store tokens in localStorage as backup
        localStorage.setItem('sb_access_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('sb_refresh_token', refreshToken);
        }

        // Store user type for portal
        localStorage.setItem('user_type', result.userType);
        
        // Store user_data - use employee data from server if available
        let userData;
        if (result.employeeData && (result.userType === 'admin' || result.userType === 'employee')) {
          // Use actual employee data from database
          userData = {
            id: result.employeeData.id,
            auth_user_id: user.id,
            email: email,
            name: result.employeeData.name,
            role: result.employeeData.role,
            employee_id: result.employeeData.employee_id,
            is_2fa_enabled: false,
          };
        } else {
          // Customer data
          userData = {
            id: user.id,
            email: email,
            name: name || email,
            role: result.userType,
            is_2fa_enabled: false,
          };
        }
        localStorage.setItem('user_data', JSON.stringify(userData));

        // Redirect based on user type
        if (result.userType === 'employee' || result.userType === 'admin') {
          window.location.href = '/portal?google_login=success';
        } else if (result.isNewUser) {
          window.location.href = '/?google_register=success&new_user=true';
        } else {
          window.location.href = '/?google_login=success';
        }
      } catch (error) {
        console.error('Error processing Google auth:', error);
        clearTimeout(timeoutId);
        window.history.replaceState(null, '', window.location.pathname);
        setProcessing(false);
        processedRef.current = false;
        router.push('/auth?error=' + encodeURIComponent('An unexpected error occurred'));
      }
    };

    handleHashAuth();
  }, [router, pathname, processing]);

  // Cancel handler
  const handleCancel = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setProcessing(false);
    processedRef.current = false;
    supabase.auth.signOut();
    router.push('/auth');
  };

  // Show loading indicator while processing
  if (processing) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4 shadow-xl min-w-[300px]">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-700 font-medium">{statusMessage}</p>
          <p className="text-gray-500 text-sm">Please wait while we set up your account</p>
          <button
            onClick={handleCancel}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default GlobalGoogleAuthHandler;
