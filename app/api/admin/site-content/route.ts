import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

// GET /api/admin/site-content - Get all site content
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase.rpc('get_all_site_content');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch site content' }, { status: 500 });
  }
}

// PUT /api/admin/site-content - Update site content
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { section, content, is_active } = await request.json();

    const { data, error } = await supabase.rpc('update_site_content_section', {
      p_section: section,
      p_content: content,
      p_is_active: is_active !== undefined ? is_active : true,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update site content' }, { status: 500 });
  }
}

