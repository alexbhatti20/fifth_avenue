import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { invalidateMenuCache } from '@/lib/cache';

// GET /api/admin/categories - Get all categories
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST /api/admin/categories - Create category
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, slug, description, image_url, display_order } = await request.json();

    const { data, error } = await supabase.rpc('create_menu_category', {
      p_name: name,
      p_slug: slug,
      p_description: description,
      p_image_url: image_url,
      p_display_order: display_order || 0,
    });

    if (error) throw error;

    await invalidateMenuCache();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// PUT /api/admin/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, description, image_url, display_order, is_visible } = await request.json();

    const { data, error } = await supabase.rpc('update_menu_category', {
      p_category_id: id,
      p_name: name,
      p_description: description,
      p_image_url: image_url,
      p_display_order: display_order,
      p_is_visible: is_visible,
    });

    if (error) throw error;

    await invalidateMenuCache();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/admin/categories - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('delete_menu_category', {
      p_category_id: id,
    });

    if (error) throw error;

    await invalidateMenuCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}

