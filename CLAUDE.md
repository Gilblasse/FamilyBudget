# Family Budget

Personal irregular-income budget planner. Tracks income vs bills across a pay period with a running trial-balance ledger, cash-flow timeline, and paid/unpaid toggles. Single-user, works offline, deploys to Vercel.

## Stack

- **Next.js 16.2** (App Router, Turbopack) + **React 19.2**
- **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** — style `base-nova`, **Base UI primitives** (`@base-ui/react`), not Radix. See "Base UI gotchas" below.
- **Zustand** with `persist` middleware → `localStorage` for state
- **next-themes** for light/dark/system
- **Sonner** for toasts (shadcn `sonner` wrapper)
- **pnpm** as the package manager
- **Vercel** for deployment (Fluid Compute defaults; no custom infra)

## Project layout

```
app/
  layout.tsx              # ThemeProvider, TooltipProvider, Toaster, Geist fonts, metadata
  not-found.tsx           # Shell + EmptyState
  globals.css             # Tailwind + shadcn tokens + app tokens (income, expense, warning, pri-*)
  (app)/                  # Route group: every page renders inside the shell
    layout.tsx            #   SidebarProvider + AppSidebar + AppHeader + BudgetSyncBoundary + CommandPalette
    template.tsx          #   framer-motion page-change animation
    page.tsx              #   Dashboard home
    bills/                #   page.tsx → <BillsTable />            (+ loading.tsx)
    cash-flow/            #   page.tsx → <CashFlow />              (+ loading.tsx)
    income/               #   page.tsx → <IncomeTable />           (+ loading.tsx)
    summary/              #   page.tsx → <Summary />               (+ loading.tsx)
    trial-balance/        #   page.tsx → <TrialBalance />          (+ loading.tsx)
    settings/             #   page.tsx → <SettingsView />          (no loading.tsx — TODO)
    help-center/          #   page.tsx → <HelpCenterView />        (no loading.tsx — TODO)
  api/
    budget/route.ts       # GET/PUT envelope to Apps Script; auth + Zod schema + production-only writes
    ai/{status,chat,advise,classify,extract}/route.ts

components/
  ui/                     # shadcn Base UI primitives — added via CLI, edit in place if needed
  theme-provider.tsx      # next-themes wrapper
  theme-toggle.tsx        # Light / Dark / System dropdown
  shell/                  # AppSidebar, AppHeader, CommandPalette, BudgetSyncBoundary, SidebarSearch, SidebarDataCard
  dashboard/              # BalanceOverviewCard, IncomeOverviewCard, ExpenseOverviewCard, MoneyFlowChart, CoverageCard, TransactionHistory, skeletons
  settings/               # SettingsView (Data / Periods / Appearance / AI sections)
  help-center/            # HelpCenterView
  budget/                 # Feature components — tables, ledger, cash-flow, date-range-picker, ai/, etc.
                          # NOTE: `balance-card.tsx` was deleted in Round 3; dashboard uses BalanceOverviewCard.

lib/
  store.ts                # useBudget Zustand store + persist (key budget_v1, version STORE_VERSION); exports STORE_VERSION
  ui-store.ts             # useUIStore — search, txFilter, txColumns (key dashboard.ui.v1)
  saved-ranges-store.ts   # useSavedRanges — bookmarked date ranges (key dashboard.dateRange.savedRanges.v1)
  types.ts                # Income, Bill, BudgetSnapshot, BudgetEnvelope, etc.
  format.ts               # fmt(), fd(), fdRange(), uid()
  date-utils.ts           # ISO date helpers (todayIso, addDaysIso, fromIso, …)
  filters.ts              # inRange, filterByRange, clampRangeToPeriod
  recurrence.ts           # expandAllIncome (weekly/biweekly/monthly/semimonthly)
  visibility.ts           # visibleIncomeSources, visibleBills (range-first, period-agnostic)
  dedupe.ts               # dedupeBills / dedupeIncome with paid-key remapping
  sort.ts                 # SortState<TCol>, nextDir, dirFor, applySort
  badges.ts               # actionVariant / incomeStatusVariant / priorityVariant (single source of truth)
  tags.ts                 # normalizeTag, MAX_TAGS_PER_BILL, MAX_TAG_LENGTH (Bill.tags helpers)
  derived.ts              # openingBalanceEntry, endingBalance, isReceivedIncome, isImportantBill, isActiveBill,
                          # pendingIncomeCount, isPaid, criticalUnpaidBills, confirmedIncomeTotal
  sync.ts                 # useBudgetSync — GET on mount, PUT on debounced state change (production writes only)
  remote-sync-policy.ts   # canWriteRemote() — single source of truth for the production-only-writes rule
  api-auth.ts             # requireApiKey() — Bearer-token guard for /api/budget and /api/ai/*
  use-mounted.ts          # useSyncExternalStore-based SSR-safe mount flag
  use-effective-range.ts  # derived date range hook (raw range ?? active period)
  utils.ts                # cn() from shadcn
  ai/                     # schemas.ts (Zod incl. budgetSnapshotSchema + budgetEnvelopeSchema), context.ts, tools.ts, client.ts

hooks/
  use-date-range.ts       # composed date-range hook
  use-mobile.ts           # useIsMobile (≤767px)
  use-narrow-viewport.ts  # useIsNarrowViewport (≤639px)

apps-script/
  Code.gs                 # Google Apps Script — single-cell envelope storage
  README.md               # Setup + envelope + version-mismatch behavior + auth (query-string only)
```

