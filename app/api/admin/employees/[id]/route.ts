import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

// GET /api/admin/employees/[id] - Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase.rpc('get_employee_complete', {
      p_employee_id: id
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

// PUT /api/admin/employees/[id] - Update single employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }
    
    // Check if user is admin or employee (allow admins to update employees)
    const isAuthorized = decoded.userType === 'admin' || 
                         decoded.userType === 'employee' || 
                         decoded.type === 'admin' || 
                         decoded.type === 'employee' ||
                         decoded.role === 'admin';
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized - Insufficient permissions' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      name,
      email,
      phone,
      cnic,
      address,
      emergency_contact,
      emergency_contact_name,
      date_of_birth,
      blood_group,
      role,
      status,
      permissions,
      portal_enabled,
      salary,
      hired_date,
      notes,
      bank_details,
      avatar_url,
      block_reason,
    } = body;

    // Build update object - only include fields that are defined
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (cnic !== undefined) updateData.cnic = cnic;
    if (address !== undefined) updateData.address = address;
    if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact;
    if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (blood_group !== undefined) updateData.blood_group = blood_group;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (permissions !== undefined) updateData.permissions = permissions || {};
    if (portal_enabled !== undefined) updateData.portal_enabled = portal_enabled;
    if (salary !== undefined) updateData.salary = salary;
    if (hired_date !== undefined) updateData.hired_date = hired_date;
    if (notes !== undefined) updateData.notes = notes;
    if (bank_details !== undefined) updateData.bank_details = bank_details || {};
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (block_reason !== undefined) updateData.block_reason = block_reason;

    // Update employee in database - use admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        error: error.message || 'Database update failed',
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error?.message || 'Failed to update employee',
      details: String(error)
    }, { status: 500 });
  }
}

// DELETE /api/admin/employees/[id] - Delete single employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete employees' }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
