'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { STORE_VERSION, useBudget } from '@/lib/store';
import { getEnvelope, type RemoteEnvelope } from './api-client';
import { qk } from './query-keys';
import { installRemoteActions } from './install-remote-actions';

export type BridgeStatus = 'idle' | 'first-load-empty' | 'loaded' | 'error';

/**
 * Subscribes to the envelope query, projects the server snapshot into
 * `useBudget`, and installs the remote-aware action wrappers exactly
 * once. Components keep using `useBudget((s) => s.field)` selectors;
 * the bridge keeps that local cache pointed at the server's truth.
 */
export function useRemoteStoreBridge(): { status: BridgeStatus; envelope: RemoteEnvelope | undefined } {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.envelope(),
    queryFn: getEnvelope,
    staleTime: 30_000,
  });

  // Install the action swap exactly once per page load. The store-side
  // sentinel `__remoteWiringInstalled` makes this idempotent across
  // React Fast Refresh.
  useEffect(() => {
    installRemoteActions(queryClient);
  }, [queryClient]);

  // Project successful query results into the Zustand store. No setState
  // happens in this effect — the only sink is the external Zustand
  // store, which is the legitimate "synchronize external state" use
  // case for useEffect.
  useEffect(() => {
    if (!query.isSuccess) return;
    const envelope = query.data;
    if (!envelope || !envelope.data) return;
    if (envelope.version !== null && envelope.version > STORE_VERSION) {
      console.warn(
        `[remote-primary] server version ${envelope.version} > local ${STORE_VERSION}; staying on local cache`,
      );
      return;
    }
    useBudget.setState((prev) => ({ ...prev, ...envelope.data }), false);
  }, [query.data, query.isSuccess]);

  // Derive status purely from query state; no setState-in-effect needed.
  const status: BridgeStatus = useMemo(() => {
    if (query.isError) return 'error';
    if (!query.isSuccess) return 'idle';
    const envelope = query.data;
    if (!envelope || !envelope.data) return 'first-load-empty';
    if (envelope.version !== null && envelope.version > STORE_VERSION) return 'error';
    return 'loaded';
  }, [query.data, query.isError, query.isSuccess]);

  return { status, envelope: query.data };
}
