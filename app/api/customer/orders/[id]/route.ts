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
  const decoded = await verifyToken(token);
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
    
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
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
        employees:assigned_to (name, phone)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json({ data: null, error: error.message });
    }
    
    if (!order) {
      return NextResponse.json({ data: null, error: 'Order not found' });
    }
    
    // Format the response
    const employee = Array.isArray(order.employees) ? order.employees[0] : order.employees;
    const formattedOrder = {
      ...order,
      assigned_to_name: employee?.name || null,
      assigned_to_phone: employee?.phone || null,
    };
    delete (formattedOrder as any).employees;
    
    return NextResponse.json({ data: formattedOrder, error: null });
  } catch (error) {
    console.error('[Order API] Exception:', error);
    return NextResponse.json({ data: null, error: "Failed to fetch order details" });
  }
}
