import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// This API route proxies favorite requests - hides Supabase calls from browser
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

    // Get favorite IDs
    const { data, error } = await supabase.rpc("get_favorite_ids", {
      p_customer_id: customerId,
    });

    if (error) {
      return NextResponse.json({ data: [], error: error.message });
    }

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    return NextResponse.json({ data: [], error: "Failed to fetch favorites" });
  }
}

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

    const body = await request.json();
    const { itemId, itemType } = body;

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Toggle favorite
    const { data, error } = await supabase.rpc("toggle_favorite", {
      p_customer_id: customerId,
      p_item_id: itemId,
      p_item_type: itemType || "menu_item",
    });

    if (error) {
      console.error("Toggle favorite error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("Favorites POST error:", error);
    return NextResponse.json({ error: "Failed to toggle favorite" }, { status: 500 });
  }
}
