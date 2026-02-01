import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// POST /api/favorites/clear - Clear all favorites
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use verifyToken to properly decode the token
    const decoded = await verifyToken(token);
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerId = decoded.userId;
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    const { error } = await supabase.rpc("clear_all_favorites", {
      p_customer_id: customerId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, error: null });
  } catch (error) {
    return NextResponse.json({ error: "Failed to clear favorites" }, { status: 500 });
  }
}
