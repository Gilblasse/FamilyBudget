'use client';

import { useEffect, useState } from 'react';

export type AIStatus = 'unknown' | 'enabled' | 'disabled';

export interface AIStatusInfo {
  status: AIStatus;
  reason?: string;
}

let cached: AIStatusInfo = { status: 'unknown' };
let inflight: Promise<AIStatusInfo> | null = null;
const listeners = new Set<(s: AIStatusInfo) => void>();

function emit(next: AIStatusInfo) {
  cached = next;
  for (const l of listeners) l(next);
}

async function fetchStatus(): Promise<AIStatusInfo> {
  if (cached.status !== 'unknown') return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/ai/status', { cache: 'no-store' });
      if (!res.ok) {
        const next: AIStatusInfo = { status: 'disabled', reason: `status ${res.status}` };
        emit(next);
        return next;
      }
      const json = (await res.json()) as { enabled?: boolean; reason?: string };
      const next: AIStatusInfo = json.enabled
        ? { status: 'enabled' }
        : { status: 'disabled', reason: json.reason };
      emit(next);
      return next;
    } catch (err) {
      const next: AIStatusInfo = {
        status: 'disabled',
        reason: err instanceof Error ? err.message : 'network error',
      };
      emit(next);
      return next;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useAIStatus(): AIStatus {
  return useAIStatusInfo().status;
}

export function useAIStatusInfo(): AIStatusInfo {
  const [info, setInfo] = useState<AIStatusInfo>(cached);

  useEffect(() => {
    listeners.add(setInfo);
    if (cached.status === 'unknown') void fetchStatus();
    return () => {
      listeners.delete(setInfo);
    };
  }, []);

  return info;
}
