import { NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { FAST_MODEL, describeAiError, hasOpenAIKey } from '@/lib/ai/client';
import { classifyResponseSchema } from '@/lib/ai/schemas';
import { requireApiKey } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const requestSchema = z.object({
  name: z.string().min(1).max(120),
  date: z.string().optional(),
  amount: z.number().nonnegative().optional(),
});

const SYSTEM = `You classify household bills into a priority and a payment action.

PRIORITY values:
- "crit": cannot be skipped without serious consequence (rent/mortgage, electricity, water, insurance, child care, urgent medical).
- "imp": important and recurring but flexibility exists (groceries, utilities like internet, phone, primary transportation).
- "opt": optional ongoing services (most subscriptions: streaming, gym, music, software).
- "flex": fully discretionary or one-off (dining, entertainment, hobbies, gifts).

ACTION values:
- "pay-full": pay the full amount this period.
- "partial": pay part now, defer the rest.
- "delay": push to next period without changing the amount.
- "reduce": negotiate or downgrade to a smaller amount.
- "skip": cancel or do not pay this period.

Default to "pay-full" for crit/imp. Default to "reduce" or "skip" for opt/flex unless context suggests otherwise. Keep the rationale to one short sentence.`;

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

  const { name, date, amount } = parsed.data;
  const prompt = `Bill name: ${name}${date ? `\nDue date: ${date}` : ''}${
    amount !== undefined ? `\nAmount: $${amount.toFixed(2)}` : ''
  }`;

  try {
    const { output } = await generateText({
      model: FAST_MODEL,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: classifyResponseSchema }),
    });
    return NextResponse.json(output);
  } catch (err) {
    const { status, message } = describeAiError(err);
    return NextResponse.json({ error: 'ai error', message }, { status });
  }
}
