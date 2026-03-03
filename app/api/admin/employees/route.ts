import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth';
import { invalidateMenuCache } from '@/lib/cache';
import { deleteFile, extractPathFromUrl } from '@/lib/storage';

// Helper to verify admin/manager token
async function verifyManagerToken(request: NextRequest): Promise<{ valid: boolean; error?: string; status?: number; user?: any }> {
  const decoded = await verifyAuth(request);
  if (!decoded) {
    return { valid: false, error: 'Unauthorized - Invalid token', status: 401 };
  }

  // Only admin/manager can manage employees
  if (!['admin', 'manager'].includes(decoded.role ?? '')) {
    return { valid: false, error: 'Forbidden - Only managers can manage employees', status: 403 };
  }

  return { valid: true, user: decoded };
}

// GET /api/admin/employees - Get all employees
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyManagerToken(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    const { data, error } = await supabase.rpc('get_all_employees');
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST /api/admin/employees - Create employee
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyManagerToken(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    const { email, name, phone, role, permissions } = await request.json();

    // Validate required fields
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Email, name, and role are required' }, { status: 400 });
    }

    // Prevent creating admin users unless you're admin
    if (role === 'admin' && auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create admin accounts' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('create_employee', {
      p_email: email,
      p_name: name,
      p_phone: phone || null,
      p_role: role,
      p_permissions: permissions || {},
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}

// PUT /api/admin/employees - Update employee
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyManagerToken(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    const { id, name, phone, role, permissions, status, avatar_url } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    // Prevent role escalation - only admin can set admin role
    if (role === 'admin' && auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can assign admin role' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('update_employee', {
      p_employee_id: id,
      p_name: name,
      p_phone: phone,
      p_role: role,
      p_permissions: permissions,
      p_status: status,
      p_avatar_url: avatar_url,
    });

    if (error) throw error;

    // Cleanup old avatar from storage if it was replaced
    if (avatar_url && data?.old_avatar_url && data.old_avatar_url !== avatar_url) {
      const oldPath = extractPathFromUrl(data.old_avatar_url, 'avatars');
      if (oldPath) {
        await deleteFile('avatars', oldPath).catch(() => {
          // Silent fail - don't block update if cleanup fails
        });
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

// DELETE /api/admin/employees - Delete employee
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyManagerToken(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (auth.user?.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('delete_employee', {
      p_employee_id: id,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}

