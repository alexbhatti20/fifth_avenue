import { NextRequest, NextResponse } from 'next/server';
import { invalidateMenuCache, invalidateDealsCache } from '@/lib/cache';

// POST /api/admin/invalidate-cache - Invalidate specific caches
export async function POST(request: NextRequest) {
  try {
    const { type, categoryId } = await request.json();

    switch (type) {
      case 'menu':
        await invalidateMenuCache(categoryId);
        break;
      case 'deals':
        await invalidateDealsCache();
        break;
      case 'all':
        await invalidateMenuCache();
        await invalidateDealsCache();
        break;
      default:
        await invalidateMenuCache();
    }

    return NextResponse.json({ success: true, message: `${type || 'menu'} cache invalidated` });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
  }
}

