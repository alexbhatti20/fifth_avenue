// =============================================
// INVENTORY API - Suppliers
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { getInventorySuppliers, createInventorySupplier } from '@/lib/inventory-queries';

export async function GET() {
  try {
    const suppliers = await getInventorySuppliers();
    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    console.error('Suppliers GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await createInventorySupplier({
      name: body.name,
      contact_person: body.contact_person,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      payment_terms: body.payment_terms,
      lead_time_days: body.lead_time_days,
      notes: body.notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: { id: result.id } });
  } catch (error: any) {
    console.error('Suppliers POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
