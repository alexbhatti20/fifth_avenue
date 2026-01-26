import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  getCached, 
  setCache, 
  CACHE_KEYS, 
  CACHE_DURATIONS 
} from '@/lib/cache';

// =============================================
// Customer Payment Methods API
// Fetches active payment methods for checkout with caching
// =============================================

interface PaymentMethod {
  id: string;
  method_type: 'jazzcash' | 'easypaisa' | 'bank';
  method_name: string;
  account_number: string;
  account_holder_name: string;
  bank_name: string | null;
  display_order: number;
}

interface CachedPaymentMethods {
  methods: PaymentMethod[];
  timestamp: number;
}

// GET /api/customer/payment-methods - Get active payment methods with caching
export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = CACHE_KEYS.paymentMethods();
    const cached = await getCached<CachedPaymentMethods>(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        success: true,
        methods: cached.methods,
        cached: true,
        cachedAt: new Date(cached.timestamp).toISOString(),
      }, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        }
      });
    }

    // Fetch from RPC
    const { data, error } = await supabase.rpc('get_active_payment_methods');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payment methods' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Unknown error' },
        { status: 500 }
      );
    }

    // Prepare cache data
    const cacheData: CachedPaymentMethods = {
      methods: data.methods || [],
      timestamp: Date.now(),
    };

    // Store in cache
    await setCache(cacheKey, cacheData, CACHE_DURATIONS.PAYMENT_METHODS);

    return NextResponse.json({
      success: true,
      methods: data.methods || [],
      cached: false,
    }, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

