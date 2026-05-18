import { NextResponse } from 'next/server';
import { canWriteRemote, REMOTE_WRITE_DISABLED_REASON } from '@/lib/remote-sync-policy';
import { requireApiKey } from '@/lib/api-auth';
import { budgetEnvelopeSchema } from '@/lib/ai/schemas';
import { STORE_VERSION } from '@/lib/store';
import type { BudgetSnapshot } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env() {
  const base = process.env.SHEETS_WEBAPP_URL;
  if (!base) throw new Error('SHEETS_WEBAPP_URL is not set');
  const token = process.env.SHEETS_WEBAPP_TOKEN ?? '';
  return { base, token };
}

function withToken(base: string, token: string) {
  if (!token) return base;
  const url = new URL(base);
  url.searchParams.set('token', token);
  return url.toString();
}

// Apps Script Web Apps cannot read request headers — `e` on doGet/doPost exposes
// `parameter` but not `headers`. The Bearer header below is forward-compat in
// case Google adds support; the query-string `?token=` is the real auth gate.
function upstreamHeaders(token: string, extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface UpstreamGetPayload {
  version?: number | null;
  data: BudgetSnapshot | null;
  updatedAt: string | null;
}

export async function GET(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { base, token } = env();
  const res = await fetch(withToken(base, token), {
    cache: 'no-store',
    redirect: 'follow',
    headers: upstreamHeaders(token),
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 });
  }
  const payload = (await res.json()) as UpstreamGetPayload;
  // Legacy cells stored before the envelope migration have no version. Fall
  // through with null so the client can decide whether to import.
  return NextResponse.json({
    version: payload.version ?? null,
    data: payload.data ?? null,
    updatedAt: payload.updatedAt ?? null,
  });
}

export async function PUT(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

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

  const version = result.data.version ?? STORE_VERSION;
  const { base, token } = env();
  const res = await fetch(withToken(base, token), {
    method: 'POST',
    headers: upstreamHeaders(token, { 'content-type': 'application/json' }),
    body: JSON.stringify({ version, data: result.data.data }),
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 });
  }
  const payload = (await res.json()) as
    | { updatedAt: string; version?: number }
    | { error: string; storedVersion?: number };
  if ('error' in payload) {
    return NextResponse.json(payload, { status: 409 });
  }
  return NextResponse.json(payload);
}
