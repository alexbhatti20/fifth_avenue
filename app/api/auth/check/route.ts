import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value || 
                  cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        authenticated: false,
        userType: null,
        role: null,
        error: 'Not authenticated'
      });
    }

    // Decode token
    let userId: string | undefined;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        userId = payload.userId || payload.sub;
      }
    } catch (e) {
      return NextResponse.json({ 
        authenticated: false,
        userType: null,
        role: null,
        error: 'Invalid token'
      });
    }

    if (!userId) {
      return NextResponse.json({ 
        authenticated: false,
        userType: null,
        role: null,
        error: 'Invalid token payload'
      });
    }

    const client = createAuthenticatedClient(token);

    // Check if user is employee
    const { data: employee } = await client
      .from('employees')
      .select('id, name, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (employee) {
      return NextResponse.json({
        authenticated: true,
        userType: 'employee',
        role: employee.role,
        user: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
        }
      });
    }

    // Check if user is customer
    const { data: customer } = await client
      .from('customers')
      .select('id, name, email')
      .eq('id', userId)
      .maybeSingle();

    if (customer) {
      return NextResponse.json({
        authenticated: true,
        userType: 'customer',
        role: null,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        }
      });
    }

    return NextResponse.json({ 
      authenticated: false,
      userType: null,
      role: null,
      error: 'User not found'
    });

  } catch (error: any) {
    console.error('[Auth Check] Error:', error);
    return NextResponse.json({ 
      authenticated: false,
      userType: null,
      role: null,
      error: error.message 
    }, { status: 500 });
  }
}