Keep feature code in `components/budget/`. Never put shadcn-modified primitives there — if a primitive needs changes, edit it in `components/ui/` directly (that is the shadcn pattern: you own the code).

## Hard constraints

- **shadcn CLI, always.** Add primitives via `pnpm dlx shadcn@latest add <name>`. Never hand-write a Button, Dialog, Select, etc. If it exists in shadcn, install it.
- **Tailwind only for styling.** No CSS modules, no styled-components, no inline `style={{}}` unless computing a dynamic value (e.g. a progress bar width). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Theme via CSS variables.** Colors come from `globals.css` tokens — both shadcn tokens (`--background`, `--foreground`, `--primary`, `--destructive`, ...) and app tokens (`--income`, `--expense`, `--warning`, `--pri-crit`, `--pri-imp`, `--pri-opt`, `--pri-flex`). Don't hardcode hex values in components.
- **Dark mode is automatic.** `next-themes` with `attribute="class"` + `defaultTheme="system"`. Every color must resolve through tokens so dark mode works for free. Add a `.dark` variant for every new token.
- **TypeScript strict.** No `any` without a `// TODO:` note and a reason. Prefer `unknown` + narrowing.
- **This is real financial data.** Never silently drop fields on schema changes. Zustand `persist` has a `version` and `migrate` — use them.
- **Remote sync is production-only for writes.** Reads from the Sheets/Apps Script backend are allowed in every environment so dev sessions can hydrate from real data. WRITES (POST/PUT to `/api/budget`, push from `lib/sync.ts`) only fire on Vercel production deployments. Dev / preview / test / local edits stay in Zustand + `localStorage` and never round-trip to Sheets. All environment decisions for this rule must route through `lib/remote-sync-policy.ts` (`canWriteRemote()`) — never inline `process.env.VERCEL_ENV` checks in feature code. Both the client (`lib/sync.ts`) and the server route (`app/api/budget/route.ts`) enforce the rule; the server is the backstop in case a future client bug or a manual `curl PUT` tries to bypass it.

## Base UI gotchas (we use Base UI, not Radix)

`shadcn@latest init -d` landed on style `base-nova` + `@base-ui/react`. The API differs from the Radix variant in a few places — these will bite you if you're pattern-matching from shadcn docs or training data:

- **No `asChild`.** Base UI uses the `render` prop to replace the default element. Pass a JSX element, children flow through:
  ```tsx
  // ❌ Radix pattern — won't compile
  <DropdownMenuTrigger asChild><Button>…</Button></DropdownMenuTrigger>

  // ✅ Base UI pattern
  <DropdownMenuTrigger render={<Button variant="ghost" />}>…</DropdownMenuTrigger>
  ```
  Same applies to `AlertDialogTrigger`, `DialogTrigger`, `TooltipTrigger`, etc.
- **`TooltipProvider` uses `delay` (not `delayDuration`).**
- **Trigger children render inside the outer element produced by `render`.** Put icons/text inside the trigger as children, not inside the rendered element.

If a future task needs `asChild` ergonomics or AI Elements compatibility, switch the base with `pnpm dlx shadcn@latest init -d --base radix -f` and re-add every primitive. Do not mix base libraries.

## React 19 strict-lint rules

