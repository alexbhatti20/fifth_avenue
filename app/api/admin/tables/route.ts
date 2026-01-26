import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

// GET /api/admin/tables - Get all tables
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase.rpc('get_all_tables');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}

// POST /api/admin/tables - Create table
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { table_number, capacity } = await request.json();

    const { data, error } = await supabase.rpc('create_table', {
      p_table_number: table_number,
      p_capacity: capacity,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
  }
}

// PUT /api/admin/tables/assign - Assign table to order
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id, table_id } = await request.json();

    const { data, error } = await supabase.rpc('assign_table_to_order', {
      p_order_id: order_id,
      p_table_id: table_id,
    });

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Table not available' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to assign table' }, { status: 500 });
  }
}

// DELETE /api/admin/tables/release - Release table
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const table_id = searchParams.get('table_id');

    if (!table_id) {
      return NextResponse.json({ error: 'Table ID required' }, { status: 400 });
    }

    const { error } = await supabase.rpc('release_table', {
      p_table_id: table_id,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to release table' }, { status: 500 });
  }
}

