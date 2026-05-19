import { NextResponse } from 'next/server';
import {
  currentClientVersion,
  fetchEnvelopeData,
  forwardAction,
  gateRemotePrimary,
  readJson,
} from '@/lib/api/route-helpers';
import { periodCreateSchema } from '@/lib/api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const { status, body } = await fetchEnvelopeData();
  if (status !== 200) return NextResponse.json(body, { status });
  const env = body as { data?: { periods?: unknown[] } | null };
  return NextResponse.json(env.data?.periods ?? []);
}

export async function POST(req: Request) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const parsed = await readJson(req, periodCreateSchema);
  if (!parsed.ok) return parsed.response;
  return forwardAction({
    op: 'upsert',
    entity: 'period',
    id: parsed.data.id,
    payload: parsed.data,
    clientVersion: currentClientVersion(),
  });
}
