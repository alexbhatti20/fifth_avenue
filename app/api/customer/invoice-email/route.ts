import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/lib/brevo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      customerEmail,
      customerName,
      invoiceNumber,
      invoiceDate,
      orderType,
      items,
      subtotal,
      discount,
      tax,
      serviceCharge,
      deliveryFee,
      tip,
      total,
      paymentMethod,
      tableNumber,
      pointsEarned,
      rewardPromoCode,
    } = body;

    if (!customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Customer email is required' },
        { status: 400 }
      );
    }

    const result = await sendInvoiceEmail({
      to: customerEmail,
      customerName: customerName || 'Valued Customer',
      invoiceNumber,
      invoiceDate: invoiceDate || new Date().toISOString(),
      orderType,
      items: items || [],
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      serviceCharge: serviceCharge || 0,
      deliveryFee: deliveryFee || 0,
      tip: tip || 0,
      total: total || 0,
      paymentMethod: paymentMethod || 'cash',
      tableNumber,
      pointsEarned,
      rewardPromoCode,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Invoice email sent successfully' });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Invoice email API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
