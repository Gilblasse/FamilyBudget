'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useAILauncher } from './ai-launcher-provider';

export function AILauncherButton() {
  const { status, openAssistant } = useAILauncher();

  if (status === 'unknown') {
    return <Skeleton className="size-9 rounded-full" aria-hidden />;
  }

  if (status !== 'enabled') return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => openAssistant('chat')}
            aria-label="Open AI assistant"
            className="size-9 rounded-full"
          />
        }
      >
        <Sparkles className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        Ask AI · <span className="ml-1 font-mono">⌘J</span>
      </TooltipContent>
    </Tooltip>
  );
}
