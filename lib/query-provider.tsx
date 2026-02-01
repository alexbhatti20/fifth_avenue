'use client';

// =============================================
// REACT QUERY PROVIDER
// Provides request deduplication, caching, and background refetching
// =============================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Create a stable query client configuration
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on window focus (data comes from SSR)
        refetchOnWindowFocus: false,
        // Keep stale data while revalidating
        staleTime: 60 * 1000, // 1 minute
        // Cache data for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
        // Don't refetch on mount if we have data (SSR hydration)
        refetchOnMount: false,
      },
    },
  });
}

// Browser query client singleton
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: reuse the same query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Use useState to ensure the client is only created once
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Export query client for direct access (e.g., cache invalidation)
export { getQueryClient };
