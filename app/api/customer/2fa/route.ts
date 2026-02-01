import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

// Helper to get authenticated customer
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: customer } = await supabase
    .from('customers')
    .select('id, is_2fa_enabled')
    .eq('auth_user_id', user.id)
    .single();

  return customer;
}

// PUT /api/customer/2fa - Toggle 2FA
export async function PUT(request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    const { error } = await supabase
      .from('customers')
      .update({ is_2fa_enabled: enabled })
      .eq('id', customer.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabled, error: null });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update 2FA setting" }, { status: 500 });
  }
}
