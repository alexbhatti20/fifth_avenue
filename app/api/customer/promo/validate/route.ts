import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    // Get customer ID from token (optional - guest checkout support)
    let customerId: string | null = null;
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.userType === 'customer') {
        customerId = decoded.userId;
      }
    }

    const body = await request.json();
    const { code, order_amount } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Promo code is required' },
        { status: 400 }
      );
    }

    if (!order_amount || typeof order_amount !== 'number' || order_amount <= 0) {
      return NextResponse.json(
        { valid: false, error: 'Valid order amount is required' },
        { status: 400 }
      );
    }

    // Try validate_promo_code_for_billing RPC (already exists in billing-rpc.sql)
    const { data, error } = await supabase.rpc('validate_promo_code_for_billing', {
      p_code: code.trim().toUpperCase(),
      p_customer_id: customerId,
      p_order_amount: order_amount,
    });

    if (!error && data) {
      // RPC returned result
      return NextResponse.json(data);
    }

    // RPC failed - fall back to direct query
    if (error) {
      console.log('validate_promo_code_for_billing RPC error:', error.message);
    }
    
    return await validatePromoDirectly(code, customerId, order_amount);

  } catch (error) {
    console.error('Promo validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Fallback function if RPC doesn't exist yet
async function validatePromoDirectly(code: string, customerId: string | null, orderAmount: number) {
  try {
    // Find the promo code
    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', code.trim())
      .single();

    if (error || !promo) {
      return NextResponse.json({ valid: false, error: 'Invalid promo code' });
    }

    // Check if active
    if (!promo.is_active) {
      return NextResponse.json({ valid: false, error: 'This promo code is no longer active' });
    }

    // Check customer-specific codes
    if (promo.customer_id && promo.customer_id !== customerId) {
      return NextResponse.json({ valid: false, error: 'This promo code is not available for your account' });
    }

    // Check validity dates
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return NextResponse.json({ valid: false, error: 'This promo code is not yet active' });
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return NextResponse.json({ valid: false, error: 'This promo code has expired' });
    }

    // Check usage limit
    if (promo.usage_limit && promo.current_usage >= promo.usage_limit) {
      return NextResponse.json({ valid: false, error: 'This promo code has already been used' });
    }

    // Check minimum order
    if (promo.min_order_amount && orderAmount < promo.min_order_amount) {
      return NextResponse.json({ 
        valid: false, 
        error: `Minimum order of Rs. ${promo.min_order_amount} required`,
        min_order_amount: promo.min_order_amount
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.promo_type === 'percentage') {
      discountAmount = Math.round((orderAmount * promo.value / 100) * 100) / 100;
      if (promo.max_discount && discountAmount > promo.max_discount) {
        discountAmount = promo.max_discount;
      }
    } else if (promo.promo_type === 'fixed_amount' || promo.promo_type === 'fixed') {
      discountAmount = Math.min(promo.value, orderAmount);
    } else {
      discountAmount = promo.value || 0;
    }

    // Build message
    let message = '';
    if (promo.promo_type === 'percentage') {
      message = `${promo.value}% discount applied!`;
      if (promo.max_discount) {
        message += ` (up to Rs. ${promo.max_discount})`;
      }
    } else {
      message = `Rs. ${discountAmount} discount applied!`;
    }

    return NextResponse.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        name: promo.name || promo.code,
        description: promo.description,
        promo_type: promo.promo_type,
        value: promo.value,
        max_discount: promo.max_discount,
        is_customer_reward: !!promo.customer_id,
      },
      discount_amount: discountAmount,
      final_amount: Math.max(0, orderAmount - discountAmount),
      message,
    });

  } catch (err) {
    console.error('Direct promo validation error:', err);
    return NextResponse.json({ valid: false, error: 'Failed to validate promo code' }, { status: 500 });
  }
}
