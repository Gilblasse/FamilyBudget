import { NextResponse } from 'next/server';
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

export async function GET() {
  const { base, token } = env();
  const res = await fetch(withToken(base, token), { cache: 'no-store', redirect: 'follow' });
  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 });
  }
  const payload = (await res.json()) as { data: BudgetSnapshot | null; updatedAt: string | null };
  return NextResponse.json(payload);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { data?: BudgetSnapshot };
  if (!body?.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ updatedAt: null, skipped: true });
  }

  const { base, token } = env();
  const res = await fetch(withToken(base, token), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: body.data }),
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 });
  }
  const payload = (await res.json()) as { updatedAt: string };
  return NextResponse.json(payload);
}
