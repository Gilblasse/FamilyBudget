'use client';

import { useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAIStatus } from '@/lib/ai/enabled';
import { AiExtractPanel } from './ai-extract-panel';

interface AiExtractDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AiExtractDialog({
  open: controlledOpen,
  onOpenChange,
}: AiExtractDialogProps = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const status = useAIStatus();
  if (status !== 'enabled') return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger
          render={<Button variant="outline" size="sm" className="h-10 sm:h-9" />}
        >
          <ClipboardPaste className="h-4 w-4" /> Paste to extract
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste to extract</DialogTitle>
          <DialogDescription>
            Paste an email, statement, or freeform text. The assistant returns rows
            you can review and selectively apply. Budget data stays local; only the
            pasted text is sent to your AI provider.
          </DialogDescription>
        </DialogHeader>

        <AiExtractPanel
          onCancel={() => setOpen(false)}
          onApplied={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
