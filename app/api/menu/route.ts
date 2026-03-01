import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

async function getAuthenticatedClient(request?: NextRequest) {
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) return createAuthenticatedClient(token);
    }
  }
  
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value || cookieStore.get('auth_token')?.value;
  
  if (!accessToken) {
    return null;
  }
  
  return createAuthenticatedClient(accessToken);
}

// GET - Get menu items and deals for offer form
export async function GET(request: NextRequest) {
  try {
    const client = await getAuthenticatedClient(request);
    
    if (!client) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Fetch menu items and deals in parallel using direct queries
    const [itemsResult, dealsResult] = await Promise.all([
      client
        .from('menu_items')
        .select('id, name, price, images, is_available, category_id')
        .eq('is_available', true)
        .order('name'),
      client
        .from('deals')
        .select('id, name, discounted_price, images, image_url, is_active')
        .eq('is_active', true)
        .order('name'),
    ]);
    
    if (itemsResult.error) {
      return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });
    }
    
    // Transform deals to have consistent image field
    const dealsWithImage = (dealsResult.data || []).map((deal: any) => ({
      ...deal,
      price: deal.discounted_price,
      image: deal.image_url || (deal.images?.[0]) || null,
    }));
    
    return NextResponse.json({
      items: itemsResult.data || [],
      deals: dealsWithImage,
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
