import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabase } from '@/lib/supabase';

// Rate limit key for contact form
const CONTACT_RATE_KEY = (ip: string) => `rate:contact:${ip}`;

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Rate limiting: max 3 messages per hour per IP (using Redis if available)
    if (redis) {
      const rateLimitKey = CONTACT_RATE_KEY(ip);
      const currentCount = await redis.get<number>(rateLimitKey) || 0;
      
      if (currentCount >= 3) {
        return NextResponse.json(
          { 
            error: 'Too many messages. Please wait before sending another message.',
            retryAfter: 3600
          },
          { status: 429 }
        );
      }

      // Increment rate limit counter
      await redis.set(rateLimitKey, currentCount + 1, { ex: 3600 }); // 1 hour expiry
    }

    const body = await request.json();
    const { name, email, phone, message, subject } = body;

    // Sanitize phone number if provided
    let sanitizedPhone = '';
    if (phone) {
      sanitizedPhone = phone.replace(/[^\d+\-\s()]/g, '').slice(0, 20);
    }

    // Use RPC to create contact message (validation is done in RPC)
    const { data, error } = await supabase.rpc('create_contact_message', {
      p_name: name?.trim() || '',
      p_email: email?.trim() || '',
      p_message: message?.trim() || '',
      p_phone: sanitizedPhone || null,
      p_subject: subject?.trim() || null,
      p_ip_address: ip !== 'unknown' ? ip : null,
      p_user_agent: userAgent !== 'unknown' ? userAgent : null,
    });

    if (error) {
      console.error('[Contact API] RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to send message. Please try again later.' },
        { status: 500 }
      );
    }

    // Handle RPC response
    const result = data as { success: boolean; message?: string; error?: string; message_id?: string };
    
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || 'Failed to send message' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Thank you! Your message has been sent successfully. We will get back to you within 24 hours.',
    });

  } catch (error) {
    console.error('[Contact API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}

// GET - Removed (use SSR functions for admin portal)
export async function GET() {
  return NextResponse.json(
    { error: 'Please use the admin portal to view messages' },
    { status: 403 }
  );
}
