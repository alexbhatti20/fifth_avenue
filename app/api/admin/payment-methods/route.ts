import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { invalidatePaymentMethodsCache } from '@/lib/cache';

// =============================================
// Admin Payment Methods API
// CRUD operations for payment methods (JazzCash, EasyPaisa, Bank)
// Only accessible by admin/manager roles
// =============================================

// Helper function to verify admin/manager access
async function verifyAdminAccess(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return { error: 'Unauthorized - No token provided', status: 401 };
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return { error: 'Unauthorized - Invalid token', status: 401 };
    }

    // Check for employee type (can be in 'type' or 'userType' field)
    const tokenType = decoded.type || decoded.userType;
    if (tokenType !== 'employee' && tokenType !== 'admin') {
      return { error: 'Unauthorized - Admin access required', status: 403 };
    }

    // If role is already in token and is admin/manager, trust it
    if (decoded.role && ['admin', 'manager'].includes(decoded.role)) {
      return { employeeId: decoded.userId, role: decoded.role };
    }

    // Check if user is admin or manager from database
    const { data: employee, error } = await supabase
      .from('employees')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (error || !employee) {
      return { error: 'Unauthorized - Employee not found', status: 401 };
    }

    if (!['admin', 'manager'].includes(employee.role)) {
      return { error: 'Unauthorized - Admin access required', status: 403 };
    }

    return { employeeId: decoded.userId, role: employee.role };
  } catch (err) {
    return { error: 'Unauthorized - Token verification failed', status: 401 };
  }
}

// GET /api/admin/payment-methods - Get all payment methods
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabase.rpc('get_all_payment_methods');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payment methods' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Unknown error' },
        { status: data?.error === 'Unauthorized' ? 403 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      methods: data.methods || [],
      stats: data.stats || {},
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/payment-methods - Create payment method
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      method_type,
      method_name,
      account_number,
      account_holder_name,
      bank_name,
      is_active = true,
      display_order = 0,
    } = body;

    // Validation
    if (!method_type || !method_name || !account_number || !account_holder_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('create_payment_method', {
      p_method_type: method_type,
      p_method_name: method_name,
      p_account_number: account_number,
      p_account_holder_name: account_holder_name,
      p_bank_name: bank_name || null,
      p_is_active: is_active,
      p_display_order: display_order,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to create payment method' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Unknown error' },
        { status: 400 }
      );
    }

    // Invalidate cache so customers see updated methods
    await invalidatePaymentMethodsCache();

    return NextResponse.json({
      success: true,
      id: data.id,
      message: data.message,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/payment-methods - Update payment method
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      id,
      method_type,
      method_name,
      account_number,
      account_holder_name,
      bank_name,
      is_active,
      display_order,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('update_payment_method', {
      p_id: id,
      p_method_type: method_type || null,
      p_method_name: method_name || null,
      p_account_number: account_number || null,
      p_account_holder_name: account_holder_name || null,
      p_bank_name: bank_name,
      p_is_active: is_active,
      p_display_order: display_order,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update payment method' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Unknown error' },
        { status: 400 }
      );
    }

    // Invalidate cache
    await invalidatePaymentMethodsCache();

    return NextResponse.json({
      success: true,
      message: data.message,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/payment-methods - Delete payment method
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('delete_payment_method', {
      p_id: id,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete payment method' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Unknown error' },
        { status: 400 }
      );
    }

    // Invalidate cache
    await invalidatePaymentMethodsCache();

    return NextResponse.json({
      success: true,
      message: data.message,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/payment-methods - Toggle payment method status
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'ID and is_active status are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('toggle_payment_method_status', {
      p_id: id,
      p_is_active: is_active,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to toggle payment method status' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Unknown error' },
        { status: 400 }
      );
    }

    // Invalidate cache
    await invalidatePaymentMethodsCache();

    return NextResponse.json({
      success: true,
      is_active: data.is_active,
      message: data.message,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

