import { NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { isProductionDeployment } from '@/lib/remote-sync-policy';

// Module-level flag: warn once per process when prod deployment is unauthenticated.
let warned = false;

function unauthorized(): Response {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export function requireApiKey(req: Request): Response | null {
  const expected = process.env.BUDGET_API_KEY;

  if (!expected) {
    if (!warned && isProductionDeployment()) {
      warned = true;
      console.warn(
        '[api-auth] BUDGET_API_KEY is not set in a production deployment — mutating routes are unauthenticated.',
      );
    }
    return null;
  }

  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized();
  }

  const provided = header.slice('Bearer '.length).trim();
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  // Length check before timingSafeEqual to avoid throwing on mismatch.
  if (expectedBuf.length !== providedBuf.length) {
    return unauthorized();
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return unauthorized();
  }

  return null;
}
