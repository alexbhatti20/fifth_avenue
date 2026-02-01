import { NextRequest, NextResponse } from 'next/server';
import { invalidateMenuCache, invalidateDealsCache } from '@/lib/cache';
import { revalidatePath, revalidateTag } from 'next/cache';

// POST /api/admin/invalidate-cache - Invalidate specific caches
// This is an internal endpoint for cache management - low risk operation
export async function POST(request: NextRequest) {
  try {
    // Basic security: Check referer to ensure it's from our portal
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';
    const host = request.headers.get('host') || '';
    
    // Allow if request is from same origin (portal pages)
    const isInternalRequest = 
      referer.includes('/portal/') || 
      referer.includes(host) ||
      origin.includes(host) ||
      !referer; // Allow if no referer (same-origin requests)

    if (!isInternalRequest) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { type, categoryId } = await request.json();

    switch (type) {
      case 'menu':
        await invalidateMenuCache(categoryId);
        // Revalidate Next.js cache for menu pages
        revalidateTag('menu', {});
        revalidatePath('/menu');
        revalidatePath('/portal/menu');
        break;
      case 'deals':
        await invalidateDealsCache();
        // Revalidate Next.js cache for deals
        revalidateTag('deals', {});
        revalidatePath('/menu');
        revalidatePath('/');
        break;
      case 'all':
        await invalidateMenuCache();
        await invalidateDealsCache();
        revalidateTag('menu', {});
        revalidateTag('deals', {});
        revalidatePath('/menu');
        revalidatePath('/');
        break;
      default:
        await invalidateMenuCache();
        revalidateTag('menu', {});
        revalidatePath('/menu');
    }

    return NextResponse.json({ success: true, message: `${type || 'menu'} cache invalidated` });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
  }
}

