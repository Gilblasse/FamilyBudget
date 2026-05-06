import { NextResponse } from 'next/server';
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from 'ai';
import { z } from 'zod';
import { SMART_MODEL, describeAiError, hasOpenAIKey } from '@/lib/ai/client';
import { buildBudgetContext, contextAsPromptJson } from '@/lib/ai/context';
import { budgetTools } from '@/lib/ai/tools';
import type { BudgetSnapshot } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const snapshotSchema = z.custom<BudgetSnapshot>(
  (v) => v && typeof v === 'object' && 'balance' in v && 'bills' in v,
  'invalid snapshot',
);

const SYSTEM = (snapshotJson: string) => `You are the in-app assistant for a personal family-budget tool.

Your job:
- Answer questions about the user's budget directly using the snapshot below.
- When the user wants to change the budget (add/edit/remove a bill or income, mark paid, change balance, switch period), call the appropriate tool. Tool calls are PROPOSALS — the user must approve each one before it takes effect.
- Be concise. Avoid restating the data the user can already see.
- Use plain dollar amounts and ISO dates (YYYY-MM-DD).
- Never invent ids. Always use ids from the snapshot.
- If the snapshot does not contain enough information, ask a brief clarifying question.

Active-period snapshot (JSON):
${snapshotJson}`;

export async function POST(req: Request) {
  if (!hasOpenAIKey()) {
    return NextResponse.json({ error: 'AI is not configured' }, { status: 503 });
  }

  let body: { messages?: UIMessage[]; snapshot?: BudgetSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 });
  }
  const snapshot = snapshotSchema.safeParse(body.snapshot);
  if (!snapshot.success) {
    return NextResponse.json({ error: 'snapshot required' }, { status: 400 });
  }

  const ctx = buildBudgetContext(snapshot.data);
  const snapshotJson = ctx ? contextAsPromptJson(ctx) : '{}';

  const result = streamText({
    model: SMART_MODEL,
    system: SYSTEM(snapshotJson),
    messages: await convertToModelMessages(body.messages),
    tools: budgetTools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    onError: (err) => describeAiError(err).message,
  });
}
