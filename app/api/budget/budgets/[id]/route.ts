import { NextResponse } from 'next/server';
import {
  currentClientVersion,
  fetchEnvelopeData,
  forwardAction,
  gateRemotePrimary,
  readJson,
} from '@/lib/api/route-helpers';
import { budgetMetaUpdateSchema } from '@/lib/api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const { id } = await ctx.params;
  const { status, body } = await fetchEnvelopeData();
  if (status !== 200) return NextResponse.json(body, { status });
  const env = body as { data?: { budgets?: Array<{ id: string }> } | null };
  const row = env.data?.budgets?.find((r) => r.id === id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const { id } = await ctx.params;
  const parsed = await readJson(req, budgetMetaUpdateSchema);
  if (!parsed.ok) return parsed.response;
  return forwardAction({
    op: 'upsert',
    entity: 'budget',
    id,
    payload: parsed.data,
    clientVersion: currentClientVersion(),
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const { id } = await ctx.params;
  return forwardAction({
    op: 'delete',
    entity: 'budget',
    id,
    clientVersion: currentClientVersion(),
  });
}
