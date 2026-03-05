import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// Helper to get authenticated customer from JWT
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return null;

  // Verify our custom JWT token
  let decoded = await verifyToken(token);

  // If access token expired, try to refresh using the refresh token cookie
  if (!decoded) {
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;
    if (refreshToken) {
      try {
        const { createClient } = await import('@/lib/supabase');
        const anonClient = createClient();
        const { data: refreshData } = await anonClient.auth.setSession({
          access_token: token,
          refresh_token: refreshToken,
        });
        if (refreshData?.session?.access_token) {
          decoded = await verifyToken(refreshData.session.access_token);
        }
      } catch {
        // Refresh failed
      }
    }
  }

  if (!decoded || !decoded.userId) return null;
  
  // For customers, userId is the customer.id from the customers table
  // Verify the customer exists
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', decoded.userId)
    .single();

  return customer;
}

// GET /api/customer/orders/[id] - Get order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await getAuthenticatedCustomer();

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_type,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        items,
        subtotal,
        tax,
        delivery_fee,
        discount,
        total,
        payment_method,
        payment_status,
        status,
        notes,
        assigned_to,
        created_at,
        delivered_at,
        transaction_id,
        online_payment_method_id,
        online_payment_details,
        waiter_id,
        assigned_employee:assigned_to (name, phone),
        waiter:waiter_id (name)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json({ data: null, error: error.message });
    }
    
    if (!order) {
      return NextResponse.json({ data: null, error: 'Order not found' });
    }

    // Fetch status history separately
    const { data: statusHistory } = await supabase
      .from('order_status_history')
      .select('status, notes, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    // Format the response
    const empData = (order as any).assigned_employee;
    const employee = Array.isArray(empData) ? empData[0] : empData;
    const waiterData = (order as any).waiter;
    const waiter = Array.isArray(waiterData) ? waiterData[0] : waiterData;
    const formattedOrder = {
      ...order,
      assigned_to_name: employee?.name || null,
      assigned_to_phone: employee?.phone || null,
      waiter_name: waiter?.name || null,
      status_history: statusHistory || [],
    };
    delete (formattedOrder as any).assigned_employee;
    delete (formattedOrder as any).waiter;
    
    return NextResponse.json({ data: formattedOrder, error: null });
  } catch (error) {
    console.error('[Order API] Exception:', error);
    return NextResponse.json({ data: null, error: "Failed to fetch order details" });
  }
}
