import { NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { FAST_MODEL, describeAiError, hasOpenAIKey } from '@/lib/ai/client';
import { extractResponseSchema } from '@/lib/ai/schemas';
import { requireApiKey } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const requestSchema = z.object({
  text: z.string().min(1).max(10_000),
  kind: z.enum(['bill', 'income', 'auto']).default('auto'),
  defaultDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const SYSTEM = `You extract financial line items from freeform text and return them as structured rows.

Each item is either a "bill" (an obligation to pay) or "income" (money expected to arrive).

For BILLS, choose:
- priority: "crit" (rent/mortgage, utilities, insurance, child care), "imp" (groceries, internet, primary transport), "opt" (subscriptions: streaming/gym/software), "flex" (dining, entertainment, hobbies, gifts).
- action: default "pay-full" for crit/imp, "reduce" or "skip" for opt/flex unless context says otherwise.

For INCOME, choose:
- status: "expected" (default for upcoming), "confirmed" (deposit confirmed but not in account), "pending" (cleared but not available), "received" (already in balance).

Date format is strict ISO YYYY-MM-DD. Use the user-provided default date if a date is missing or ambiguous, otherwise pick the most reasonable date based on context (e.g. "next Friday").

Names should be human-readable: "Comcast Internet" not "comcast_internet_bill". Prefer the merchant or source name.

Amounts are positive numbers in dollars. Strip $ and commas. If a range is given, use the midpoint.

Return only items you can confidently extract. Skip ambiguous lines.`;

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

  const { text, kind, defaultDate } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const filter =
    kind === 'bill'
      ? 'Only extract bills (obligations to pay).'
      : kind === 'income'
        ? 'Only extract income (money expected to arrive).'
        : 'Extract both bills and income from the text.';
  const prompt = `Today is ${today}. Default date if missing: ${defaultDate ?? today}.\n${filter}\n\nText:\n${text}`;

  try {
    const { output } = await generateText({
      model: FAST_MODEL,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: extractResponseSchema }),
    });
    return NextResponse.json(output);
  } catch (err) {
    const { status, message } = describeAiError(err);
    return NextResponse.json({ error: 'ai error', message }, { status });
  }
}