`eslint-config-next` for React 19 / Next 16 enforces these — violations are **errors**, not warnings. If you're porting code from older React, watch for:

- **`react-hooks/set-state-in-effect`** — no `useEffect(() => setX(true), [])` mount pattern. Use `useMounted()` from `lib/use-mounted.ts` (built on `useSyncExternalStore`).
- **`react-hooks/immutability`** — don't reassign a closure variable inside `.map()` / inside a component body after render starts. Use `.reduce()` with an accumulator instead. Running-total patterns especially.
- **`react-hooks/refs`** — don't read `ref.current` during render. If a value affects rendering (e.g. drag-source id for styling), it must be `useState`, not `useRef`.

## Data model

State is spread across **three** Zustand stores, each `persist`ed to localStorage. CLAUDE.md previously documented only the first.

| Store | localStorage key | What it holds |
|---|---|---|
| `useBudget` (`lib/store.ts`) | `budget_v1` | Per-budget data (balance, income[], bills[], paid, periods[], activePeriodId, dateRange) **plus** a multi-budget slice (budgets[], activeBudgetId, budgetData{}). All 20+ mutation actions. Persist `version` = `STORE_VERSION` (exported), with a 7-step migration chain. |
| `useUIStore` (`lib/ui-store.ts`) | `dashboard.ui.v1` | Cross-page UI prefs: searchQuery, txTypeFilter, txColumns. |
| `useSavedRanges` (`lib/saved-ranges-store.ts`) | `dashboard.dateRange.savedRanges.v1` | Bookmarked date ranges (capped at 6). |

Types live in `lib/types.ts`:

```ts
type Income          = { id; periodId; source; date; amount; status; cadence?; secondDay?; endDate? };
type Bill            = { id; periodId; name; date; amount; priority; action; tags? };
type IncomeOccurrence = { incomeId; periodId; source; amount; status; cadence; date; key; isRecurring };
type PaidState        = Record<string, boolean>;
type BudgetSnapshot   = { balance; income; bills; paid; periods; activePeriodId; dateRange };
```

IDs: use `uid()` from `lib/format.ts` (wraps `crypto.randomUUID()`, falls back). Dates: ISO `YYYY-MM-DD`. Money: plain `number` in dollars. Seed-data IDs use the `seed-*` prefix.

### `Income.status` vs `paid[occKey]` — two independent axes

Both exist on purpose; don't conflate them.

- **`Income.status`** — `'expected' | 'confirmed' | 'pending' | 'received'`. Per-source *intent*: how confident the user is that this income source will land. Applies to every projected occurrence of a recurring source.
- **`paid[occKey]`** — boolean per occurrence in `PaidState`. Per-occurrence *settlement*: did this specific paycheck actually clear? Keys are `inc_${incomeId}` for one-off and `inc_${incomeId}_${date}` for recurring occurrences (mirror for bills: `bill_${id}`).

Dashboard "confirmed income" tiles read `status`. The Trial Balance ledger reads `paid[occKey]`. Migrations and renames must preserve both axes — never collapse one into the other.

### Derived values

Never store computed totals. Use the helpers in `lib/derived.ts` (or memoized selectors). `lib/badges.ts` is the single source of truth for badge variants; `lib/sort.ts` for table-sort scaffolding.

### Schema changes

Bump `STORE_VERSION` in `lib/store.ts` and add a branch to the `migrate(persistedState, version)` chain. Never rename a field without a migration path. The bumped version automatically flows through `lib/sync.ts` → `/api/budget` PUT → Apps Script envelope, so older clients can't clobber data written by newer ones (Apps Script `doPost` returns 409 `stale schema` to a low-version writer).

## Sync architecture

