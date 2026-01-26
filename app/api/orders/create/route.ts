import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { redis, redisKeys, CACHE_TTL, getCache, setCache } from '@/lib/redis';

// Payment method types (must match database enum: cash, card, online, wallet)
type PaymentMethod = 'cash' | 'card' | 'online' | 'wallet';

// Order item interface
interface OrderItem {
  menu_item_id?: string;
  meal_id?: string;
  deal_id?: string;
  quantity: number;
  special_instructions?: string;
}

// Order request interface (order_type must match database enum: online, walk-in, dine-in)
interface CreateOrderRequest {
  order_type: 'online' | 'walk-in' | 'dine-in';
  items: OrderItem[];
  payment_method: PaymentMethod;
  promo_code?: string;
  use_loyalty_points?: number;
  delivery_address?: string;
  delivery_instructions?: string;
  table_number?: number;
  notes?: string;
  // Online payment fields
  online_payment_method_id?: string;
  online_payment_method_name?: string;
  transaction_id?: string;
}

// Validate order items
async function validateAndCalculateItems(items: OrderItem[]): Promise<{
  valid: boolean;
  error?: string;
  validatedItems: any[];
  subtotal: number;
}> {
  const validatedItems: any[] = [];
  let subtotal = 0;

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > 100) {
      return { valid: false, error: 'Invalid quantity', validatedItems: [], subtotal: 0 };
    }

    if (item.menu_item_id) {
      // Check menu item
      const { data: menuItem, error } = await supabase
        .from('menu_items')
        .select('id, name, price, is_available')
        .eq('id', item.menu_item_id)
        .single();

      if (error || !menuItem) {
        return { valid: false, error: `Menu item not found: ${item.menu_item_id}`, validatedItems: [], subtotal: 0 };
      }

      if (!menuItem.is_available) {
        return { valid: false, error: `Item "${menuItem.name}" is not available`, validatedItems: [], subtotal: 0 };
      }

      validatedItems.push({
        menu_item_id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        special_instructions: item.special_instructions || null,
        item_total: menuItem.price * item.quantity
      });

      subtotal += menuItem.price * item.quantity;

    } else if (item.meal_id) {
      // Check meal
      const { data: meal, error } = await supabase
        .from('meals')
        .select('id, name, price, is_available')
        .eq('id', item.meal_id)
        .single();

      if (error || !meal) {
        return { valid: false, error: `Meal not found: ${item.meal_id}`, validatedItems: [], subtotal: 0 };
      }

      if (!meal.is_available) {
        return { valid: false, error: `Meal "${meal.name}" is not available`, validatedItems: [], subtotal: 0 };
      }

      validatedItems.push({
        meal_id: meal.id,
        name: meal.name,
        price: meal.price,
        quantity: item.quantity,
        special_instructions: item.special_instructions || null,
        item_total: meal.price * item.quantity
      });

      subtotal += meal.price * item.quantity;

    } else if (item.deal_id) {
      // Check deal
      const { data: deal, error } = await supabase
        .from('deals')
        .select('id, name, discounted_price, is_active, valid_from, valid_until')
        .eq('id', item.deal_id)
        .single();

      if (error || !deal) {
        return { valid: false, error: `Deal not found: ${item.deal_id}`, validatedItems: [], subtotal: 0 };
      }

      const now = new Date();
      const validFrom = deal.valid_from ? new Date(deal.valid_from) : null;
      const validUntil = deal.valid_until ? new Date(deal.valid_until) : null;

      if (!deal.is_active || (validFrom && now < validFrom) || (validUntil && now > validUntil)) {
        return { valid: false, error: `Deal "${deal.name}" is not currently active`, validatedItems: [], subtotal: 0 };
      }

      validatedItems.push({
        deal_id: deal.id,
        name: deal.name,
        price: deal.discounted_price,
        quantity: item.quantity,
        special_instructions: item.special_instructions || null,
        item_total: deal.discounted_price * item.quantity
      });

      subtotal += deal.discounted_price * item.quantity;
    } else {
      return { valid: false, error: 'Each item must have a menu_item_id, meal_id, or deal_id', validatedItems: [], subtotal: 0 };
    }
  }

  return { valid: true, validatedItems, subtotal };
}

