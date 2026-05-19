import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isRemotePrimary, isRemotePrimaryClient } from './remote-mode';

describe('remote-mode', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_REMOTE_PRIMARY', '');
  });

  describe('isRemotePrimary (server)', () => {
    it('is true when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both set', () => {
      vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv-key');
      expect(isRemotePrimary()).toBe(true);
    });

    it('falls back to NEXT_PUBLIC_SUPABASE_URL when SUPABASE_URL is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv-key');
      expect(isRemotePrimary()).toBe(true);
    });

    it('is false when only the URL is set (missing service-role key)', () => {
      vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
      expect(isRemotePrimary()).toBe(false);
    });

    it('is false when only the service-role key is set (missing URL)', () => {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv-key');
      expect(isRemotePrimary()).toBe(false);
    });

    it('is false when both Supabase env vars are unset', () => {
      expect(isRemotePrimary()).toBe(false);
    });
  });

  describe('isRemotePrimaryClient (client)', () => {
    it('is true when NEXT_PUBLIC_REMOTE_PRIMARY === "1"', () => {
      vi.stubEnv('NEXT_PUBLIC_REMOTE_PRIMARY', '1');
      expect(isRemotePrimaryClient()).toBe(true);
    });

    it('is false when NEXT_PUBLIC_REMOTE_PRIMARY === "0"', () => {
      vi.stubEnv('NEXT_PUBLIC_REMOTE_PRIMARY', '0');
      expect(isRemotePrimaryClient()).toBe(false);
    });

    it('is false when unset (default local-first)', () => {
      expect(isRemotePrimaryClient()).toBe(false);
    });

    it('does not read the service-role key directly (server-only secret)', () => {
      vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv-key');
      expect(isRemotePrimaryClient()).toBe(false);
    });
  });
});
