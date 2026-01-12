import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/debug/check-customer - Check if customer exists and auth status
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const result: any = { email: normalizedEmail };

    // Check customers table
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, auth_user_id, email, name, is_verified, created_at')
      .ilike('email', normalizedEmail)
      .single();

    result.customerTable = {
      exists: !!customer,
      data: customer ? {
        id: customer.id,
        auth_user_id: customer.auth_user_id,
        name: customer.name,
        is_verified: customer.is_verified,
        created_at: customer.created_at,
        hasAuthUserId: !!customer.auth_user_id
      } : null,
      error: custError?.message
    };

    // Check via RPC function
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_by_email', {
      p_email: normalizedEmail
    });

    result.rpcLookup = {
      found: rpcResult && rpcResult.length > 0,
      data: rpcResult?.[0] || null,
      error: rpcError?.message
    };

    // Try to sign in to check if auth user exists (will fail but tells us if user exists)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: 'test-check-only-wrong-password-12345',
    });

    result.authCheck = {
      errorMessage: authError?.message,
      errorCode: authError?.code,
      // If error says "Invalid login credentials" - user exists but wrong password
      // If error says "Email not confirmed" - user exists but not confirmed
      // If error says something else - user might not exist
      interpretation: authError?.message?.includes('Invalid login credentials') 
        ? 'User EXISTS in auth.users (wrong password is expected)'
        : authError?.message?.includes('Email not confirmed')
        ? 'User EXISTS but email not confirmed'
        : 'User may NOT exist in auth.users'
    };

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
