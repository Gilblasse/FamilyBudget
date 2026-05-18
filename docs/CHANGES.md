# Changes

One bullet per round of the deep-dive fix application. Plan file lives at
`C:\Users\Nethe\.claude\plans\valiant-floating-newt.md` (outside this repo).

## 2026-05-17

- **Round 1 — Shared primitives.** Added `lib/badges.ts` (single `actionVariant`
  / `incomeStatusVariant` / `priorityVariant` returning the same `BadgeVariant`
  union accepted by `components/ui/badge.tsx`; resolves the prior disagreement
  where `bills-table.tsx` returned `'default'` for `pay-full` and `summary.tsx`
  returned `'success'` — consensus is `'success'`). Added `lib/sort.ts`
  (generic `SortState<TCol>`, `nextDir`, `dirFor`, `applySort`) replacing three
  hand-copied scaffolds. Added `lib/derived.ts` (`openingBalanceEntry`,
  `endingBalance`, `isReceivedIncome`, `isImportantBill`, `isActiveBill`,
  `pendingIncomeCount`, `isPaid`, `criticalUnpaidBills`,
  `confirmedIncomeTotal`) — `openingBalanceEntry` returns a row for any
  non-zero balance, fixing the bug where negative balances were silently
  dropped from cash-flow timeline and trial-balance ledger. Extended
  `lib/ai/schemas.ts` with `budgetSnapshotSchema` (canonical Zod schema)
  replacing the duck-typed `z.custom` checks in the AI routes. Full test
  coverage for each new module.
- **Round 1 — Earlier in this session.** Centralized the production-only
  remote-write policy in `lib/remote-sync-policy.ts` and routed
  `lib/sync.ts` + `app/api/budget/route.ts` through it. Added
  `lib/remote-sync-policy.test.ts`. Documented the hard rule in CLAUDE.md
  and the apps-script README.
- **Round 2 — Correctness P0 (two parallel agents).**
  *Agent A — opening balance.* Unified opening-balance handling: every
  running-total view now uses `openingBalanceEntry(balance, openingDate)`
  + `endingBalance({...})` from `lib/derived.ts`. Negative balances
  (overdraft) and zero balances are no longer silently dropped from the
  cash-flow timeline or trial-balance ledger. Removed the magic-literal
  `'2026-04-09'` fallback in `trial-balance.tsx` (now `todayIso()`).
  Added consistency tests across balance ∈ {−100, 0, +100}. Test count
  101 → 104.
  *Agent B — API hardening.* Added `lib/api-auth.ts` with a constant-time
  `Bearer BUDGET_API_KEY` guard, applied to `/api/budget` GET+PUT and
  `/api/ai/chat` + `/api/ai/advise` POST. Replaced the duck-typed
  `z.custom<BudgetSnapshot>` checks across those routes with
  `budgetSnapshotSchema`. The Next.js → Apps Script upstream fetch now
  sends `Authorization: Bearer <SHEETS_WEBAPP_TOKEN>` alongside the
  legacy `?token=` query string. Test count 104 → 110.
