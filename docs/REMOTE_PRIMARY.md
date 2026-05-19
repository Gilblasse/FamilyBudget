# Remote-Primary Mode

The default deployment is **local-first**: the Zustand store in
`localStorage` is the source of truth and `lib/sync.ts` does a debounced
whole-snapshot PUT to the backend that only fires on Vercel production
deployments.

**Remote-primary mode** flips the relationship — Supabase Postgres becomes
the source of truth, Zustand is a memory-only cache, and edits flow
through per-entity REST endpoints onto the database synchronously.

## Trigger

Remote-primary mode is **active when Supabase credentials are present.**

Specifically: when both `SUPABASE_URL` (or the `NEXT_PUBLIC_SUPABASE_URL`
fallback) and `SUPABASE_SERVICE_ROLE_KEY` are set,
[`isRemotePrimary()`](../lib/remote-mode.ts) returns true.

There is **no separate named flag.** Wiring the credentials is the opt-in.

| Supabase credentials | `VERCEL_ENV` | Legacy snapshot PUT (`/api/budget`) | Per-entity (`/api/budget/income` …) |
| --- | --- | --- | --- |
| Both set | any | writes to Supabase | writes to Supabase |
| Missing | `production` | writes through (defense-in-depth fallback) | **503 remote-disabled** |
| Missing | other / unset | `{ skipped: true }` | **503 remote-disabled** |

The `VERCEL_ENV=production` row is kept only as defense in depth — if a
prod deploy ever loses its Supabase keys, the legacy snapshot PUT
short-circuits cleanly instead of 502ing. In normal operation, presence
of credentials is the only thing that matters.

## Provisioning

