'use client';

import type { ReactNode } from 'react';
import { useAILauncher } from './ai-launcher-provider';

interface AiBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders `children` only when the AI subsystem is enabled (OpenAI key
 * present + reachable). When disabled, renders `fallback` (default: null).
 *
 * Centralizes the "is AI on?" check so call sites don't repeat the
 * `useAILauncher().status === 'enabled'` boilerplate.
 */
export function AiBoundary({ children, fallback = null }: AiBoundaryProps) {
  const { status } = useAILauncher();
  if (status !== 'enabled') return <>{fallback}</>;
  return <>{children}</>;
}
