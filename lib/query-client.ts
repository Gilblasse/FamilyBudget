'use client';

import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient factory. Per the TanStack docs, server components get a
 * fresh client per request; the browser holds a long-lived singleton.
 * The module-level cache below preserves the singleton across React
 * Fast Refresh in dev without leaking between requests on the server.
 */
let browserClient: QueryClient | undefined;

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Mutations do not auto-retry. The optimistic update + rollback
        // path is the retry; auto-retry would compound rollback flicker.
        retry: 0,
      },
    },
  });
}

export function makeQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always a fresh client so per-request state never leaks.
    return buildClient();
  }
  if (!browserClient) browserClient = buildClient();
  return browserClient;
}
