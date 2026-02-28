import { getAdminReviewsAdvancedServer, getAllReviewStatsServer, getSSRUserType } from '@/lib/server-queries';
import ReviewsClient from './ReviewsClient';
import type { AdminReviewAdvanced } from '@/lib/portal-queries';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewsPage() {
  // Check SSR authentication first
  const userType = await getSSRUserType();
  
  if (!userType || userType === 'customer') {
    redirect('/portal/login');
  }
  
  // Fetch initial data server-side (hidden from browser Network tab)
  const [reviewsResponse, stats] = await Promise.all([
    getAdminReviewsAdvancedServer({ status: 'all', sortBy: 'recent', limit: 100 }),
    getAllReviewStatsServer(),
  ]);

  // Check if there's an authentication error
  if (reviewsResponse && !reviewsResponse.success && reviewsResponse.error?.includes('Unauthorized')) {
    redirect('/portal/login');
  }

  // Cast server reviews to client type (they have compatible shape)
  return (
    <ReviewsClient
      initialReviews={(reviewsResponse?.reviews ?? []) as unknown as AdminReviewAdvanced[]}
      initialStats={stats as any}
      initialTotalCount={reviewsResponse?.total_count ?? 0}
      initialHasMore={reviewsResponse?.has_more ?? false}
    />
  );
}
