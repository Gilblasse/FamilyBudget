import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_MS = 60_000;

let cache: { ok: boolean; reason?: string; at: number } | null = null;

async function probe(key: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'invalid key' };
    }
    return { ok: false, reason: `OpenAI responded ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'network error' };
  }
}

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ enabled: false, reason: 'OPENAI_API_KEY not set' });
  }

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ enabled: cache.ok, reason: cache.reason });
  }

  const { ok, reason } = await probe(key);
  cache = { ok, reason, at: now };
  return NextResponse.json({ enabled: ok, reason });
}
