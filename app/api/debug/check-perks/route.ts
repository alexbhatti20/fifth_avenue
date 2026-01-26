import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  
  const results: any = {};
  
  // 1. Check perks_settings table
  const { data: perksSettings, error: perksError } = await supabase
    .from('perks_settings')
    .select('*')
    .eq('setting_key', 'loyalty_thresholds');
  
  results.perks_settings = { data: perksSettings, error: perksError?.message };
  
  // 2. Check customer_promo_codes table exists
  const { data: promoCodesTable, error: promoError } = await supabase
    .from('customer_promo_codes')
    .select('*')
    .limit(5);
  
  results.customer_promo_codes = { 
    exists: !promoError?.message?.includes('does not exist'),
    sample: promoCodesTable,
    error: promoError?.message 
  };
  
  // 3. Get a sample customer with points
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('id, name, email, loyalty_points')
    .order('loyalty_points', { ascending: false })
    .limit(5);
  
  results.customers_with_points = { data: customers, error: custError?.message };
  
  // 4. Check loyalty_points table
  const { data: loyaltyPoints, error: lpError } = await supabase
    .from('loyalty_points')
    .select('customer_id, points, type')
    .limit(10);
  
  results.loyalty_points_samples = { data: loyaltyPoints, error: lpError?.message };
  
  // 5. Find orders for the customer that can be billed (no invoice yet)
  const { data: pendingOrders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, status, payment_status')
    .eq('customer_id', '55be86a8-d343-4c62-babd-0f9456581020')
    .limit(10);
  
  results.pending_orders = { data: pendingOrders, error: ordersError?.message };

  return NextResponse.json(results, { status: 200 });
}

