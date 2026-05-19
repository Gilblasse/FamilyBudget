/**
 * Per-entity mutations against Supabase Postgres. Mirrors the ActionBody
 * contract from lib/api/route-helpers.ts so the route layer keeps the same
 * shape it had under Apps Script.
 *
 * Every function:
 *   1. Enforces the stale-schema guard (incoming clientVersion >= stored
 *      app_meta.store_version) — same semantics as Apps Script's 409.
 *   2. Performs the entity-specific write against the active budget's slice.
 *   3. Returns { ok: true, version, updatedAt, entity, id } matching the
 *      legacy upstream success shape, or throws a typed error that the
 *      route layer maps to HTTP 404 / 409 / 502.
 *
 * The active-budget id is read from app_meta. The Apps Script implementation
 * effectively operated on the active slice too (mutations.ts mutateArray etc.
 * always touched the top-level fields, which are the active budget's slice).
 */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { getSupabase } from './server';
import { StaleSchemaError } from './envelope';

export interface ActionSuccess {
  ok: true;
  version: number;
  updatedAt: string;
  entity: string;
  id?: string;
}

export class NotFoundError extends Error {
  constructor(detail = 'not found') {
    super(detail);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when a write references an id (currently `periodId` on bills /
 * income) that doesn't exist under the active budget. The DB has no FK
 * constraint there yet, so the runtime check is the only thing keeping
 * orphan rows out — and orphan rows poison the whole-snapshot PUT path.
 */
export class InvalidReferenceError extends Error {
  readonly field: string;
  constructor(field: string, detail?: string) {
    super(detail ?? `invalid ${field}`);
    this.name = 'InvalidReferenceError';
    this.field = field;
  }
}

async function assertPeriodExists(
  client: SupabaseClient,
  budgetId: string,
  periodId: unknown,
): Promise<void> {
  if (typeof periodId !== 'string' || periodId.length === 0) {
    throw new InvalidReferenceError('periodId', 'periodId is required');
  }
  const { data, error } = await client
    .from('periods')
    .select('id')
    .eq('id', periodId)
    .eq('budget_id', budgetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new InvalidReferenceError(
      'periodId',
      `period ${periodId} does not exist on the active budget`,
    );
  }
}

interface MetaSnapshot {
  active_budget_id: string;
  store_version: number;
}

async function readAndCheckVersion(
  client: SupabaseClient,
  clientVersion: number,
): Promise<MetaSnapshot> {
  const { data, error } = await client
    .from('app_meta')
    .select('active_budget_id, store_version')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  const meta: MetaSnapshot = {
    active_budget_id: data?.active_budget_id ?? '',
    store_version: data?.store_version ?? clientVersion,
  };
  if (clientVersion < meta.store_version) {
    throw new StaleSchemaError(meta.store_version, clientVersion);
  }
  return meta;
}

async function bumpAppMeta(
  client: SupabaseClient,
  patch: Partial<{ active_budget_id: string }> = {},
): Promise<string> {
  const { data, error } = await client
    .from('app_meta')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('updated_at, store_version')
    .single();
  if (error) throw error;
  return data.updated_at as string;
}

function ok(
  entity: string,
  version: number,
  updatedAt: string,
  id?: string,
): ActionSuccess {
  return id !== undefined
    ? { ok: true, entity, id, version, updatedAt }
    : { ok: true, entity, version, updatedAt };
}

// ---- shared upsert helper for entities living under an active budget ----

type EntityField = 'income' | 'bills' | 'periods';

interface EntityShape {
  table: EntityField;
  toRow: (id: string, budgetId: string, payload: Record<string, unknown>) => Record<string, unknown>;
  toPatch: (payload: Record<string, unknown>) => Record<string, unknown>;
}

const INCOME_SHAPE: EntityShape = {
  table: 'income',
  toRow: (id, budgetId, p) => ({
    id,
    budget_id: budgetId,
    period_id: String(p.periodId ?? ''),
    source: String(p.source ?? ''),
    date: String(p.date ?? ''),
    amount: Number(p.amount ?? 0),
    status: String(p.status ?? 'expected'),
    cadence: p.cadence == null ? null : String(p.cadence),
    second_day: p.secondDay == null ? null : Number(p.secondDay),
    end_date: p.endDate == null ? null : String(p.endDate),
  }),
  toPatch: (p) => {
    const out: Record<string, unknown> = {};
    if ('periodId' in p) out.period_id = p.periodId;
    if ('source' in p) out.source = p.source;
    if ('date' in p) out.date = p.date;
    if ('amount' in p) out.amount = p.amount;
    if ('status' in p) out.status = p.status;
    if ('cadence' in p) out.cadence = p.cadence ?? null;
    if ('secondDay' in p) out.second_day = p.secondDay ?? null;
    if ('endDate' in p) out.end_date = p.endDate ?? null;
    return out;
  },
};

const BILL_SHAPE: EntityShape = {
  table: 'bills',
  toRow: (id, budgetId, p) => ({
    id,
    budget_id: budgetId,
    period_id: String(p.periodId ?? ''),
    name: String(p.name ?? ''),
    date: String(p.date ?? ''),
    amount: Number(p.amount ?? 0),
    priority: String(p.priority ?? 'imp'),
    action: String(p.action ?? 'pay-full'),
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : null,
  }),
  toPatch: (p) => {
    const out: Record<string, unknown> = {};
    if ('periodId' in p) out.period_id = p.periodId;
    if ('name' in p) out.name = p.name;
    if ('date' in p) out.date = p.date;
    if ('amount' in p) out.amount = p.amount;
    if ('priority' in p) out.priority = p.priority;
    if ('action' in p) out.action = p.action;
    if ('tags' in p) out.tags = p.tags ?? null;
    return out;
  },
};

const PERIOD_SHAPE: EntityShape = {
  table: 'periods',
  toRow: (id, budgetId, p) => ({
    id,
    budget_id: budgetId,
    start_date: String(p.startDate ?? ''),
    end_date: String(p.endDate ?? ''),
    label: p.label == null ? null : String(p.label),
  }),
  toPatch: (p) => {
    const out: Record<string, unknown> = {};
    if ('startDate' in p) out.start_date = p.startDate;
    if ('endDate' in p) out.end_date = p.endDate;
    if ('label' in p) out.label = p.label ?? null;
    return out;
  },
};

async function upsertScopedEntity(
  client: SupabaseClient,
  shape: EntityShape,
  id: string,
  payload: Record<string, unknown> | undefined,
  budgetId: string,
): Promise<void> {
  const p = payload ?? {};
  // Try UPDATE first. If the row exists, this also lets us patch with a
  // partial payload (PATCH endpoints) without touching unspecified columns.
  const patch = shape.toPatch(p);
  if (Object.keys(patch).length > 0) {
    const { data: updated, error: updErr } = await client
      .from(shape.table)
      .update(patch)
      .eq('id', id)
      .select('id');
    if (updErr) throw updErr;
    if (updated && updated.length > 0) return;
  }
  // No existing row -> INSERT. POST payloads have the full shape; PATCH on a
  // nonexistent id will fail the NOT NULL constraints, which is the right
  // behavior (the route layer surfaces it as 502).
  const insertRow = shape.toRow(id, budgetId, p);
  const { error: insErr } = await client.from(shape.table).insert(insertRow);
  if (insErr) {
    if (isPgConflict(insErr)) {
      // Lost race against another writer; retry as UPDATE.
      const { error: retry } = await client
        .from(shape.table)
        .update(insertRow)
        .eq('id', id);
      if (retry) throw retry;
      return;
    }
    throw insErr;
  }
}

function isPgConflict(err: PostgrestError): boolean {
  return err.code === '23505';
}

async function deleteScopedEntity(
  client: SupabaseClient,
  table: EntityField,
  id: string,
): Promise<void> {
  const { data, error } = await client
    .from(table)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new NotFoundError();
}

// ---- public ops ----

export async function upsertIncome(
  id: string,
  payload: Record<string, unknown> | undefined,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  if (payload && 'periodId' in payload) {
    await assertPeriodExists(client, meta.active_budget_id, payload.periodId);
  }
  await upsertScopedEntity(client, INCOME_SHAPE, id, payload, meta.active_budget_id);
  const updatedAt = await bumpAppMeta(client);
  return ok('income', meta.store_version, updatedAt, id);
}

export async function deleteIncome(
  id: string,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  await deleteScopedEntity(client, 'income', id);
  const updatedAt = await bumpAppMeta(client);
  return ok('income', meta.store_version, updatedAt, id);
}

export async function upsertBill(
  id: string,
  payload: Record<string, unknown> | undefined,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  if (payload && 'periodId' in payload) {
    await assertPeriodExists(client, meta.active_budget_id, payload.periodId);
  }
  await upsertScopedEntity(client, BILL_SHAPE, id, payload, meta.active_budget_id);
  const updatedAt = await bumpAppMeta(client);
  return ok('bill', meta.store_version, updatedAt, id);
}

export async function deleteBill(
  id: string,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  await deleteScopedEntity(client, 'bills', id);
  const updatedAt = await bumpAppMeta(client);
  return ok('bill', meta.store_version, updatedAt, id);
}

export async function upsertPeriod(
  id: string,
  payload: Record<string, unknown> | undefined,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  await upsertScopedEntity(client, PERIOD_SHAPE, id, payload, meta.active_budget_id);
  const updatedAt = await bumpAppMeta(client);
  return ok('period', meta.store_version, updatedAt, id);
}

export async function deletePeriod(
  id: string,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  await deleteScopedEntity(client, 'periods', id);
  const updatedAt = await bumpAppMeta(client);
  return ok('period', meta.store_version, updatedAt, id);
}

export async function upsertBudget(
  id: string,
  payload: Record<string, unknown> | undefined,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  const p = payload ?? {};
  const range = (p.defaultRange ?? {}) as { start?: string; end?: string };

  // Try UPDATE first (PATCH semantics).
  const patch: Record<string, unknown> = {};
  if ('name' in p) patch.name = p.name;
  if ('createdAt' in p) patch.created_at = p.createdAt;
  if (range.start !== undefined) patch.default_range_start = range.start;
  if (range.end !== undefined) patch.default_range_end = range.end;

  if (Object.keys(patch).length > 0) {
    const { data: updated, error: updErr } = await client
      .from('budgets')
      .update(patch)
      .eq('id', id)
      .select('id');
    if (updErr) throw updErr;
    if (updated && updated.length > 0) {
      const updatedAt = await bumpAppMeta(client);
      return ok('budget', meta.store_version, updatedAt, id);
    }
  }

  const { error: insErr } = await client.from('budgets').insert({
    id,
    name: String(p.name ?? ''),
    created_at: String(p.createdAt ?? new Date().toISOString()),
    default_range_start: String(range.start ?? ''),
    default_range_end: String(range.end ?? ''),
  });
  if (insErr) throw insErr;
  const updatedAt = await bumpAppMeta(client);
  return ok('budget', meta.store_version, updatedAt, id);
}

export async function deleteBudget(
  id: string,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  const { data, error } = await client
    .from('budgets')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new NotFoundError();

  // If the deleted budget was active, clear app_meta.active_budget_id so the
  // next loadEnvelope falls back to the first remaining budget.
  const activeClear =
    meta.active_budget_id === id ? { active_budget_id: '' } : undefined;
  const updatedAt = await bumpAppMeta(client, activeClear);
  return ok('budget', meta.store_version, updatedAt, id);
}

export async function setPaid(
  key: string,
  value: boolean,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  if (!meta.active_budget_id) throw new NotFoundError('no active budget');
  if (value) {
    const { error } = await client
      .from('paid_state')
      .upsert(
        { budget_id: meta.active_budget_id, key, paid: true },
        { onConflict: 'budget_id,key' },
      );
    if (error) throw error;
  } else {
    const { error } = await client
      .from('paid_state')
      .delete()
      .eq('budget_id', meta.active_budget_id)
      .eq('key', key);
    if (error) throw error;
  }
  const updatedAt = await bumpAppMeta(client);
  return ok('paid', meta.store_version, updatedAt, key);
}

export async function clearPaid(
  key: string,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  // mutatePaid in apps-script/mutations.ts treated missing keys as idempotent
  // — preserve that semantics so the per-entity DELETE never 404s.
  const meta = await readAndCheckVersion(client, clientVersion);
  if (meta.active_budget_id) {
    const { error } = await client
      .from('paid_state')
      .delete()
      .eq('budget_id', meta.active_budget_id)
      .eq('key', key);
    if (error) throw error;
  }
  const updatedAt = await bumpAppMeta(client);
  return ok('paid', meta.store_version, updatedAt, key);
}

export async function patchMeta(
  payload: Record<string, unknown> | undefined,
  clientVersion: number,
  client: SupabaseClient = getSupabase(),
): Promise<ActionSuccess> {
  const meta = await readAndCheckVersion(client, clientVersion);
  const p = payload ?? {};

  const metaPatch: Record<string, unknown> = {};
  if ('activeBudgetId' in p && typeof p.activeBudgetId === 'string') {
    metaPatch.active_budget_id = p.activeBudgetId;
  }

  const targetBudgetId =
    (metaPatch.active_budget_id as string | undefined) ?? meta.active_budget_id;

  const budgetPatch: Record<string, unknown> = {};
  if ('balance' in p) budgetPatch.balance = Number(p.balance ?? 0);
  if ('activePeriodId' in p && typeof p.activePeriodId === 'string') {
    budgetPatch.active_period_id = p.activePeriodId;
  }
  if ('dateRange' in p) {
    const dr = p.dateRange as { start?: string; end?: string } | null;
    budgetPatch.date_range_start = dr ? dr.start ?? null : null;
    budgetPatch.date_range_end = dr ? dr.end ?? null : null;
  }

  if (Object.keys(budgetPatch).length > 0 && targetBudgetId) {
    const { error } = await client
      .from('budgets')
      .update(budgetPatch)
      .eq('id', targetBudgetId);
    if (error) throw error;
  }

  const updatedAt = await bumpAppMeta(client, metaPatch);
  return ok('meta', meta.store_version, updatedAt);
}
