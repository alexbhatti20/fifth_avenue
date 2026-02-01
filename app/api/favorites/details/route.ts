import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// This API route proxies favorite details requests - hides Supabase calls from browser
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ data: [], error: null });
    }

    // Use verifyToken to properly decode the token
    const decoded = await verifyToken(token);
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ data: [], error: null });
    }

    const customerId = decoded.userId;
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    // Get full favorite details
    const { data, error } = await supabase.rpc("get_customer_favorites", {
      p_customer_id: customerId,
    });

    if (error) {
      return NextResponse.json({ data: [], error: error.message });
    }

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    return NextResponse.json({ data: [], error: "Failed to fetch favorite details" });
  }
}