Install the **Supabase** integration from the Vercel Marketplace. It
auto-wires:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_*`)
- `SUPABASE_ANON_KEY` (unused today; reserved if we ever expose a public read)
- `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` (informational)

Apply the schema by either running `supabase db push` (with the Supabase
CLI linked to the project) or pasting `supabase/migrations/*.sql` into
the Supabase SQL editor.

For local development against the same project:
`vercel env pull .env.local` mirrors the auto-wired vars into your shell.

For local development against a local Supabase stack:
`npx supabase start` boots Postgres + Studio in Docker, then drop the
printed URLs and keys into `.env.development.local`. Next.js loads
that file only during `pnpm dev`, so local-stack credentials don't leak
into prod deploys.

## Security model

- The browser↔Next.js hop is protected by same-origin fetch. There is
  no bearer-token layer between them — adding one only made sense when
  the secret could actually be hidden, which doesn't apply for a
  same-origin client.
- `SUPABASE_SERVICE_ROLE_KEY` gates the server↔Supabase hop. The key
  lives in server-only env, never in the browser bundle, and never in
  any module imported by client code ([lib/supabase/server.ts](../lib/supabase/server.ts) is the
  single server-only entry point).

## Storage layer

Postgres schema (defined in `supabase/migrations/0001_initial.sql`):

- `budgets` — one row per `BudgetMeta`. Also holds the active budget's
  scalar state (`balance`, `active_period_id`, `date_range_*`).
- `periods` — `BudgetPeriod` rows, FK → `budgets`.
- `income` — `Income` rows, FK → `budgets`.
- `bills` — `Bill` rows, FK → `budgets`. `tags` is a `text[]`.
- `paid_state` — `(budget_id, key) → paid` rows mirroring `PaidState`.
- `app_meta` — singleton row (`id = 1`) with `active_budget_id`,
  `store_version`, `updated_at`.

Cascade deletes on every `budget_id` FK make `DELETE FROM budgets WHERE id = $1`
wipe the entire portfolio for that budget atomically.

### Atomic replace RPC

`replace_budget_snapshot(payload jsonb)` is a PL/pgSQL function that
performs the legacy whole-snapshot PUT atomically:

1. Locks `app_meta` (`FOR UPDATE`).
2. Compares `payload.version` to `app_meta.store_version`; if the
   incoming version is lower, raises `'stale schema: stored=X, incoming=Y'`
   with errcode `P0001` (mapped to HTTP 409 by the route layer).
3. `DELETE FROM budgets` (cascades all children).
4. Re-inserts every budget + its `BudgetData` slice from the payload.
5. Updates `app_meta.active_budget_id`, bumps `store_version`, refreshes
   `updated_at`.

Per-entity writes (POST/PATCH/DELETE on `/api/budget/{income,bills,…}`)
do NOT go through the RPC — each is a single SQL statement and so is
atomic on its own.

## Endpoints

All per-entity routes call `isRemotePrimary()` and 503 with
`remote-disabled` when off. The internal action body shape is
`{ op, entity, id?, payload?, clientVersion }` — dispatched to
[lib/supabase/actions.ts](../lib/supabase/actions.ts).

| Path | Methods | Notes |
| --- | --- | --- |
| `/api/budget` | GET, PUT | Legacy snapshot envelope. PUT delegates to `replace_budget_snapshot`. |
| `/api/budget/income` | GET, POST | List, create. Client-minted `id` via `uid()`. |
| `/api/budget/income/[id]` | GET, PATCH, DELETE | |
| `/api/budget/bills` | GET, POST | |
| `/api/budget/bills/[id]` | GET, PATCH, DELETE | |
| `/api/budget/periods` | GET, POST | |
| `/api/budget/periods/[id]` | GET, PATCH, DELETE | |
| `/api/budget/budgets` | GET, POST | Multi-budget slice goes on the wire in v9. |
| `/api/budget/budgets/[id]` | GET, PATCH, DELETE | |
| `/api/budget/paid/[id]` | POST, DELETE | `id` is the paid key (`bill_*` / `inc_*[_YYYY-MM-DD]`). |
| `/api/budget/meta` | GET, PATCH | `{ balance?, activePeriodId?, dateRange?, activeBudgetId? }`. |

## First-load migration

When the app boots in remote-primary mode for the first time and the
Supabase database is empty (no `budgets` rows) **and** there is local
state in `localStorage`, [components/shell/remote-migration-modal.tsx](../components/shell/remote-migration-modal.tsx)
forces a choice:

- **Upload local → cloud** — PUTs the full local snapshot to
  `/api/budget`, clears `localStorage.budget_v1`, marks
  `localStorage.remote_migration_v1 = 'uploaded'`.
- **Discard local and start fresh** — calls `resetAll()`, marks
  `localStorage.remote_migration_v1 = 'discarded'`.

The choice is persisted, so the modal does not reappear.

## Reverting

To return to local-first behavior:

1. Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
   environment (or rename `.env.development.local` for the dev case).
2. Restart the dev server (or redeploy).

With no credentials present, `isRemotePrimary()` returns false, the
store bridge stops projecting, `useBudgetSync()` resumes its debounced
PUT (no-op without credentials), and the per-entity endpoints respond
with 503.

## Schema bump (v8 → v9)

`STORE_VERSION` is `9` (exported from [lib/store.ts](../lib/store.ts) and mirrored into
`app_meta.store_version` by the initial migration). The multi-budget
slice (`budgets`, `activeBudgetId`, `budgetData`) is on the on-wire
snapshot so the cloud owns the whole portfolio. `replace_budget_snapshot`
rejects PUTs with `clientVersion < storedVersion` (HTTP 409
`stale schema`), so older clients can't clobber a newer envelope.

## Per-entity behavior (Supabase)

[lib/supabase/actions.ts](../lib/supabase/actions.ts) implements one function per `(entity, op)`
pair. Each one:

- Reads `app_meta` to look up the active `budget_id` and the stored
  `store_version`.
- If `clientVersion < store_version`, throws `StaleSchemaError` → 409.
- Performs the entity-specific write against the active budget's slice.
- Bumps `app_meta.updated_at` and returns
  `{ ok: true, entity, id, version, updatedAt }` matching the legacy
  upstream success shape.

Notable behaviors carried over from the Apps Script implementation:

- **Upsert merges**. `upsertIncome` / `upsertBill` / `upsertPeriod` try
  `UPDATE … WHERE id = $1` first, falling back to `INSERT` only when no
  row matches. PATCH endpoints with partial payloads succeed; POST
  endpoints with the full payload work the same as before.
- **`mutatePaid` is idempotent on delete**. `clearPaid(key)` never 404s,
  matching the legacy Apps Script behavior so the per-entity
  `DELETE /api/budget/paid/[id]` is safe to retry.
- **`mergeMeta` shallow-merges**. `patchMeta` only touches the keys
  present in the payload (`balance`, `activePeriodId`, `dateRange`,
  `activeBudgetId`). Unknown keys are dropped silently.
