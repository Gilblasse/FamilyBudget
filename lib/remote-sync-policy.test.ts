import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canWriteRemote,
  getDeploymentEnv,
  isProductionDeployment,
} from './remote-sync-policy';

describe('remote-sync-policy', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '');
  });

  it('blocks remote writes in development', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'development');
    expect(canWriteRemote()).toBe(false);
    expect(isProductionDeployment()).toBe(false);
    expect(getDeploymentEnv()).toBe('development');
  });

  it('blocks remote writes on preview deployments', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
    expect(canWriteRemote()).toBe(false);
    expect(getDeploymentEnv()).toBe('preview');
  });

  it('allows remote writes only on production deployments', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production');
    expect(canWriteRemote()).toBe(true);
    expect(isProductionDeployment()).toBe(true);
    expect(getDeploymentEnv()).toBe('production');
  });

  it('blocks when both env vars are absent (local dev without Vercel CLI)', () => {
    expect(canWriteRemote()).toBe(false);
    expect(getDeploymentEnv()).toBe('unknown');
  });

  it('does not treat NODE_ENV=production as a production deployment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(canWriteRemote()).toBe(false);
    expect(getDeploymentEnv()).toBe('unknown');
  });

  it('prefers VERCEL_ENV over NEXT_PUBLIC_VERCEL_ENV when both are set', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
    expect(canWriteRemote()).toBe(true);
    expect(getDeploymentEnv()).toBe('production');
  });

  it('falls back to NEXT_PUBLIC_VERCEL_ENV when VERCEL_ENV is absent (client bundle)', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production');
    expect(canWriteRemote()).toBe(true);
    expect(getDeploymentEnv()).toBe('production');
  });

  it('treats unrecognized env strings as unknown', () => {
    vi.stubEnv('VERCEL_ENV', 'staging');
    expect(canWriteRemote()).toBe(false);
    expect(getDeploymentEnv()).toBe('unknown');
  });
});
