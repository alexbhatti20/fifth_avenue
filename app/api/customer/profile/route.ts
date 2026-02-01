import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, supabase as anonSupabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// Helper to get authenticated customer and token
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return { customer: null, token: null };

  // Use verifyToken to properly decode the token
  const decoded = await verifyToken(token);
  if (!decoded || decoded.userType !== 'customer') return { customer: null, token: null };
  
  // Create authenticated client
  const supabase = createAuthenticatedClient(token);

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', decoded.userId)
    .single();

  return { customer, token };
}

// GET /api/customer/profile - Get customer profile
export async function GET(request: NextRequest) {
  try {
    const { customer } = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ data: null, error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({ data: customer, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: "Failed to fetch profile" });
  }
}

// PUT /api/customer/profile - Update customer profile
export async function PUT(request: NextRequest) {
  try {
    const { customer, token } = await getAuthenticatedCustomer();
    if (!customer || !token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    const body = await request.json();
    const { name, phone, address } = body;

    const { data, error } = await supabase.rpc('update_customer_profile', {
      p_customer_id: customer.id,
      p_name: name,
      p_phone: phone,
      p_address: address,
    });

    if (error) {
      return NextResponse.json({ data: null, error: error.message });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: "Failed to update profile" });
  }
}
