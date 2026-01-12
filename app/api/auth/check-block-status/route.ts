import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify JWT and get employee ID
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Use RPC function to check block status (bypasses RLS)
    const { data, error } = await supabase.rpc('get_employee_block_status_by_id', {
      p_employee_id: decoded.userId,
    });

    if (error) {
      // RPC function might not exist yet - return not blocked
      console.error('RPC error (function may not exist):', error.message);
      return NextResponse.json({ 
        isBlocked: false, 
        error: 'RPC function not available. Please run the SQL migration.' 
      });
    }

    return NextResponse.json({
      isBlocked: data?.is_blocked || false,
      blockReason: data?.block_reason || null,
      status: data?.status,
      portalEnabled: data?.portal_enabled,
    });
  } catch (error: any) {
    console.error('Check block status error:', error);
    return NextResponse.json({ 
      isBlocked: false, 
      error: error.message 
    }, { status: 500 });
  }
}
