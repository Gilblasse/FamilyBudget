import { NextResponse } from 'next/server';
import { canWriteRemote, REMOTE_WRITE_DISABLED_REASON } from '@/lib/remote-sync-policy';
import { budgetEnvelopeSchema } from '@/lib/ai/schemas';
import { STORE_VERSION } from '@/lib/store';
import {
  loadEnvelope,
  saveEnvelope,
  StaleSchemaError,
} from '@/lib/supabase/envelope';
import { SupabaseNotConfiguredError } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const env = await loadEnvelope();
    return NextResponse.json({
      version: env.version,
      data: env.data,
      updatedAt: env.updatedAt,
    });
  } catch (err) {
    if (err instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ error: 'upstream not configured' }, { status: 502 });
    }
    return NextResponse.json(
      { error: 'upstream error', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const result = budgetEnvelopeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'invalid payload', details: result.error.flatten() },
      { status: 400 },
    );
  }

  if (!canWriteRemote()) {
    return NextResponse.json({
      updatedAt: null,
      skipped: true,
      reason: REMOTE_WRITE_DISABLED_REASON,
    });
  }

  try {
    const saved = await saveEnvelope({
      version: result.data.version ?? STORE_VERSION,
      data: result.data.data,
    });
    return NextResponse.json({ updatedAt: saved.updatedAt, version: saved.version });
  } catch (err) {
    if (err instanceof StaleSchemaError) {
      return NextResponse.json(
        {
          error: 'stale schema',
          storedVersion: err.storedVersion,
          incomingVersion: err.incomingVersion,
        },
        { status: 409 },
      );
    }
    if (err instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ error: 'upstream not configured' }, { status: 502 });
    }
    return NextResponse.json(
      { error: 'upstream error', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