Local-first. The app works fully offline against the three Zustand stores; remote sync is optional and gated.

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser                                                         │
│   useBudget ──→ useBudgetSync() (lib/sync.ts)                   │
│                   ├─ GET /api/budget on mount                   │
│                   └─ PUT /api/budget on debounced state change  │
│                      (writes are PRODUCTION-ONLY)               │
└────────────────────────────┬────────────────────────────────────┘
                             │ Bearer BUDGET_API_KEY
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Next.js /api/budget (Vercel)                                    │
│   • requireApiKey()        (lib/api-auth.ts)                    │
│   • canWriteRemote()       (lib/remote-sync-policy.ts) — PUT    │
│   • budgetEnvelopeSchema   (lib/ai/schemas.ts) — Zod            │
│   forwards { version, data } to Apps Script                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ ?token=SHEETS_WEBAPP_TOKEN  (query string only;
                             │                              Apps Script can't read headers)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Google Apps Script (Sheet1!A1)                                  │
│   Cell stores { version, data, updatedAt }                      │
│   doPost rejects stale writes (incoming.version < stored)       │
└─────────────────────────────────────────────────────────────────┘
```

**Three layered guards on the write path** — always preserve all three when editing this stack:

1. **Production-only writes.** `canWriteRemote()` in `lib/remote-sync-policy.ts`. Enforced in both `lib/sync.ts` (client) and `app/api/budget/route.ts` PUT (server). Reads are allowed in every environment so dev can hydrate from real data. Never inline `process.env.VERCEL_ENV` checks; always route through the helper.
2. **Bearer-token auth.** `requireApiKey()` in `lib/api-auth.ts`. Reads `BUDGET_API_KEY` env var with a constant-time compare. If unset, auth is disabled (preserves localhost ergonomics) but a production deployment without `BUDGET_API_KEY` set logs a one-time warning. Applied to `/api/budget` GET+PUT and to `/api/ai/*` POST routes.
3. **Schema versioning.** `STORE_VERSION` from `lib/store.ts` is threaded through the envelope (`{ version, data }`). Apps Script `doPost` returns HTTP 409 `stale schema` when an older client tries to overwrite a newer envelope. Client-side, `lib/sync.ts` skips the GET-side import when the remote envelope's `version > STORE_VERSION`.

**Token nuance:** `SHEETS_WEBAPP_TOKEN` is the secret that the Next.js API route uses to call Apps Script (server↔Sheets). `BUDGET_API_KEY` is the secret the client uses to call the Next.js API route (browser↔server). They are different keys with different scopes.

**Apps Script header limitation:** Google Apps Script Web Apps don't expose request headers to `doGet(e)` / `doPost(e)`. Auth must be in the query string. The Next.js route sends the token as both `?token=` and `Authorization: Bearer` so the header path lights up automatically if Google ever adds support.

**Prebuild env check.** `scripts/check-env.mjs` runs as the `prebuild` npm-lifecycle hook. On Vercel production builds it fails fast (exit 1) when `BUDGET_API_KEY` is unset — the only env var without a graceful runtime fallback. Preview and local builds skip the check so contributors don't need the prod secret in their `.env.local`.

## AI plugin layer

AI features are **optional** and **lazy-loaded**. The user-visible default is "AI disabled," and the heavy `@ai-sdk/openai`, `@ai-sdk/react`, and `ai` packages only land in the bundle once AI is actually invoked.

Three layers (in order from cheapest to render-time-most-expensive):

1. **`useAILauncher().status`** (`components/budget/ai/ai-launcher-provider.tsx`) — Boolean-ish state machine: `'unknown' | 'enabled' | 'disabled'`. Resolves async via `/api/ai/status`. Use `useMounted()` to gate any SSR-sensitive rendering that depends on this (or you'll get a hydration mismatch — see the AI section of `settings-view.tsx` for the pattern).
2. **`<AiBoundary>`** (`components/budget/ai/ai-boundary.tsx`) — Wraps children, renders them only when `status === 'enabled'`. Pass `fallback` for a non-null disabled state. This is the **only** way feature code should gate "is AI on?" rendering — don't inline `aiStatus === 'enabled'` ternaries.
3. **`next/dynamic({ ssr: false })`** — `AiChatSheet`, `AiExtractDialog`, and `AiSuggestButton` are imported via `next/dynamic` at three call sites: `ai-launcher-provider.tsx`, `data-controls.tsx`, and `bills-table.tsx`. Combined with `<AiBoundary>`, this means the chunks aren't fetched at all until AI is enabled.

When adding a new AI surface: define it under `components/budget/ai/`, dynamic-import it at the consumer, and wrap the consumer in `<AiBoundary>`.

## Tag conventions

`Bill.tags?: string[]` was added in v8. Normalization rules live in `lib/tags.ts`:

- All tag writes go through `normalizeTag(raw)` — trim + lowercase.
- A bill can carry at most `MAX_TAGS_PER_BILL` (10) tags of at most `MAX_TAG_LENGTH` (24) characters each.
- The `'subscription'` tag is meaningful: bills with it bucket under the collapsible "Subscriptions" group in the bills table. Other tag values are user-driven and have no current behavior beyond display.
- Migrations: any future `Bill` field change that interacts with tags must preserve the existing array. The v8 migration auto-tagged existing bills with `'subscription'` based on a `name.includes(...)` heuristic — that heuristic is no longer used at runtime (it's only documented as the seed of the migration).

## Conventions

- Server Components by default. Add `"use client"` only when a component needs state, effects, or browser APIs (most of `components/budget/*` is client).
- Function components with named exports. No default exports except for `page.tsx` / `layout.tsx` (Next.js requirement).
- Imports: shadcn primitives from `@/components/ui/*`, feature code from `@/components/budget/*`, helpers from `@/lib/*`.
- Money always rendered through `fmt()`; use Tailwind's `tabular-nums` on money cells.
- Zustand selectors: subscribe narrowly (`useBudget((s) => s.bills)`) — never select the whole store, never pull actions via the same selector as state.
- Icons via `lucide-react` at `h-4 w-4`. No emojis.
- No comments unless explaining non-obvious *why*.

## Verification

Before claiming a change is done:

1. `pnpm test` — vitest must be fully green. New pure logic in `lib/` gets a `*.test.ts` next to it.
2. `npx tsc --noEmit` and `pnpm lint` clean.
3. `pnpm build` succeeds.
4. `pnpm dev` and exercise the golden path in a real browser: enter balance → add income → add bill → reorder bills by drag → toggle paid in Trial Balance → confirm Cash Flow + Summary + Trial Balance + Dashboard all update **and agree** on totals (especially with `balance ∈ {-100, 0, +100}` — see the opening-balance invariant in `lib/derived.ts`).
5. Reload. All state (balance, bill order, paid toggles, theme, saved ranges) must survive.
6. Toggle theme light↔dark. Every surface must have readable contrast — no hardcoded colors leaking through.
7. Export JSON, reset, re-import. Lossless round-trip.
8. If you cannot open a browser, say so explicitly. Never fake UI verification. Playwright MCP tools are available — prefer them over curl-only smoke tests for any UI change.

## Agent usage

Use direct tools (Read, Edit, Grep) for most edits. Delegate when it pays off:

- **vercel:shadcn** — first stop for any UI primitive work, theming question, CLI usage, or custom registry setup. Invoke before reaching for other UI libs.
- **vercel:nextjs** — routing, Server vs Client Components, caching, Server Actions, middleware, `page.tsx` / `layout.tsx` patterns.
- **vercel:turbopack** — only if the dev bundler is misbehaving.
- **vercel:vercel-storage** — if/when we add sync across devices (Neon Postgres via Marketplace). Not needed today.
- **vercel:deployments-cicd** / **vercel:vercel-cli** — deployment, preview URLs, env vars.
- **vercel:react-best-practices** — runs automatically after multi-TSX edits. Trust its flags.
- **vercel:verification** — end-to-end flow check when "why isn't this working" comes up.
- **frontend-design** — for distinctive polish passes or a whole-page redesign. Always pass it the palette (shadcn tokens, not hex), the "no emojis, muted, tabular-nums for money" rules, and the prototype HTML as visual reference.
- **feature-dev:code-architect** — before any feature that touches the store schema (categories, recurring bills, multi-period, charts, accounts). Require an edit plan that includes the Zustand `migrate` branch.
- **feature-dev:code-reviewer** *(or* **coderabbit:code-reviewer** *for heavier review)* — after non-trivial edits. Ask it to specifically flag: hardcoded colors bypassing tokens, missing `"use client"` where required, `any` types, stale `PaidState` keys after renames, missing schema migrations, and inline styles that should be Tailwind classes.
- **Explore** — broad codebase searches once the repo grows past a handful of components.
- **general-purpose** — fallback for open-ended research.

### Parallelism

When a task touches both visual and data layers (e.g. "add a categories feature with colored chips"), run `frontend-design` and `feature-dev:code-architect` in a single message so they work their lanes concurrently.

### What agents should NOT do

- Do not replace shadcn primitives with another UI library (Material UI, Chakra, Mantine, HeadlessUI, etc.).
- Do not introduce CSS-in-JS, CSS modules, or a second styling system.
- Do not add a backend/database unless the user explicitly asks — this app is local-first.
- Do not "upgrade" to pages/ router, Vite, or a non-Next framework.
- Do not add telemetry, analytics, or external network calls. The app must work fully offline.
