import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { forwardAction, gateRemotePrimary, readJson } from './route-helpers';
import { __resetSupabaseClientForTests } from '@/lib/supabase/server';

function makeReq(opts?: { body?: unknown }): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

const SCHEMA = z.object({ amount: z.number() });

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  __resetSupabaseClientForTests();
});

describe('gateRemotePrimary', () => {
  it('returns 503 remote-disabled when Supabase credentials are unset', async () => {
    const res = gateRemotePrimary(makeReq());
    expect(res?.status).toBe(503);
    const body = await res!.json();
    expect(body.error).toBe('remote-disabled');
  });

  it('returns 503 when only the URL is set (missing service-role key)', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    const res = gateRemotePrimary(makeReq());
    expect(res?.status).toBe(503);
  });

  it('returns null (pass) when both Supabase credentials are wired', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv-key');
    const res = gateRemotePrimary(makeReq());
    expect(res).toBeNull();
  });
});

describe('readJson', () => {
  it('returns parsed data on success', async () => {
    const r = await readJson(makeReq({ body: { amount: 5 } }), SCHEMA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.amount).toBe(5);
  });

  it('returns 400 invalid JSON on a non-JSON body', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    const r = await readJson(req, SCHEMA);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const body = await r.response.json();
      expect(body.error).toBe('invalid JSON');
    }
  });

  it('returns 400 invalid payload on zod failure', async () => {
    const r = await readJson(makeReq({ body: { amount: 'no' } }), SCHEMA);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const body = await r.response.json();
      expect(body.error).toBe('invalid payload');
      expect(body.details).toBeDefined();
    }
  });
});

describe('forwardAction', () => {
  const ACTION = {
    op: 'upsert' as const,
    entity: 'income' as const,
    id: 'inc_a',
    payload: {
      id: 'inc_a',
      periodId: 'p1',
      source: 'Paycheck',
      date: '2026-05-01',
      amount: 100,
      status: 'expected' as const,
    },
    clientVersion: 9,
  };

  it('502s when Supabase env is unset', async () => {
    const res = await forwardAction(ACTION);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('upstream not configured');
  });

  it('maps a missing id on a delete to 404 not found', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv-key');
    const res = await forwardAction({
      op: 'delete',
      entity: 'bill',
      clientVersion: 9,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not found');
  });
});
