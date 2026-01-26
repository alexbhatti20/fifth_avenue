import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// Test endpoint to manually trigger invoice generation and check promo result
export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Call the generate_advanced_invoice RPC
    const { data, error } = await supabase.rpc('generate_advanced_invoice', {
      p_order_id: orderId,
      p_payment_method: 'cash',
      p_manual_discount: 0,
      p_tip: 0,
      p_service_charge: 0,
      p_promo_code: null,
      p_loyalty_points_used: 0,
      p_notes: 'Test invoice generation',
    });

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        hint: error.hint,
        details: error.details,
      }, { status: 500 });
    }

    // Check the response structure
    return NextResponse.json({
      success: true,
      fullResponse: data,
      invoiceNumber: data?.invoice_number,
      customer: data?.customer,
      rewardPromo: data?.reward_promo,
      message: data?.message,
      hasPromoGenerated: data?.reward_promo?.generated === true,
      promoCode: data?.reward_promo?.code || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

