import { NextRequest, NextResponse } from 'next/server';
import { sendPromoCodeEmail, PromoCodeEmailParams } from '@/lib/brevo';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      customerEmail, 
      customerName, 
      promoCode, 
      promoType, 
      value, 
      maxDiscount, 
      expiresAt, 
      loyaltyPointsEarned,
      promoName 
    } = body;

    // Validate required fields
    if (!customerEmail || !customerName || !promoCode || !promoType || !value || !expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send the email
    const result = await sendPromoCodeEmail({
      to: customerEmail,
      customerName,
      promoCode,
      promoType,
      value,
      maxDiscount,
      expiresAt,
      loyaltyPointsEarned,
      promoName,
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Promo code email sent successfully' 
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email', details: result },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending promo email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
