import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

// Allowed image types and max size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderId = formData.get('orderId') as string | null;
    const paymentMethod = formData.get('paymentMethod') as string | null;
    const transactionId = formData.get('transactionId') as string | null;

    if (!file || !orderId) {
      return NextResponse.json(
        { error: 'File and orderId are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Verify the order belongs to this customer
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, status, payment_method, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.customer_id !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized access to order' }, { status: 403 });
    }

    // Check if order is in valid state for payment proof
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot upload payment proof for cancelled order' }, { status: 400 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Order is already paid' }, { status: 400 });
    }

    // Check payment method requires proof
    const requiresProof = ['jazzcash', 'easypaisa', 'bank_transfer'].includes(order.payment_method);
    if (!requiresProof) {
      return NextResponse.json(
        { error: 'Payment proof not required for this payment method' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `payment-proofs/${decoded.userId}/${orderId}_${timestamp}_${randomStr}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    const proofUrl = urlData.publicUrl;

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        order_id: orderId,
        customer_id: decoded.userId,
        amount: 0, // Will be updated when verified
        payment_method: order.payment_method,
        status: 'pending_verification',
        proof_url: proofUrl,
        transaction_id: transactionId || null,
        notes: `Payment proof uploaded via ${paymentMethod || order.payment_method}`
      })
      .select('id')
      .single();

    if (paymentError) {
      // Still continue - the proof is uploaded
    }

    // Update order with payment proof URL
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_proof_url: proofUrl,
        payment_status: 'pending_verification'
      })
      .eq('id', orderId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    // Create notification for staff
    await supabase.from('notifications').insert({
      user_type: 'employee',
      user_id: null, // Broadcast to all cashiers
      title: 'Payment Proof Received',
      message: `New payment proof uploaded for order. Please verify.`,
      type: 'payment_verification',
      reference_id: orderId
    });

    // Create notification for customer
    await supabase.from('notifications').insert({
      user_type: 'customer',
      user_id: decoded.userId,
      title: 'Payment Proof Uploaded',
      message: 'Your payment proof has been uploaded and is pending verification.',
      type: 'payment_update',
      reference_id: orderId
    });

    return NextResponse.json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: {
        proof_url: proofUrl,
        payment_record_id: paymentRecord?.id,
        status: 'pending_verification'
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

