import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAuthenticatedClient } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { redis, CACHE_KEYS, CACHE_DURATION, getFromCache, setInCache, rateLimiters } from '@/lib/redis';

// Cache key for reviews
const REVIEWS_CACHE_KEY = 'cache:public_reviews';
const REVIEWS_STATS_CACHE_KEY = 'cache:review_stats';

// GET - Fetch public reviews (no auth required, with caching)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewType = searchParams.get('type') || null;
    const itemId = searchParams.get('item_id') || null;
    const mealId = searchParams.get('meal_id') || null;
    const minRating = searchParams.get('min_rating') ? parseInt(searchParams.get('min_rating')!) : null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'recent';
    const noCache = searchParams.get('no_cache') === 'true';

    // Create cache key based on params
    const cacheKey = `${REVIEWS_CACHE_KEY}:${reviewType || 'all'}:${itemId || 'none'}:${mealId || 'none'}:${minRating || 'any'}:${limit}:${offset}:${sort}`;

    // Try to get from cache first (unless explicitly bypassed)
    if (!noCache && redis) {
      const cached = await getFromCache<any>(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached,
          cached: true,
        });
      }
    }

    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_public_reviews', {
      p_review_type: reviewType,
      p_item_id: itemId,
      p_meal_id: mealId,
      p_min_rating: minRating,
      p_limit: limit,
      p_offset: offset,
      p_sort: sort,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Cache the result
    if (redis) {
      await setInCache(cacheKey, data, CACHE_DURATION.MEDIUM); // 5 minutes cache
    }

    return NextResponse.json({
      ...data,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit a new review (auth required, rate limited)
export async function POST(request: NextRequest) {
  try {
    // Get auth token from header or cookie
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : cookieToken;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required. Please login to submit a review.' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    
    // Allow customers and admins to submit reviews
    const allowedUserTypes = ['customer', 'admin'];
    const userType = decoded?.userType || decoded?.type;
    if (!decoded || !allowedUserTypes.includes(userType as string)) {
      return NextResponse.json(
        { error: 'Authentication required. Please login to submit a review.' },
        { status: 401 }
      );
    }

    const customerId = decoded.userId;
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    // Verify customer exists in database
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer profile not found. Please complete your registration.' },
        { status: 403 }
      );
    }

    // Rate limit check using Redis (3 reviews per day)
    if (rateLimiters) {
      const identifier = `review:${customerId}`;
      const { success, remaining, reset } = await rateLimiters.api.limit(identifier);
      
      // Additional daily limit check via database
      const { data: limitCheck } = await supabase.rpc('check_customer_review_limit', {
        p_customer_id: customerId
      });

      if (!limitCheck?.can_review) {
        return NextResponse.json(
          { 
            error: `Daily review limit reached. You can submit up to ${limitCheck?.max_reviews || 3} reviews per day.`,
            reviews_today: limitCheck?.reviews_today,
            max_reviews: limitCheck?.max_reviews,
            remaining: 0
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { rating, comment, review_type, item_id, meal_id, order_id, images } = body;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Comment validation: required but can be short for item/meal ratings
    const effectiveComment = comment?.trim() || `${rating} star rating`;
    if (!effectiveComment || effectiveComment.length < 5) {
      return NextResponse.json(
        { error: 'Comment must be at least 5 characters long' },
        { status: 400 }
      );
    }

    if (effectiveComment.length > 1000) {
      return NextResponse.json(
        { error: 'Comment must be less than 1000 characters' },
        { status: 400 }
      );
    }

    // Determine the correct review_type based on provided IDs
    // The check_review_target constraint requires:
    // - 'item' reviews must have item_id
    // - 'meal' reviews must have meal_id  
    // - 'overall'/'service'/'delivery' reviews should have neither item_id nor meal_id
    let effectiveReviewType = review_type || 'overall';
    let effectiveItemId = item_id || null;
    let effectiveMealId = meal_id || null;

    // If item_id is provided, it must be an 'item' review
    if (effectiveItemId) {
      effectiveReviewType = 'item';
      effectiveMealId = null; // Can't have both
    } 
    // If meal_id is provided, it must be a 'meal' review
    else if (effectiveMealId) {
      effectiveReviewType = 'meal';
      effectiveItemId = null; // Can't have both
    }
    // For overall/service/delivery reviews, ensure no item_id or meal_id
    else {
      effectiveItemId = null;
      effectiveMealId = null;
      // Keep the review_type as provided (overall, service, delivery)
      if (!['overall', 'service', 'delivery'].includes(effectiveReviewType)) {
        effectiveReviewType = 'overall';
      }
    }

    // Submit review via RPC (SECURITY DEFINER function bypasses RLS)
    const { data, error } = await supabase.rpc('submit_customer_review', {
      p_customer_id: customerId,
      p_rating: Number(rating),
      p_comment: effectiveComment,
      p_review_type: effectiveReviewType,
      p_item_id: effectiveItemId,
      p_meal_id: effectiveMealId,
      p_order_id: order_id || null,
      p_images: images || [],
    });

    if (error) {
      return NextResponse.json(
        { error: `Failed to submit review: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || 'Failed to submit review' },
        { status: 400 }
      );
    }

    // Invalidate review cache
    if (redis) {
      const keys = await redis.keys(`${REVIEWS_CACHE_KEY}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.del(REVIEWS_STATS_CACHE_KEY);
    }

    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
      review_id: data.review_id,
      is_verified: data.is_verified,
      reviews_remaining: data.reviews_remaining,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

