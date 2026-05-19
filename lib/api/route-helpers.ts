/**
 * Thin, testable seam used by every per-entity remote-primary route file
 * under `app/api/budget/**`. Route handlers stay one or two lines each so
 * all the gate / parse / dispatch / error-mapping logic lives here and is
 * unit-tested in `lib/api/route-helpers.test.ts`.
 *
 * Backed by Supabase Postgres (lib/supabase/*). The on-wire contract with
 * the browser is unchanged from the prior Apps Script implementation: same
 * envelope shape, same per-entity action body, same HTTP status mapping
 * (409 stale schema, 404 not found, 502 upstream).
 */
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { isRemotePrimary, REMOTE_DISABLED_REASON } from '@/lib/remote-mode';
import { STORE_VERSION } from '@/lib/store';
import { loadEnvelope, StaleSchemaError } from '@/lib/supabase/envelope';
import { SupabaseNotConfiguredError } from '@/lib/supabase/server';
import {
  InvalidReferenceError,
  NotFoundError,
  clearPaid,
  deleteBill,
  deleteBudget,
  deleteIncome,
  deletePeriod,
  patchMeta,
  setPaid,
  upsertBill,
  upsertBudget,
  upsertIncome,
  upsertPeriod,
  type ActionSuccess,
} from '@/lib/supabase/actions';

export type ActionOp = 'upsert' | 'delete' | 'replace';
export type ActionEntity = 'income' | 'bill' | 'period' | 'budget' | 'paid' | 'meta';

export interface ActionBody {
  op: ActionOp;
  entity: ActionEntity;
  id?: string;
  payload?: unknown;
  clientVersion: number;
}

/**
 * Mode gate for the per-entity REST endpoints. Returns a 503 response when
 * remote-primary mode is off, or null to proceed. Same-origin browser fetches
 * are the trust boundary; there is no bearer-token layer.
 *
 * Accepts `req` so route handlers can pass it uniformly even though the gate
 * currently consults only env vars.
 */
export function gateRemotePrimary(req: Request): Response | null {
  void req;
  if (!isRemotePrimary()) {
    return NextResponse.json(
      { error: 'remote-disabled', reason: REMOTE_DISABLED_REASON },
      { status: 503 },
    );
  }
  return null;
}

type ReadJsonResult<T> = { ok: true; data: T } | { ok: false; response: Response };

export async function readJson<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<ReadJsonResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'invalid JSON' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

function asPayload(p: unknown): Record<string, unknown> | undefined {
  return p && typeof p === 'object' ? (p as Record<string, unknown>) : undefined;
}

async function dispatchAction(action: ActionBody): Promise<ActionSuccess> {
  const { op, entity, id, payload, clientVersion } = action;
  const payloadObj = asPayload(payload);

  if (entity === 'income') {
    if (op === 'upsert') {
      if (!id) throw new NotFoundError();
      return upsertIncome(id, payloadObj, clientVersion);
    }
    if (op === 'delete') {
      if (!id) throw new NotFoundError();
      return deleteIncome(id, clientVersion);
    }
  }
  if (entity === 'bill') {
    if (op === 'upsert') {
      if (!id) throw new NotFoundError();
      return upsertBill(id, payloadObj, clientVersion);
    }
    if (op === 'delete') {
      if (!id) throw new NotFoundError();
      return deleteBill(id, clientVersion);
    }
  }
  if (entity === 'period') {
    if (op === 'upsert') {
      if (!id) throw new NotFoundError();
      return upsertPeriod(id, payloadObj, clientVersion);
    }
    if (op === 'delete') {
      if (!id) throw new NotFoundError();
      return deletePeriod(id, clientVersion);
    }
  }
  if (entity === 'budget') {
    if (op === 'upsert') {
      if (!id) throw new NotFoundError();
      return upsertBudget(id, payloadObj, clientVersion);
    }
    if (op === 'delete') {
      if (!id) throw new NotFoundError();
      return deleteBudget(id, clientVersion);
    }
  }
  if (entity === 'paid') {
    if (!id) throw new NotFoundError();
    if (op === 'upsert') {
      const value = payload === undefined ? true : Boolean(payload);
      return setPaid(id, value, clientVersion);
    }
    if (op === 'delete') return clearPaid(id, clientVersion);
  }
  if (entity === 'meta' && op === 'replace') {
    return patchMeta(payloadObj, clientVersion);
  }

  throw new NotFoundError('unsupported action');
}

/**
 * Dispatch an action body to the Supabase mutation layer and map the result
 * into an HTTP response with the legacy body shapes the route layer expects:
 *
 *   • stale schema   -> 409 { error: 'stale schema', storedVersion, incomingVersion }
 *   • not found      -> 404 { error: 'not found' }
 *   • not configured -> 502 { error: 'upstream not configured' }
 *   • Postgres error -> 502 { error: 'upstream error', detail }
 *   • success        -> 200 { ok: true, version, updatedAt, entity, id? }
 */
export async function forwardAction(action: ActionBody): Promise<Response> {
  try {
    const result = await dispatchAction(action);
    return NextResponse.json(result);
  } catch (err) {
    return mapErrorToResponse(err);
  }
}

function mapErrorToResponse(err: unknown): Response {
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
  if (err instanceof InvalidReferenceError) {
    return NextResponse.json(
      { error: 'invalid reference', field: err.field, detail: err.message },
      { status: 400 },
    );
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (err instanceof SupabaseNotConfiguredError) {
    return NextResponse.json({ error: 'upstream not configured' }, { status: 502 });
  }
  return NextResponse.json(
    { error: 'upstream error', detail: err instanceof Error ? err.message : String(err) },
    { status: 502 },
  );
}

/**
 * Used by per-entity GET endpoints that read a single slice off the full
 * envelope. Wraps `loadEnvelope()` from the Supabase layer and returns
 * `{ status, body }` so callers don't have to know about the Postgres errors.
 */
export async function fetchEnvelopeData(): Promise<{ status: number; body: unknown }> {
  try {
    const env = await loadEnvelope();
    return {
      status: 200,
      body: { version: env.version, data: env.data, updatedAt: env.updatedAt },
    };
  } catch (err) {
    if (err instanceof SupabaseNotConfiguredError) {
      return { status: 502, body: { error: 'upstream not configured' } };
    }
    return {
      status: 502,
      body: {
        error: 'upstream error',
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export function currentClientVersion(): number {
  return STORE_VERSION;
}