// Validate and apply promo code using RPC
async function validatePromoCode(code: string, customerId: string, subtotal: number): Promise<{
  valid: boolean;
  promoId?: string;
  dealId?: string;
  discount?: number;
  error?: string;
  source?: 'promo_codes' | 'deals';
}> {
  // First, try validate_promo_code_for_billing RPC (already exists in billing-rpc.sql)
  const { data: rpcResult, error: rpcError } = await supabase.rpc('validate_promo_code_for_billing', {
    p_code: code.trim().toUpperCase(),
    p_customer_id: customerId,
    p_order_amount: subtotal,
  });

  if (!rpcError && rpcResult) {
    // RPC executed successfully
    if (rpcResult.valid) {
      // Increment usage since this is for order creation
      if (rpcResult.promo?.id) {
        // Get current usage and increment by 1
        const { data: currentPromo } = await supabase
          .from('promo_codes')
          .select('current_usage, usage_limit')
          .eq('id', rpcResult.promo.id)
          .single();
        
        const newUsage = (currentPromo?.current_usage || 0) + 1;
        const shouldDeactivate = currentPromo?.usage_limit && newUsage >= currentPromo.usage_limit;
        
        await supabase
          .from('promo_codes')
          .update({ 
            current_usage: newUsage,
            is_active: !shouldDeactivate
          })
          .eq('id', rpcResult.promo.id);
      }
      
      return {
        valid: true,
        promoId: rpcResult.promo?.id,
        discount: rpcResult.discount_amount,
        source: 'promo_codes',
      };
    } else {
      // RPC returned validation error
      return {
        valid: false,
        error: rpcResult.error || 'Invalid promo code',
      };
    }
  }

  // RPC doesn't exist or failed - fall back to direct query
  if (rpcError) {
    }
  
  const now = new Date();
  
  // First try promo_codes table
  const { data: promo, error: promoError } = await supabase
    .from('promo_codes')
    .select('*')
    .ilike('code', code.trim())
    .eq('is_active', true)
    .single();

  if (promo && !promoError) {
    // Validate from promo_codes table
    if (promo.customer_id && promo.customer_id !== customerId) {
      return { valid: false, error: 'This promo code is not available for your account' };
    }
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return { valid: false, error: 'Promo code is not yet active' };
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return { valid: false, error: 'Promo code has expired' };
    }
    if (promo.usage_limit && promo.current_usage >= promo.usage_limit) {
      return { valid: false, error: 'This promo code has already been fully used' };
    }
    if (promo.min_order_amount && subtotal < promo.min_order_amount) {
      return { valid: false, error: `Minimum order of Rs. ${promo.min_order_amount} required` };
    }

    // Calculate discount
    let discount = 0;
    if (promo.promo_type === 'percentage') {
      discount = (subtotal * promo.value) / 100;
      if (promo.max_discount && discount > promo.max_discount) {
        discount = promo.max_discount;
      }
    } else if (promo.promo_type === 'fixed_amount' || promo.promo_type === 'fixed') {
      discount = Math.min(promo.value, subtotal);
    } else {
      discount = promo.value || 0;
    }

    // Increment usage manually since RPC isn't available
    await supabase
      .from('promo_codes')
      .update({ 
        current_usage: (promo.current_usage || 0) + 1,
        is_active: promo.usage_limit && (promo.current_usage || 0) + 1 >= promo.usage_limit ? false : true
      })
      .eq('id', promo.id);

    return { valid: true, promoId: promo.id, discount, source: 'promo_codes' };
  }

  // Fallback: Check the deals table for promo codes
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('*')
    .eq('promo_code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (dealError || !deal) {
    return { valid: false, error: 'Invalid promo code' };
  }

  // Check validity dates for deal
  if (deal.valid_from && new Date(deal.valid_from) > now) {
    return { valid: false, error: 'Promo code is not yet active' };
  }
  if (deal.valid_until && new Date(deal.valid_until) < now) {
    return { valid: false, error: 'Promo code has expired' };
  }

  // Check minimum order
  if (deal.minimum_order && subtotal < deal.minimum_order) {
    return { valid: false, error: `Minimum order of Rs. ${deal.minimum_order} required` };
  }

  // Check usage limit per customer for deals
  if (deal.max_uses_per_customer) {
    const { count } = await supabase
      .from('promo_code_usage')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('deal_id', deal.id);

    if (count && count >= deal.max_uses_per_customer) {
      return { valid: false, error: 'You have already used this promo code the maximum number of times' };
    }
  }

  // Calculate discount for deal
  let discount = 0;
  if (deal.discount_type === 'percentage') {
    discount = (subtotal * deal.discount_value) / 100;
    if (deal.max_discount && discount > deal.max_discount) {
      discount = deal.max_discount;
    }
  } else if (deal.discount_type === 'fixed') {
    discount = deal.discount_value;
  }

  return { valid: true, dealId: deal.id, discount, source: 'deals' };
}

