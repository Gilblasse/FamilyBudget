'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = makeQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
