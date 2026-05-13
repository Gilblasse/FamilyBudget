'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import {
  Check,
  ClipboardPaste,
  Loader2,
  MessageSquare,
  Send,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAIStatus } from '@/lib/ai/enabled';
import { useBudget } from '@/lib/store';
import { fmt, fd } from '@/lib/format';
import {
  ACTION_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type BillAction,
  type IncomeStatus,
  type Priority,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import type { BudgetToolName } from '@/lib/ai/tools';
import { AdvisorPanel } from './advisor-panel';
import { AiExtractPanel } from './ai-extract-panel';

export type AssistantView = 'chat' | 'suggestions' | 'extract';

interface AiChatSheetProps {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialView?: AssistantView;
}

type ToolPart = {
  type: `tool-${BudgetToolName}`;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: unknown;
  output?: { applied: boolean; summary?: string };
  errorText?: string;
};

function getSnapshot() {
  const { balance, income, bills, paid, periods, activePeriodId, dateRange } =
    useBudget.getState();
  return { balance, income, bills, paid, periods, activePeriodId, dateRange };
}

export function AiChatSheet(props: AiChatSheetProps = {}) {
  const status = useAIStatus();
  if (status !== 'enabled') return null;
  return <AiChatSheetInner {...props} />;
}

function AiChatSheetInner({
  trigger,
  open: controlledOpen,
  onOpenChange,
  initialView = 'chat',
}: AiChatSheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const [view, setView] = useState<AssistantView>(initialView);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setView(initialView);
  }

  const [draft, setDraft] = useState('');

  const { messages, sendMessage, addToolOutput, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      body: () => ({ snapshot: getSnapshot() }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => {
      toast.error('Chat error', { description: err.message });
    },
  });

  function describeProposal(tool: BudgetToolName, input: unknown): string {
    const i = input as Record<string, unknown>;
    const bills = useBudget.getState().bills;
    const income = useBudget.getState().income;
    switch (tool) {
      case 'addBill':
        return `Add bill "${i.name}" — ${fmt(Number(i.amount) || 0)} due ${fd(String(i.date))} · ${PRIORITY_LABEL[i.priority as Priority] ?? i.priority} · ${ACTION_LABEL[i.action as BillAction] ?? i.action}`;
      case 'addIncome':
        return `Add income "${i.source}" — ${fmt(Number(i.amount) || 0)} on ${fd(String(i.date))} · ${STATUS_LABEL[i.status as IncomeStatus] ?? i.status}`;
      case 'updateBill': {
        const target = bills.find((b) => b.id === i.id)?.name ?? i.id;
        const patch = i.patch as Record<string, unknown>;
        const changes = Object.entries(patch).map(([k, v]) => `${k}=${String(v)}`).join(', ');
        return `Update bill "${target}" — ${changes}`;
      }
      case 'updateIncome': {
        const target = income.find((r) => r.id === i.id)?.source ?? i.id;
        const patch = i.patch as Record<string, unknown>;
        const changes = Object.entries(patch).map(([k, v]) => `${k}=${String(v)}`).join(', ');
        return `Update income "${target}" — ${changes}`;
      }
      case 'removeBill': {
        const target = bills.find((b) => b.id === i.id)?.name ?? i.id;
        return `Remove bill "${target}"`;
      }
      case 'removeIncome': {
        const target = income.find((r) => r.id === i.id)?.source ?? i.id;
        return `Remove income "${target}"`;
      }
      case 'togglePaid': {
        if (i.kind === 'bill') {
          const target = bills.find((b) => b.id === i.id)?.name ?? i.id;
          return `Toggle paid for bill "${target}"`;
        }
        const target = income.find((r) => r.id === i.id)?.source ?? i.id;
        return `Toggle received for income "${target}"`;
      }
      case 'setBalance':
        return `Set balance to ${fmt(Number(i.amount) || 0)}`;
      case 'switchPeriod':
        return `Switch active period to ${i.periodId}`;
    }
  }

  function applyTool(tool: BudgetToolName, input: unknown): string {
    const store = useBudget.getState();
    const i = input as Record<string, unknown>;
    switch (tool) {
      case 'addBill': {
        store.addBill();
        const newBill = useBudget.getState().bills.at(-1);
        if (!newBill) return 'failed: could not create bill';
        store.updateBill(newBill.id, {
          name: String(i.name),
          date: String(i.date),
          amount: Number(i.amount) || 0,
          priority: i.priority as Priority,
          action: i.action as BillAction,
        });
        return `Added bill "${i.name}"`;
      }
      case 'addIncome': {
        store.addIncome();
        const newIncome = useBudget.getState().income.at(-1);
        if (!newIncome) return 'failed: could not create income';
        store.updateIncome(newIncome.id, {
          source: String(i.source),
          date: String(i.date),
          amount: Number(i.amount) || 0,
          status: i.status as IncomeStatus,
        });
        return `Added income "${i.source}"`;
      }
      case 'updateBill':
        store.updateBill(String(i.id), i.patch as Record<string, unknown>);
        return 'Bill updated';
      case 'updateIncome':
        store.updateIncome(String(i.id), i.patch as Record<string, unknown>);
        return 'Income updated';
      case 'removeBill':
        store.removeBill(String(i.id));
        return 'Bill removed';
      case 'removeIncome':
        store.removeIncome(String(i.id));
        return 'Income removed';
      case 'togglePaid': {
        const prefix = i.kind === 'bill' ? 'bill_' : 'inc_';
        store.togglePaid(`${prefix}${i.id}`);
        return 'Paid toggle flipped';
      }
      case 'setBalance':
        store.setBalance(Number(i.amount) || 0);
        return `Balance set to ${fmt(Number(i.amount) || 0)}`;
      case 'switchPeriod':
        store.setActivePeriod(String(i.periodId));
        return 'Active period switched';
    }
  }

  function onApply(toolName: BudgetToolName, toolCallId: string, input: unknown) {
    const summary = applyTool(toolName, input);
    addToolOutput({
      tool: toolName,
      toolCallId,
      output: { applied: true, summary },
    });
  }

  function onDiscard(toolName: BudgetToolName, toolCallId: string) {
    addToolOutput({
      tool: toolName,
      toolCallId,
      output: { applied: false, summary: 'user declined' },
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || status === 'streaming' || status === 'submitted') return;
    sendMessage({ text: draft });
    setDraft('');
  }

  const tabOrder: AssistantView[] = ['chat', 'suggestions', 'extract'];

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const current = tabOrder.indexOf(view);
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % tabOrder.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabOrder.length) % tabOrder.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabOrder.length - 1;
    setView(tabOrder[next]);
    const id = `assistant-tab-${tabOrder[next]}`;
    const el = document.getElementById(id);
    if (el) el.focus();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger render={trigger} />
      ) : !isControlled ? (
        <SheetTrigger render={<Button variant="outline" size="sm" className="h-10 sm:h-9" />}>
          <MessageSquare className="h-4 w-4" /> Assistant
        </SheetTrigger>
      ) : null}
      <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>Assistant</SheetTitle>
            <SheetDescription>
              Chat to propose changes, browse read-only Suggestions, or paste text
              to extract bills and income. Every change requires your approval
              before it takes effect.
            </SheetDescription>
            <div
              role="tablist"
              aria-label="Assistant view"
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted p-1 text-xs"
            >
              <button
                type="button"
                role="tab"
                id="assistant-tab-chat"
                aria-selected={view === 'chat'}
                aria-controls="assistant-panel-chat"
                tabIndex={view === 'chat' ? 0 : -1}
                onClick={() => setView('chat')}
                onKeyDown={onTabKeyDown}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors',
                  view === 'chat'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat
              </button>
              <button
                type="button"
                role="tab"
                id="assistant-tab-suggestions"
                aria-selected={view === 'suggestions'}
                aria-controls="assistant-panel-suggestions"
                tabIndex={view === 'suggestions' ? 0 : -1}
                onClick={() => setView('suggestions')}
                onKeyDown={onTabKeyDown}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors',
                  view === 'suggestions'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Wand2 className="h-3.5 w-3.5" /> Suggestions
              </button>
              <button
                type="button"
                role="tab"
                id="assistant-tab-extract"
                aria-selected={view === 'extract'}
                aria-controls="assistant-panel-extract"
                tabIndex={view === 'extract' ? 0 : -1}
                onClick={() => setView('extract')}
                onKeyDown={onTabKeyDown}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors',
                  view === 'extract'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Extract from text
              </button>
            </div>
          </SheetHeader>

          {view === 'chat' && (
            <div
              role="tabpanel"
              id="assistant-panel-chat"
              aria-labelledby="assistant-tab-chat"
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
                {messages.length === 0 && (
                  <div className="space-y-2 text-muted-foreground">
                    <p>Try asking:</p>
                    <ul className="list-inside list-disc space-y-0.5 text-xs">
                      <li>What is my net position this period?</li>
                      <li>Add a $50 gym bill due next Friday, mark it flexible.</li>
                      <li>Which bills are due before my next paycheck?</li>
                    </ul>
                  </div>
                )}

                {messages.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {m.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    {m.parts.map((part, idx) => {
                      if (part.type === 'text') {
                        return (
                          <div key={idx} className="whitespace-pre-wrap">
                            {part.text}
                          </div>
                        );
                      }
                      if (part.type === 'reasoning') {
                        return null;
                      }
                      if (part.type.startsWith('tool-')) {
                        const tp = part as ToolPart;
                        const toolName = tp.type.slice('tool-'.length) as BudgetToolName;
                        return (
                          <ToolCallCard
                            key={tp.toolCallId}
                            toolName={toolName}
                            part={tp}
                            describe={describeProposal}
                            onApply={onApply}
                            onDiscard={onDiscard}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                ))}

                {(status === 'submitted' || status === 'streaming') && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                  </div>
                )}
              </div>

              <form
                onSubmit={onSubmit}
                className="flex items-center gap-2 border-t px-4 py-3"
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask or propose a change…"
                  autoComplete="off"
                  disabled={status === 'streaming' || status === 'submitted'}
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send"
                  disabled={!draft.trim() || status === 'streaming' || status === 'submitted'}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}

          {view === 'suggestions' && (
            <div
              role="tabpanel"
              id="assistant-panel-suggestions"
              aria-labelledby="assistant-tab-suggestions"
              className="flex flex-1 flex-col overflow-hidden"
            >
              <AdvisorPanel />
            </div>
          )}

          {view === 'extract' && (
            <div
              role="tabpanel"
              id="assistant-panel-extract"
              aria-labelledby="assistant-tab-extract"
              className="flex-1 overflow-y-auto px-4 py-4"
            >
              <AiExtractPanel />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToolCallCard({
  toolName,
  part,
  describe,
  onApply,
  onDiscard,
}: {
  toolName: BudgetToolName;
  part: ToolPart;
  describe: (t: BudgetToolName, input: unknown) => string;
  onApply: (t: BudgetToolName, id: string, input: unknown) => void;
  onDiscard: (t: BudgetToolName, id: string) => void;
}) {
  if (part.state === 'input-streaming') {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Drafting proposal…
      </div>
    );
  }
  if (part.state === 'input-available') {
    return (
      <div className="space-y-2 rounded-md border bg-card px-3 py-2">
        <div className="text-xs font-medium">Proposed change</div>
        <div className="text-sm">{describe(toolName, part.input)}</div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDiscard(toolName, part.toolCallId)}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onApply(toolName, part.toolCallId, part.input)}
          >
            Apply
          </Button>
        </div>
      </div>
    );
  }
  if (part.state === 'output-available') {
    const applied = part.output?.applied;
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
          applied
            ? 'border-income bg-income-soft text-income'
            : 'border-muted-foreground/20 bg-muted/40 text-muted-foreground',
        )}
      >
        {applied ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {part.output?.summary ?? (applied ? 'Applied' : 'Discarded')}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-expense bg-expense-soft px-3 py-2 text-xs text-expense">
      Error: {part.errorText ?? 'unknown'}
    </div>
  );
}