// Validate loyalty points
async function validateLoyaltyPoints(customerId: string, pointsToUse: number): Promise<{
  valid: boolean;
  availablePoints?: number;
  discount?: number;
  error?: string;
}> {
  // Get customer's loyalty balance
  const { data, error } = await supabase.rpc('get_loyalty_balance', {
    p_customer_id: customerId
  });

  if (error) {
    return { valid: false, error: 'Could not verify loyalty points' };
  }

  const availablePoints = data || 0;

  if (pointsToUse > availablePoints) {
    return { valid: false, availablePoints, error: `You only have ${availablePoints} points available` };
  }

  // 1 point = Rs. 0.10
  const discount = pointsToUse * 0.10;

  return { valid: true, availablePoints, discount };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: 'Customer access only' }, { status: 403 });
    }

    const body: CreateOrderRequest = await request.json();

    // Validate required fields
    if (!body.order_type || !body.items || body.items.length === 0 || !body.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: order_type, items, payment_method' },
        { status: 400 }
      );
    }

    // Validate order type (must match database enum)
    if (!['online', 'walk-in', 'dine-in'].includes(body.order_type)) {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }

    // Validate online orders have address (for delivery)
    if (body.order_type === 'online' && !body.delivery_address) {
      return NextResponse.json({ error: 'Delivery address is required for online orders' }, { status: 400 });
    }

    // Validate dine-in has table
    if (body.order_type === 'dine-in' && !body.table_number) {
      return NextResponse.json({ error: 'Table number is required for dine-in' }, { status: 400 });
    }

    // Validate payment method (must match database enum)
    const validPaymentMethods: PaymentMethod[] = ['cash', 'card', 'online', 'wallet'];
    if (!validPaymentMethods.includes(body.payment_method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Validate and calculate items
    const { valid, error: itemError, validatedItems, subtotal } = await validateAndCalculateItems(body.items);
    
    if (!valid) {
      return NextResponse.json({ error: itemError }, { status: 400 });
    }

    // Calculate discounts
    let promoDiscount = 0;
    let promoCodeDealId: string | null = null;
    let loyaltyPointsUsed = 0;
    let loyaltyDiscount = 0;

    // Validate promo code
    if (body.promo_code) {
      const promoResult = await validatePromoCode(body.promo_code, decoded.userId, subtotal);
      
      if (!promoResult.valid) {
        return NextResponse.json({ error: promoResult.error }, { status: 400 });
      }

      promoDiscount = promoResult.discount || 0;
      promoCodeDealId = promoResult.dealId || null;
    }

    // Validate loyalty points
    if (body.use_loyalty_points && body.use_loyalty_points > 0) {
      const loyaltyResult = await validateLoyaltyPoints(decoded.userId, body.use_loyalty_points);
      
      if (!loyaltyResult.valid) {
        return NextResponse.json({ error: loyaltyResult.error }, { status: 400 });
      }

      loyaltyPointsUsed = body.use_loyalty_points;
      loyaltyDiscount = loyaltyResult.discount || 0;
    }

    // Calculate delivery fee (for online orders which are delivery)
    let deliveryFee = 0;
    if (body.order_type === 'online') {
      // Get delivery fee from settings or use default
      const cacheKey = redisKeys.deliveryFee();
      const cachedFee = await getCache<string>(cacheKey);
      
      if (cachedFee) {
        deliveryFee = parseFloat(cachedFee);
      } else {
        // Default delivery fee
        deliveryFee = 150;
        
        // Try to get from site_content
        const { data: siteContent } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'delivery_fee')
          .single();
        
        if (siteContent?.content?.amount) {
          deliveryFee = parseFloat(siteContent.content.amount);
        }
        
        await setCache(cacheKey, deliveryFee.toString(), CACHE_TTL.LONG);
      }
    }

    // Calculate totals
    const totalDiscount = promoDiscount + loyaltyDiscount;
    const taxRate = 0.16; // 16% GST
    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const taxAmount = taxableAmount * taxRate;
    const grandTotal = taxableAmount + taxAmount + deliveryFee;

    // Generate order number
    const orderDate = new Date();
    const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ZB-${dateStr}-${randomPart}`;

    // Get customer info for the order
    const { data: customer } = await supabase
      .from('customers')
      .select('name, email, phone, address')
      .eq('id', decoded.userId)
      .single();

    // Create order using RPC function (bypasses RLS with SECURITY DEFINER)
    const { data: order, error: orderError } = await supabase.rpc('create_customer_order', {
      p_customer_id: decoded.userId,
      p_order_number: orderNumber,
      p_customer_name: customer?.name || 'Guest',
      p_customer_email: customer?.email || '',
      p_customer_phone: customer?.phone || '',
      p_customer_address: body.delivery_address || customer?.address || null,
      p_order_type: body.order_type,
      p_items: validatedItems,
      p_subtotal: subtotal,
      p_tax: taxAmount,
      p_delivery_fee: deliveryFee,
      p_discount: totalDiscount,
      p_total: grandTotal,
      p_payment_method: body.payment_method,
      p_payment_status: body.payment_method === 'online' && body.transaction_id ? 'pending_verification' : 'pending',
      p_table_number: body.table_number || null,
      p_notes: body.notes || null,
      p_transaction_id: body.payment_method === 'online' ? body.transaction_id : null,
      p_online_payment_method_id: body.payment_method === 'online' ? body.online_payment_method_id : null,
      p_online_payment_details: body.payment_method === 'online' && body.transaction_id ? {
        method_name: body.online_payment_method_name,
        submitted_at: new Date().toISOString(),
      } : null
    });

    if (orderError) {
      return NextResponse.json({ error: orderError.message || 'Failed to create order' }, { status: 500 });
    }

    // The RPC returns a JSONB object with success and id or error
    const rpcResult = order as { success: boolean; id?: string; error?: string };
    
    if (!rpcResult.success) {
      return NextResponse.json({ error: rpcResult.error || 'Failed to create order' }, { status: 500 });
    }

    const orderId = rpcResult.id;

    // Record promo code usage if used (non-critical, fire and forget)
    if (promoCodeDealId && orderId) {
      (async () => {
        try {
          await supabase.rpc('record_promo_usage', {
            p_customer_id: decoded.userId,
            p_deal_id: promoCodeDealId,
            p_order_id: orderId,
            p_discount: promoDiscount
          });
        } catch (e) { }
      })();
    }

    // Deduct loyalty points if used (non-critical, fire and forget)
    if (loyaltyPointsUsed > 0 && orderId) {
      (async () => {
        try {
          await supabase.rpc('deduct_loyalty_points', {
            p_customer_id: decoded.userId,
            p_order_id: orderId,
            p_points: loyaltyPointsUsed,
            p_order_number: orderNumber
          });
        } catch (e) { }
      })();
    }

    // Create customer notification (non-critical, fire and forget)
    (async () => {
      try {
        await supabase.rpc('create_customer_notification', {
          p_customer_id: decoded.userId,
          p_title: 'Order Placed Successfully!',
          p_message: `Your order #${orderNumber} has been placed. Total: Rs. ${grandTotal.toFixed(2)}`,
          p_type: 'order_update',
          p_reference_id: orderId
        });
      } catch (e) { }
    })();

    // Determine if payment proof is needed
    const requiresPaymentProof = ['jazzcash', 'easypaisa', 'bank_transfer'].includes(body.payment_method);

    return NextResponse.json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: orderId,
        order_number: orderNumber,
        order_type: body.order_type,
        status: 'pending',
        items: validatedItems,
        subtotal,
        tax_amount: taxAmount,
        delivery_fee: deliveryFee,
        promo_discount: promoDiscount,
        loyalty_discount: loyaltyDiscount,
        total_discount: totalDiscount,
        grand_total: grandTotal,
        payment_method: body.payment_method,
        requires_payment_proof: requiresPaymentProof,
        created_at: orderDate.toISOString()
      },
      estimated_time: body.order_type === 'online' ? '45-60 minutes' : '20-30 minutes'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

