import { getAdminReviewsAdvancedServer, getAllReviewStatsServer } from '@/lib/server-queries';
import ReviewsClient from './ReviewsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewsPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const [reviewsResponse, stats] = await Promise.all([
    getAdminReviewsAdvancedServer({ status: 'all', sortBy: 'recent', limit: 100 }),
    getAllReviewStatsServer(),
  ]);

  return (
    <ReviewsClient
      initialReviews={reviewsResponse?.reviews ?? []}
      initialStats={stats}
      initialTotalCount={reviewsResponse?.total_count ?? 0}
      initialHasMore={reviewsResponse?.has_more ?? false}
    />
  );
}
