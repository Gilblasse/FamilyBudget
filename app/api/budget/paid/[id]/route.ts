import { NextResponse } from 'next/server';
import {
  currentClientVersion,
  forwardAction,
  gateRemotePrimary,
} from '@/lib/api/route-helpers';
import { paidKeyParamSchema } from '@/lib/api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

async function parsePaidKey(ctx: Ctx): Promise<{ ok: true; id: string } | { ok: false; response: Response }> {
  const { id } = await ctx.params;
  const parsed = paidKeyParamSchema.safeParse({ id });
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'invalid paid key', details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, id: parsed.data.id };
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const key = await parsePaidKey(ctx);
  if (!key.ok) return key.response;
  return forwardAction({
    op: 'upsert',
    entity: 'paid',
    id: key.id,
    payload: true,
    clientVersion: currentClientVersion(),
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = gateRemotePrimary(req);
  if (gate) return gate;
  const key = await parsePaidKey(ctx);
  if (!key.ok) return key.response;
  return forwardAction({
    op: 'delete',
    entity: 'paid',
    id: key.id,
    clientVersion: currentClientVersion(),
  });
}
