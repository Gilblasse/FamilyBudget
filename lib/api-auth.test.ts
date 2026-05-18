import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requireApiKey } from './api-auth';

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.Authorization = authHeader;
  return new Request('http://localhost/test', { headers });
}

describe('requireApiKey', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.stubEnv('BUDGET_API_KEY', '');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '');
  });

  it('returns null and does not error when BUDGET_API_KEY is absent', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = requireApiKey(makeRequest());
    expect(res).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once when BUDGET_API_KEY is absent in a production deployment', async () => {
    // Use isolated module import so the module-level `warned` flag is reset.
    vi.resetModules();
    vi.stubEnv('BUDGET_API_KEY', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('./api-auth');

    const res1 = mod.requireApiKey(makeRequest());
    const res2 = mod.requireApiKey(makeRequest());

    expect(res1).toBeNull();
    expect(res2).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/BUDGET_API_KEY/);
  });

  it('returns null when a matching Bearer token is provided', () => {
    vi.stubEnv('BUDGET_API_KEY', 'sekret-token-abc');
    const res = requireApiKey(makeRequest('Bearer sekret-token-abc'));
    expect(res).toBeNull();
  });

  it('returns 401 when the Bearer token does not match', () => {
    vi.stubEnv('BUDGET_API_KEY', 'sekret-token-abc');
    const res = requireApiKey(makeRequest('Bearer sekret-token-xyz'));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it('returns 401 when no Authorization header is present', () => {
    vi.stubEnv('BUDGET_API_KEY', 'sekret-token-abc');
    const res = requireApiKey(makeRequest());
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it('returns 401 (no throw) when the provided key has a different length', () => {
    vi.stubEnv('BUDGET_API_KEY', 'sekret-token-abc');
    // Different length so timingSafeEqual would throw if called.
    const res = requireApiKey(makeRequest('Bearer short'));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });
});
