'use client';

import { BookOpen, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAILauncher } from '@/components/budget/ai/ai-launcher-provider';

export function HelpCenterView() {
  const { openAssistant } = useAILauncher();
  return (
    <Card>
      <CardContent className="py-4">
        <EmptyState
          icon={BookOpen}
          title="Help docs coming soon"
          description="In the meantime, the AI assistant can answer most usage questions about your budget. For bug reports or feature requests, open an issue on GitHub."
          cta={
            <Button type="button" onClick={() => openAssistant('chat')}>
              <MessageCircle className="size-4" /> Ask the assistant
            </Button>
          }
          secondary={
            <Button
              variant="ghost"
              render={
                <a
                  href="https://github.com/Gilblasse/family-budget/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Open an issue
            </Button>
          }
          size="lg"
        />
      </CardContent>
    </Card>
  );
}
