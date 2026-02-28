import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/auth/google - Initiate Google OAuth
export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json();
    
    // type can be 'login' or 'register'
    // Determine the base URL from the request
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const redirectTo = `${baseUrl}/api/auth/google/callback?intent=${type || 'login'}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.json(
        { error: 'Failed to initiate Google sign-in' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google sign-in' },
      { status: 500 }
    );
  }
}
