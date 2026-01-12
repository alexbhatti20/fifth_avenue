import { NextRequest, NextResponse } from 'next/server';
import { redis, rateLimiters } from '@/lib/redis';

// Contact message interface
interface ContactMessage {
  name: string;
  email: string;
  phone?: string;
  message: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

// Rate limit key for contact form
const CONTACT_RATE_KEY = (ip: string) => `rate:contact:${ip}`;
const CONTACT_MESSAGES_KEY = 'contact:messages';

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Rate limiting: max 3 messages per hour per IP
    if (redis && rateLimiters) {
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
    const { name, email, phone, message } = body;

    // Validation
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide your name (at least 2 characters)' },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (!message || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a message (at least 10 characters)' },
        { status: 400 }
      );
    }

    if (message.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Message is too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Sanitize phone number if provided
    let sanitizedPhone = '';
    if (phone) {
      sanitizedPhone = phone.replace(/[^\d+\-\s()]/g, '').slice(0, 20);
    }

    // Create contact message object
    const contactMessage: ContactMessage = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: sanitizedPhone || undefined,
      message: message.trim(),
      ip,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    // Store in Redis if available (for admin dashboard later)
    if (redis) {
      await redis.lpush(CONTACT_MESSAGES_KEY, JSON.stringify(contactMessage));
      // Keep only last 1000 messages
      await redis.ltrim(CONTACT_MESSAGES_KEY, 0, 999);
    }

    // TODO: Send email notification to admin
    // await sendContactEmail(contactMessage);

    // Log for now
    console.log('[Contact Form] New message received:', {
      name: contactMessage.name,
      email: contactMessage.email,
      messagePreview: contactMessage.message.substring(0, 50) + '...',
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your message has been sent successfully. We will get back to you within 24 hours.',
    });

  } catch (error) {
    console.error('[Contact API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}

// GET - Retrieve contact messages (admin only)
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    
    if (!redis) {
      return NextResponse.json({ messages: [] });
    }

    const messages = await redis.lrange(CONTACT_MESSAGES_KEY, 0, 49);
    const parsedMessages = messages.map((m: string) => JSON.parse(m));

    return NextResponse.json({
      messages: parsedMessages,
      total: parsedMessages.length,
    });
  } catch (error) {
    console.error('[Contact API] Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
