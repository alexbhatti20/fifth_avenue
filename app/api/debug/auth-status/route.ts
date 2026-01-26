import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/jwt';

// GET /api/debug/auth-status - Check auth status for debugging
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.replace('Bearer ', '');
  
  if (!accessToken) {
    return NextResponse.json({ 
      status: 'no_token',
      message: 'No authorization header provided'
    });
  }

  const result: any = {
    tokenLength: accessToken.length,
    tokenPrefix: accessToken.substring(0, 30) + '...',
  };

  // Try Supabase token
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    
    const { data: { user }, error } = await supabase.auth.getUser();
    result.supabaseAuth = {
      success: !error && !!user,
      userId: user?.id,
      email: user?.email,
      error: error?.message
    };
  } catch (e: any) {
    result.supabaseAuth = { success: false, error: e.message };
  }

  // Try custom JWT
  try {
    const decoded = verifyToken(accessToken);
    result.customJWT = {
      success: !!decoded,
      payload: decoded ? {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        userType: decoded.userType,
        exp: decoded.exp,
        expDate: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
      } : null
    };
  } catch (e: any) {
    result.customJWT = { success: false, error: e.message };
  }

  return NextResponse.json(result);
}