- **Round 3 — Component refactors (two parallel agents).**
  *Agent C — budget components dedup.* Removed local `actionVariant`,
  `statusVariant`, `SortState`, `SortCol`, `nextDir`, `dirFor` from
  `bills-table.tsx`, `income-table.tsx`, `summary.tsx`. They now import
  the shared helpers from `lib/badges.ts` + `lib/sort.ts` and use
  `applySort()`. Inline `isActiveBill` / `isImportantBill` /
  `isReceivedIncome` predicates from `lib/derived.ts`. Deleted dead
  `components/budget/balance-card.tsx` (no live imports). Behaviour-
  preserving except for the intentional `pay-full` badge variant change
  (`'default'` → `'success'`) — the resolution to the disagreement the
  deep-dive flagged.
  *Agent D — dashboard + shell dedup.* `transaction-history.tsx` no
  longer carries its own `incomeStatusVariant`. `balance-overview-card.tsx`
  uses `isReceivedIncome` + `isActiveBill`. `coverage-card.tsx` uses
  `isReceivedIncome`. `app-sidebar.tsx` uses `pendingIncomeCount`.
  Two semantic mismatches were intentionally left inline (`unpaidImportant`
  in the sidebar excludes skip/delay differently than `criticalUnpaidBills`;
  `expense-overview-card.tsx`'s unpaid-critical logic likewise differs).
  No behaviour change, no new tests, count stays at 110.
- **Round 4 — Apps Script + docs.** Added `STORE_VERSION` export to
  `lib/store.ts`. Added `budgetEnvelopeSchema` to `lib/ai/schemas.ts`.
  `/api/budget` PUT now validates an envelope (`{ version?, data }`) and
  forwards `{ version, data }` upstream; GET returns
  `{ version, data, updatedAt }`. `lib/sync.ts` sends `STORE_VERSION` on
  PUT and skips the GET-side import when the remote envelope is from a
  newer client. `apps-script/Code.gs` rewritten with the versioned
  envelope and a stale-write rejection (`{ error: 'stale schema',
  storedVersion, incomingVersion }`, surfaced as HTTP 409 from the
  Next.js route). README corrected: Apps Script Web Apps cannot read
  request headers, so the query-string token is the canonical auth path
  (the Bearer header on the upstream fetch is forward-compat). CLAUDE.md
  rewrote the Project layout, Data model, and Verification sections;
  added a new Sync architecture section diagramming the three guard
  layers (production-only writes, Bearer auth, envelope version); added
  a new "`Income.status` vs `paid[occKey]` — two independent axes"
  invariant section.

- **Round 11 — Repass + visual check.**
  *Audit findings + code repass.* Spawned an Explore agent for a fresh
  read of the codebase after Rounds 1-10. Live visual check ran in
  parallel via Playwright at desktop + dark + mobile breakpoints.
  *11-A — auth gap closed.* `/api/ai/classify` and `/api/ai/extract`
  were missing the `requireApiKey` guard that the other AI routes
  picked up in Round 2. Real cost-of-abuse window (unauthenticated
  OpenAI requests). Added the guard.
  *11-B — hydration mismatch on settings.* The visual check surfaced a
  console error: `AISection` rendered `<Badge variant="neutral">Checking…</Badge>`
  on the server and `<Badge variant="success"><CircleCheck/></Badge>`
  on the client because `useAIStatusInfo` resolved synchronously from a
  cache. Gated behind `useMounted()` so the server and first client
  render both show "Checking…", then the real status flips in post-
  mount.
  *11-C — CLAUDE.md drift.* The Round 4 rewrite predated Rounds 5-10.
  Added: `Bill.tags?` to the type sketch; `lib/tags.ts` to the project
  layout; new "AI plugin layer" section documenting the
  `useAILauncher` / `<AiBoundary>` / `next/dynamic` three layers and
  when to use each; new "Tag conventions" section with the
  normalization rules; prebuild env-check note in Sync architecture.
  *11-D — small cleanup.* Extracted `normalizeTag` from
  `bills-table.tsx` into the new `lib/tags.ts` alongside
  `MAX_TAGS_PER_BILL` and `MAX_TAG_LENGTH` constants. Kept
  `priorityVariant` in `lib/badges.ts` for API symmetry (audit flagged
  it as unused; left in place because the trio reads more cleanly).
- **Round 10 — Tail cleanup.**
  *10-A — Substring fallback gone.* Now that the tag-edit UI ships
  (Round 9-A) and the v8 migration tagged every persisted subscription
  bill, the `b.name.toLowerCase().includes('subscription')` fallback in
  `bills-table.tsx`'s bucket logic is dead weight that would also
  mis-bucket bills like "Subscription cancellation fee." Removed.
  *10-B — Prebuild env check.* Added `scripts/check-env.mjs` and a
  `prebuild` script entry in `package.json`. On Vercel production
  builds it fails fast (exit 1, readable error) when `BUDGET_API_KEY`
  is unset. Preview and local builds skip the check so contributors
  don't need the prod secret in `.env.local`. The motivating risk is
  the `/api/ai/*` cost-of-abuse window (unauthenticated AI requests
  burn OpenAI quota); the GET `/api/budget` data-leak is a secondary
  concern mitigated somewhat by the URL being non-public.
- **Round 9 — Tag-edit UI + AI code-splitting.**
  *9-A — Tag-edit UI for bills.* Added a `TagsButton` (Popover + chip
  list + free-form input, max 10 tags × 24 chars per tag, normalized
  lower-case, deduped) to `bills-table.tsx`. Lives in the actions cell
  on desktop and in the top action row of `BillCard` on mobile. The
  trigger shows a count badge when the bill has tags. Kept the
  substring fallback in the subscription bucket for bills imported
  from external JSON that haven't been tagged yet.
  *9-B — `next/dynamic` for AI components.* Replaced the static imports
  of `AiChatSheet` (in `ai-launcher-provider.tsx` and `data-controls.tsx`),
  `AiExtractDialog` (in `data-controls.tsx`), and `AiSuggestButton` (in
  `bills-table.tsx`) with `next/dynamic({ ssr: false })` wrappers.
  The launcher provider also gates its sheet on
  `status === 'enabled'` so even the chunk request doesn't fire when AI
  is off. The data-controls Sheet+Dialog wrap is now inside
  `<AiBoundary>`. Combined, `@ai-sdk/openai`, `@ai-sdk/react`, and `ai`
  are now in lazy chunks instead of the initial bundle for users
  without a configured OpenAI key.
- **Round 8 — P3-A (multi-budget UI) + P3-B (AiBoundary), two parallel agents.**
  *Agent E — `<AiBoundary>` rollout.* New
  `components/budget/ai/ai-boundary.tsx` wraps children only when
  `useAILauncher().status === 'enabled'` (optional `fallback`).
  Replaced inline `aiStatus === 'enabled' ? … : null` checks in
  `summary.tsx` (the "Get suggestions" CTA) and removed the inline
  `useAIStatus` gate from `ai-suggest-button.tsx`, moving the gate to
  the call sites — `bills-table.tsx` now wraps both `<AiSuggestButton>`
  call sites in `<AiBoundary>`. Conservatively left
  `ai-launcher-button.tsx` and the AI sheet/panel/dialog trio alone:
  the former has a separate `unknown`-status skeleton that
  `<AiBoundary>` would have eaten, and the latter three use a different
  hook (`useAIStatus`) and are mounted by the launcher provider — a
  self-referential context dependency to avoid.
  *Agent F — Multi-budget UI surface.* Sidebar's
  `sidebar-budget-switcher.tsx` and its wire-up in `app-sidebar.tsx`
  turned out to already be implemented but had been undocumented in
  CLAUDE.md. Added a new `BudgetsSection` to `settings-view.tsx` between
  Data and Periods: list of budgets (name, default range via `fdRange`,
  income + bill counts derived from active state for the active budget
  and from `budgetData[id]` snapshots for inactive ones), "Active"
  badge, inline rename via Pencil icon → Dialog, delete via Trash icon
  → AlertDialog (hidden when only one budget exists, so the last one
  can't be removed), "Add budget" Dialog with name + start/end
  DatePickers. Mirrors the existing PeriodSection pattern.
- **Round 7 — P2-E (Income.endDate UI).** Surfaced the optional
  `Income.endDate` field in `components/budget/income-table.tsx` (both
  desktop table and mobile card layout). Only renders when the source's
  cadence is recurring (≠ `'once'`). Clearing the input maps to
  `endDate: undefined`. Uses a native `<Input type="date">` rather than
  a custom DatePicker — empty-string handling is universal.
- **Round 6 — P2-F (`Bill.tags`) + P3-C (migration integration test).**
  Added `Bill.tags?: string[]` to `lib/types.ts`. Extracted the persist
  `migrate` function from inside `lib/store.ts`'s persist config to a
  top-level `migrateBudgetState(raw, fromVersion)` export so it can be
  unit-tested without spinning up Zustand. Bumped `STORE_VERSION` 7 → 8
  with a `< 8` branch that tags every existing bill whose `name` contains
  `'subscription'` with `tags: ['subscription']`. Seed bill
  `seed-b15` ("Subscriptions (half)") got the tag too. Updated
  `billSchema` in `lib/ai/schemas.ts`. `bills-table.tsx`'s subscription
  bucket now reads `tags?.includes('subscription')` first, falls back to
  the substring match (for untagged bills imported externally). New
  `lib/migrate.test.ts` covers the full v1 → v8 chain plus idempotence
  and null-input handling. Test count 110 → 122 (+12).
- **Round 5 — P2 polish.**
  *P2-A.* Added `app/(app)/settings/loading.tsx` and
  `app/(app)/help-center/loading.tsx` for skeleton parity with the
  other routes in the group.
  *P2-B.* No-op: the deep-dive flagged `@custom-variant dark
  (&:is(.dark *))` in `globals.css` as unused, but it is in fact the
  Tailwind v4 directive that defines the `dark:` variant for every
  utility class in the codebase. Removing it would break dark mode
  globally. Left as-is.
  *P2-C.* Unified date parsing in `components/budget/cash-flow.tsx`:
  removed the local `parseUtc` / `todayUtcKey` helpers (UTC-based) and
  routed through `fromIso` / `todayIso` from `lib/date-utils.ts`
  (local-time). Updated `cash-flow-timeline.tsx`'s `dayKey` to use
  `toIso` so its formatter matches. Closes the DST-edge drift between
  cash-flow and the rest of the app.
  *P2-D.* `useBudget.addBill()` and `addIncome()` now return the new
  row's `string` id. Rewired six call sites that previously read the
  freshly-added row via `useBudget.getState().X.at(-1)` (a race under
  fast double-tap): `components/budget/bills-table.tsx` undo,
  `income-table.tsx` undo, `ai/ai-chat-sheet.tsx` (addBill +
  addIncome tools), `ai/ai-extract-panel.tsx` (bill + income extract).

