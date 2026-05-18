'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { useAIStatus } from '@/lib/ai/enabled';
import type { AssistantView } from './ai-chat-sheet';

// Lazy-load the chat sheet so `@ai-sdk/openai`, `@ai-sdk/react`, and `ai`
// only land in the bundle once AI is actually used. The sheet renders
// nothing on mount until `open` flips true, so first-load cost is paid
// at the moment of interaction, not at app start.
const AiChatSheet = dynamic(
  () => import('./ai-chat-sheet').then((m) => ({ default: m.AiChatSheet })),
  { ssr: false },
);

interface AILauncherContextValue {
  status: ReturnType<typeof useAIStatus>;
  openAssistant: (view?: AssistantView) => void;
}

const AILauncherContext = createContext<AILauncherContextValue | null>(null);

export function useAILauncher(): AILauncherContextValue {
  const ctx = useContext(AILauncherContext);
  if (!ctx) {
    throw new Error('useAILauncher must be used inside <AILauncherProvider>');
  }
  return ctx;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function AILauncherProvider({ children }: { children: ReactNode }) {
  const status = useAIStatus();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInitialView, setAssistantInitialView] = useState<AssistantView>('chat');

  const openAssistant = useCallback(
    (view: AssistantView = 'chat') => {
      if (status !== 'enabled') {
        toast.message('AI assistant is disabled', {
          description: 'Configure an API key in Settings to enable the assistant.',
        });
        return;
      }
      setAssistantInitialView(view);
      setAssistantOpen(true);
    },
    [status],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const match =
        e.key.toLowerCase() === 'j' &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey;
      if (!match) return;
      if (isEditableTarget(e.target)) return;
      if (status !== 'enabled') return;
      e.preventDefault();
      setAssistantInitialView('chat');
      setAssistantOpen((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status]);

  const value = useMemo<AILauncherContextValue>(
    () => ({ status, openAssistant }),
    [status, openAssistant],
  );

  return (
    <AILauncherContext.Provider value={value}>
      {children}
      {status === 'enabled' ? (
        <AiChatSheet
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          initialView={assistantInitialView}
        />
      ) : null}
    </AILauncherContext.Provider>
  );
}
