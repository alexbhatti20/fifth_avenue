import { getContactMessagesServer, getContactMessageStatsServer } from '@/lib/server-queries';
import MessagesClient from './MessagesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MessagesPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const [messagesResponse, stats] = await Promise.all([
    getContactMessagesServer({ status: 'all', sortBy: 'recent', limit: 100 }),
    getContactMessageStatsServer(),
  ]);

  return (
    <MessagesClient
      initialMessages={messagesResponse?.messages ?? []}
      initialStats={stats}
      initialTotalCount={messagesResponse?.total_count ?? 0}
      initialHasMore={messagesResponse?.has_more ?? false}
    />
  );
}
