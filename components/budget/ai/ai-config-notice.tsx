'use client';

import { AlertTriangle } from 'lucide-react';
import { useAIStatusInfo } from '@/lib/ai/enabled';

export function AiConfigNotice() {
  const { status, reason } = useAIStatusInfo();
  if (status !== 'disabled' || !reason) return null;
  if (reason === 'AI_GATEWAY_API_KEY not set') return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      AI off: {reason}
    </div>
  );
}
