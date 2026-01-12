import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

// GET /api/orders/track?id=order_id
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Build query based on user type
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_type,
        status,
        payment_status,
        payment_method,
        items,
        subtotal,
        tax_amount,
        delivery_fee,
        discount_amount,
        total_amount,
        delivery_address,
        delivery_instructions,
        table_number,
        notes,
        estimated_ready_time,
        created_at,
        updated_at,
        customer:customers(id, full_name, phone)
      `)
      .eq('id', orderId);

    // If customer, ensure they can only see their own orders
    if (decoded.userType === 'customer') {
      query = query.eq('customer_id', decoded.userId);
    }

    const { data: order, error: orderError } = await query.single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get order status history
    const { data: statusHistory, error: historyError } = await supabase
      .from('order_status_history')
      .select(`
        id,
        status,
        notes,
        created_at,
        changed_by:employees(full_name)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    // Map status to progress steps
    const statusSteps = [
      { status: 'pending', label: 'Order Placed', icon: '📝' },
      { status: 'confirmed', label: 'Confirmed', icon: '✅' },
      { status: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
      { status: 'ready', label: 'Ready', icon: '🍽️' },
      { status: order.order_type === 'delivery' ? 'out_for_delivery' : 'served', 
        label: order.order_type === 'delivery' ? 'Out for Delivery' : 'Served', 
        icon: order.order_type === 'delivery' ? '🚗' : '🍴' },
      { status: 'delivered', label: 'Delivered', icon: '✨' }
    ];

    // Calculate current step and progress
    const currentStatus = order.status;
    const currentStepIndex = statusSteps.findIndex(s => s.status === currentStatus);
    const progressPercentage = currentStatus === 'cancelled' 
      ? 0 
      : Math.round(((currentStepIndex + 1) / statusSteps.length) * 100);

    // Get estimated time based on status
    let estimatedTime = order.estimated_ready_time;
    if (!estimatedTime) {
      // Default estimates based on status
      switch (currentStatus) {
        case 'pending':
        case 'confirmed':
          estimatedTime = order.order_type === 'delivery' ? '45-60 mins' : '25-35 mins';
          break;
        case 'preparing':
          estimatedTime = order.order_type === 'delivery' ? '35-45 mins' : '15-20 mins';
          break;
        case 'ready':
          estimatedTime = order.order_type === 'delivery' ? '20-30 mins' : 'Ready now';
          break;
        case 'out_for_delivery':
          estimatedTime = '15-25 mins';
          break;
        default:
          estimatedTime = null;
      }
    }

    // Build timeline from status history
    const timeline = statusHistory?.map(entry => {
      const changedByEmployee = Array.isArray(entry.changed_by) 
        ? entry.changed_by[0] 
        : entry.changed_by;
      
      return {
        status: entry.status,
        label: statusSteps.find(s => s.status === entry.status)?.label || entry.status,
        icon: statusSteps.find(s => s.status === entry.status)?.icon || '📋',
        notes: entry.notes,
        timestamp: entry.created_at,
        changedBy: changedByEmployee?.full_name || null
      };
    }) || [];

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        tracking: {
          currentStatus,
          currentStepIndex,
          totalSteps: statusSteps.length,
          progressPercentage,
          estimatedTime,
          isCancelled: currentStatus === 'cancelled',
          isCompleted: ['delivered', 'completed'].includes(currentStatus),
          steps: statusSteps.map((step, index) => ({
            ...step,
            isCompleted: index < currentStepIndex,
            isCurrent: index === currentStepIndex,
            isPending: index > currentStepIndex
          }))
        },
        timeline
      }
    });

  } catch (error) {
    console.error('Order tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
