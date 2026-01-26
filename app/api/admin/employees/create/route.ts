import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmployeeWelcomeEmail } from '@/lib/brevo';
import { redis } from '@/lib/redis';
import { verifyToken } from '@/lib/jwt';
import { supabase as anonSupabase } from '@/lib/supabase';

// Create Supabase client with user's access token
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    }
  );
}

// POST /api/admin/employees/create
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Unauthorized - No access token provided' 
      }, { status: 401 });
    }

    let isAdmin = false;
    let supabase = anonSupabase;

    // Try Supabase token first
    const supabaseClient = createAuthenticatedClient(accessToken);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (!authError && user) {
      // Valid Supabase token - check admin status
      supabase = supabaseClient;
      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single();
      
      isAdmin = employee?.role === 'admin';
    } else {
      // Try custom JWT token
      const decoded = verifyToken(accessToken);
      
      if (decoded) {
        isAdmin = decoded.userType === 'admin' || decoded.role === 'admin';
        // Use anon client for RPC (SECURITY DEFINER handles permissions)
        supabase = anonSupabase;
      } else {
        return NextResponse.json({ 
          error: 'Session expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        }, { status: 401 });
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized - Admin access required' 
      }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const {
      full_name, email, phone, cnic, address, emergency_contact,
      emergency_contact_name, date_of_birth, blood_group, photo_url,
      documents, role, custom_permissions, portal_enabled, base_salary,
      payment_frequency, bank_name, account_number, iban, hired_date,
      notes, employee_id: providedEmployeeId, license_id: providedLicenseId,
    } = body;

    // Validation
    if (!full_name || !email || !phone || !role) {
      return NextResponse.json({ error: 'Name, email, phone, and role are required' }, { status: 400 });
    }
    
    if (!cnic) {
      return NextResponse.json({ error: 'CNIC number is required' }, { status: 400 });
    }

    // Prepare data
    // Include bank details if any field is provided
    const bankDetails = (bank_name || account_number || iban) 
      ? { 
          bank_name: bank_name || '', 
          account_number: account_number || '', 
          iban: iban || '' 
        } 
      : {};
    // Custom permissions can be granted to ANY role (not just 'other')
    // These are extra permissions beyond the role's default permissions
    const permissions = custom_permissions?.length > 0
      ? custom_permissions.reduce((acc: Record<string, boolean>, perm: string) => { acc[perm] = true; return acc; }, {})
      : {};
    
    // Extract CNIC document file_url if uploaded
    const cnicDocument = documents?.find((doc: any) => doc.type === 'cnic');
    const cnicFileUrl = cnicDocument?.file_url || '';
    
    const documentsArray = documents?.filter((doc: any) => 
      doc.type !== 'cnic' && (doc.number || doc.file_url)
    ).map((doc: any) => ({
      type: doc.type, number: doc.number || '', file_url: doc.file_url || '', file_type: doc.file?.type || 'unknown',
    })) || [];

    // Call RPC (SECURITY DEFINER - works with anon key)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_employee_complete', {
      p_employee_id: providedEmployeeId || null,
      p_name: full_name,
      p_email: email,
      p_phone: phone,
      p_cnic: cnic,
      p_cnic_file_url: cnicFileUrl || null,
      p_address: address || null,
      p_emergency_contact: emergency_contact || null,
      p_emergency_contact_name: emergency_contact_name || null,
      p_date_of_birth: date_of_birth || null,
      p_blood_group: blood_group || null,
      p_avatar_url: photo_url || null,
      p_role: role,
      p_permissions: permissions,
      p_portal_enabled: portal_enabled ?? true,
      p_base_salary: base_salary || 25000,
      p_payment_frequency: payment_frequency || 'monthly',
      p_bank_details: bankDetails,
      p_hired_date: hired_date || new Date().toISOString().split('T')[0],
      p_notes: notes || null,
      p_license_id: providedLicenseId || null,
      p_license_expires_days: 7,
      p_documents: documentsArray,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message || 'Failed to create employee' }, { status: 500 });
    }

    if (!rpcResult?.success) {
      return NextResponse.json({ error: rpcResult?.error || 'Failed to create employee' }, { status: 400 });
    }

    const employeeData = rpcResult.data;

    // Async operations (don't block)
    sendEmployeeWelcomeEmail({
      to: email, employeeName: full_name, employeeId: employeeData.employee_id,
      licenseId: employeeData.license_id, role, salary: base_salary,
      hireDate: hired_date || new Date().toISOString(), portalEnabled: portal_enabled ?? true,
    }).catch(() => {});

    redis.del('portal:employees:list').catch(() => {});

    return NextResponse.json({ success: true, data: employeeData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create employee' }, { status: 500 });
  }
}

