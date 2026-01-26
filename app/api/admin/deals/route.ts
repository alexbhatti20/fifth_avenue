import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { invalidateDealsCache } from '@/lib/cache';

// GET /api/admin/deals - Get all deals
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}

// POST /api/admin/deals - Create deal
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      description,
      original_price,
      discounted_price,
      items,
      valid_from,
      valid_until,
      image_url,
    } = await request.json();

    const { data, error } = await supabase.rpc('create_deal', {
      p_name: name,
      p_description: description,
      p_original_price: original_price,
      p_discounted_price: discounted_price,
      p_items: items,
      p_valid_from: valid_from,
      p_valid_until: valid_until,
      p_image_url: image_url,
    });

    if (error) throw error;

    await invalidateDealsCache();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}

// PUT /api/admin/deals - Update deal
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, description, is_active, image_url } = await request.json();

    const { data, error } = await supabase.rpc('update_deal', {
      p_deal_id: id,
      p_name: name,
      p_description: description,
      p_is_active: is_active,
      p_image_url: image_url,
    });

    if (error) throw error;

    await invalidateDealsCache();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}

// DELETE /api/admin/deals - Delete deal
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Deal ID required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('delete_deal', {
      p_deal_id: id,
    });

    if (error) throw error;

    await invalidateDealsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
  }
}

