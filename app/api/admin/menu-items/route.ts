import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { invalidateMenuCache } from '@/lib/cache';

// GET /api/admin/menu-items - Get all menu items
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*, menu_categories(name, slug)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get menu items error:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

// POST /api/admin/menu-items - Create menu item
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { category_id, name, description, price, images } = await request.json();

    const { data, error } = await supabase.rpc('create_menu_item', {
      p_category_id: category_id,
      p_name: name,
      p_description: description,
      p_price: price,
      p_images: images || [],
    });

    if (error) throw error;

    await invalidateMenuCache(category_id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Create menu item error:', error);
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
  }
}

// PUT /api/admin/menu-items - Update menu item
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, description, price, images, is_available } = await request.json();

    const { data, error } = await supabase.rpc('update_menu_item', {
      p_item_id: id,
      p_name: name,
      p_description: description,
      p_price: price,
      p_images: images,
      p_is_available: is_available,
    });

    if (error) throw error;

    await invalidateMenuCache();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update menu item error:', error);
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 });
  }
}

// DELETE /api/admin/menu-items - Delete menu item
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('delete_menu_item', {
      p_item_id: id,
    });

    if (error) throw error;

    // Delete images from storage
    if (data?.images && Array.isArray(data.images)) {
      for (const imageUrl of data.images) {
        try {
          // Extract path from URL: https://...storage.../images/menu/filename.jpg
          const urlParts = imageUrl.split('/images/');
          if (urlParts.length === 2) {
            await supabase.storage.from('images').remove([urlParts[1]]);
          }
        } catch (imgError) {
          console.error('Failed to delete image:', imgError);
          // Continue even if image deletion fails
        }
      }
    }

    await invalidateMenuCache();

    return NextResponse.json({ success: true, deletedImages: data?.images || [] });
  } catch (error) {
    console.error('Delete menu item error:', error);
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 });
  }
}
