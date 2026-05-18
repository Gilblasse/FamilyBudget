import { NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { SMART_MODEL, describeAiError, hasOpenAIKey } from '@/lib/ai/client';
import { adviseResponseSchema, budgetSnapshotSchema } from '@/lib/ai/schemas';
import { buildBudgetContext, contextAsPromptJson } from '@/lib/ai/context';
import { requireApiKey } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const requestSchema = z.object({
  snapshot: budgetSnapshotSchema,
});

const SYSTEM = `You are a sober, pragmatic budget advisor for a household with irregular income.

Given a budget snapshot for the user's currently selected date range (which may span one or more pay periods), identify which bills should be delayed, reduced, skipped, or paid partially so the household stays solvent and prioritizes essentials. Anchor your reasoning on \`dateRange.start\` and \`dateRange.end\` from the snapshot.

Income may be recurring. \`recurringSources\` lists every template that repeats (cadence is one of weekly, biweekly, semimonthly, monthly), with its anchor date and per-occurrence amount. \`expandedIncome\` lists every concrete occurrence already projected into the visible date range — sum it for income totals; do not re-multiply by cadence. \`income\` only contains one-off rows plus the source templates and is for context, not for totals.

Rules:
- Never recommend skipping or delaying a "crit" (critical) priority bill. If the household cannot cover crit+imp, say so explicitly in the summary instead.
- Prefer changes to lower-priority bills first (flex → opt → imp).
- "savingsAmount" is the dollar reduction within the selected range if the recommendation is applied (full bill amount for skip/delay, half for partial, the user's likely reduction for reduce).
- Reasoning is one or two sentences, plain language, addressed to the user.
- Reference each bill by its exact id from the snapshot.
- Only include recommendations that change the bill's current action — do not propose keeping things the same.
- If the budget is already healthy, return an empty recommendations list and a short positive summary.`;

export async function POST(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  if (!hasOpenAIKey()) {
    return NextResponse.json({ error: 'AI is not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const ctx = buildBudgetContext(parsed.data.snapshot);
  if (!ctx) {
    return NextResponse.json({ error: 'no selected range' }, { status: 400 });
  }

  const prompt = `Budget snapshot for the user's selected date range:\n\n${contextAsPromptJson(ctx)}`;

  try {
    const { output } = await generateText({
      model: SMART_MODEL,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: adviseResponseSchema }),
    });
    return NextResponse.json(output);
  } catch (err) {
    const { status, message } = describeAiError(err);
    return NextResponse.json({ error: 'ai error', message }, { status });
  }
}
