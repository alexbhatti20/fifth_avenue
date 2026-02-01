import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// Helper to get authenticated customer from JWT
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return { customer: null, token: null };

  // Verify our custom JWT token
  const decoded = await verifyToken(token);
  if (!decoded || !decoded.userId) return { customer: null, token: null };
  
  // Create authenticated client
  const supabase = createAuthenticatedClient(token);
  
  // For customers, userId is the customer.id from the customers table
  // Verify the customer exists
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', decoded.userId)
    .single();

  return { customer, token };
}

// GET /api/customer/orders/active - Get recent active orders for tracking
export async function GET(request: NextRequest) {
  try {
    const { customer, token } = await getAuthenticatedCustomer();
    if (!customer || !token) {
      return NextResponse.json({ data: [], error: null });
    }
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total, customer_address, created_at')
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({ data: [], error: error.message });
    }

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    return NextResponse.json({ data: [], error: "Failed to fetch active orders" });
  }
}
