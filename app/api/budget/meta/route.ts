import { NextResponse } from 'next/server';
import {
  currentClientVersion,
  fetchEnvelopeData,
  forwardAction,
  gateRemotePrimary,
  readJson,
} from '@/lib/api/route-helpers';
import { metaPatchSchema } from '@/lib/api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const { status, body } = await fetchEnvelopeData();
  if (status !== 200) return NextResponse.json(body, { status });
  const env = body as {
    data?: {
      balance?: number;
      activePeriodId?: string;
      dateRange?: { start: string; end: string } | null;
      activeBudgetId?: string;
    } | null;
  };
  const data = env.data ?? {};
  return NextResponse.json({
    balance: data.balance ?? 0,
    activePeriodId: data.activePeriodId ?? '',
    dateRange: data.dateRange ?? null,
    activeBudgetId: data.activeBudgetId ?? '',
  });
}

export async function PATCH(req: Request) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const parsed = await readJson(req, metaPatchSchema);
  if (!parsed.ok) return parsed.response;
  return forwardAction({
    op: 'replace',
    entity: 'meta',
    payload: parsed.data,
    clientVersion: currentClientVersion(),
  });
}
