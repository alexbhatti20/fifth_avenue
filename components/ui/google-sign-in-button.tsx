'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GoogleSignInButtonProps {
  type?: 'login' | 'register';
  className?: string;
  variant?: 'default' | 'outline';
  disabled?: boolean;
  onError?: (error: string) => void;
}

// Google "G" SVG logo
const GoogleIcon = () => (
  <svg 
    width="18" 
    height="18" 
    viewBox="0 0 18 18" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.482 18 9.003 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      fill="#FBBC05"
    />
    <path
      d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.48 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
      fill="#EA4335"
    />
  </svg>
);

export function GoogleSignInButton({ 
  type = 'login', 
  className = '',
  variant = 'outline',
  disabled = false,
  onError,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    if (isLoading || disabled) return;
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Google sign-in');
      }

      if (data.url) {
        // Redirect to Google OAuth
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      if (onError) {
        onError(errorMessage);
      }
      
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleGoogleSignIn}
      disabled={isLoading || disabled}
      className={`w-full flex items-center justify-center gap-3 h-12 text-base font-medium transition-all duration-200 ${
        variant === 'outline' 
          ? 'bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-700' 
          : ''
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <GoogleIcon />
      )}
      <span>
        {isLoading 
          ? 'Connecting...' 
          : type === 'register' 
            ? 'Continue with Google' 
            : 'Continue with Google'
        }
      </span>
    </Button>
  );
}

export default GoogleSignInButton;
