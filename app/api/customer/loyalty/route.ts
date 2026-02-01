import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, supabase as anonSupabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// Helper to get authenticated customer and token
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return { customer: null, token: null };

  // Use verifyToken to properly decode the token
  const decoded = await verifyToken(token);
  if (!decoded || decoded.userType !== 'customer') return { customer: null, token: null };

  return { customer: { id: decoded.userId }, token };
}

// GET /api/customer/loyalty - Get loyalty balance, promo codes, and history
export async function GET(request: NextRequest) {
  try {
    const { customer, token } = await getAuthenticatedCustomer();
    if (!customer || !token) {
      return NextResponse.json({ 
        loyalty: null, 
        promoCodes: [], 
        pointsHistory: [],
        error: null 
      });
    }
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    // Fetch all loyalty data in parallel
    const [balanceResult, promosResult, historyResult] = await Promise.all([
      supabase.rpc('get_loyalty_balance', { p_customer_id: customer.id }),
      supabase.rpc('get_customer_promo_codes', { p_customer_id: customer.id }),
      supabase
        .from('loyalty_points')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const balanceData = balanceResult.data?.[0];
    const totalPoints = balanceData?.total_points || 0;

    let tier: "bronze" | "silver" | "gold" | "platinum" = "bronze";
    let pointsToNext = 500 - totalPoints;

    if (totalPoints >= 3000) {
      tier = "platinum";
      pointsToNext = 0;
    } else if (totalPoints >= 1500) {
      tier = "gold";
      pointsToNext = 3000 - totalPoints;
    } else if (totalPoints >= 500) {
      tier = "silver";
      pointsToNext = 1500 - totalPoints;
    }

    return NextResponse.json({
      loyalty: {
        total_points: totalPoints,
        tier,
        points_to_next_tier: Math.max(0, pointsToNext),
      },
      promoCodes: promosResult.data || [],
      pointsHistory: historyResult.data || [],
      error: null,
    });
  } catch (error) {
    return NextResponse.json({ 
      loyalty: null, 
      promoCodes: [], 
      pointsHistory: [],
      error: "Failed to fetch loyalty data" 
    });
  }
}

// POST /api/customer/loyalty - Check promo code
export async function POST(request: NextRequest) {
  try {
    const { customer, token } = await getAuthenticatedCustomer();
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Promo code required" }, { status: 400 });
    }
    
    // Use authenticated client if user is logged in, otherwise use anon for public promo check
    const supabase = token ? createAuthenticatedClient(token) : anonSupabase;

    const { data, error } = await supabase.rpc('check_promo_code_details', {
      p_code: code.toUpperCase(),
      p_customer_id: customer?.id || null,
    });

    if (error) {
      return NextResponse.json({ data: null, error: error.message });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: "Failed to check promo code" });
  }
}
