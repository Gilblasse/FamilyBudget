# Family Budget

Personal irregular-income budget planner. Tracks income vs bills across a pay period with a running trial-balance ledger, cash-flow timeline, and paid/unpaid toggles. Single-user, works offline, deploys to Vercel.

## Stack

- **Next.js 16** App Router + React Server Components
- **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)
- **Zustand** with `persist` middleware → `localStorage` for state
- **next-themes** for light/dark
- **pnpm** as the package manager
- **Vercel** for deployment (Fluid Compute defaults; no custom infra)

The previous prototype (`irregular_income_plan_with_balance_new_1.html`) is the visual + behavioral reference. Port its logic to components, but do not copy the inline CSS — use Tailwind + shadcn tokens instead.

## Project layout

```
app/
  layout.tsx          # ThemeProvider, font, metadata
  page.tsx            # Main budget view (thin server component → client root)
  globals.css         # Tailwind + shadcn CSS variables only
components/
  ui/                 # shadcn primitives — added via CLI, never hand-edited
  budget/             # Feature components (IncomeTable, BillsTable, TrialBalance, CashFlow, Summary)
lib/
  store.ts            # Zustand store + persist middleware (key: budget_v1)
  format.ts           # fmt(), fd(), money + date helpers
  types.ts            # Income, Bill, PaidState, Priority, Action unions
```

Keep feature components under `components/budget/`. Never put shadcn-modified components there — if a primitive needs changes, edit it in `components/ui/` directly (that is the shadcn pattern: you own the code).

## Hard constraints

- **shadcn CLI, always.** Add primitives via `pnpm dlx shadcn@latest add <name>`. Never hand-write a Button, Dialog, Select, etc. If it exists in shadcn, install it.
- **Tailwind only for styling.** No CSS modules, no styled-components, no inline `style={{}}` unless computing a dynamic value (e.g. a progress bar width). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Theme via CSS variables.** Colors come from `globals.css` tokens (`--background`, `--foreground`, `--primary`, `--destructive`, etc.). Don't hardcode hex values in components.
- **Dark mode is automatic.** `next-themes` with `attribute="class"` + `defaultTheme="system"`. Every color must resolve through shadcn tokens so dark mode works for free.
- **TypeScript strict.** No `any` without a `// TODO:` note and a reason. Prefer `unknown` + narrowing.
- **This is real financial data.** Never silently drop fields on schema changes. Zustand persist has a `version` and `migrate` — use them.

## Data model

All state lives in a single Zustand store persisted to `localStorage` under key `budget_v1`:

```ts
type Income = { id: string; source: string; date: string; amount: number; status: 'expected'|'confirmed'|'pending'|'received' };
type Bill   = { id: string; name: string; date: string; amount: number; priority: 'crit'|'imp'|'opt'|'flex'; action: 'pay-full'|'partial'|'delay'|'reduce'|'skip' };
type PaidState = Record<string, boolean>; // keys: `inc_${id}` | `bill_${id}`

interface BudgetState {
  balance: number;
  income: Income[];
  bills: Bill[];
  paid: PaidState;
  // actions: addIncome, updateIncome, removeIncome, addBill, ..., togglePaid, resetAll, importJson, exportJson
}
```

IDs: use `crypto.randomUUID()`. Dates: ISO strings (`YYYY-MM-DD`). Money: plain `number` in dollars (not cents — legacy parity with the prototype; revisit only if rounding bugs appear).

### Derived values

Never store computed totals. Derive inside selectors or memoized hooks (`useMemo` + narrow Zustand selectors). Examples: running balance, net position, coverage check, timeline grouping.

### Schema changes

Bump `version` in the Zustand `persist` config and write a `migrate(persistedState, version)` branch. Never rename a field without a migration path.

## Conventions

- Server Components by default. Add `"use client"` only when a component needs state, effects, or browser APIs (most of `components/budget/*` will be client).
- Function components with named exports. No default exports except for `page.tsx` / `layout.tsx` (Next.js requirement).
- Imports: shadcn primitives from `@/components/ui/*`, feature code from `@/components/budget/*`, helpers from `@/lib/*`.
- Money always rendered through `fmt()`; use `tabular-nums` (Tailwind `tabular-nums` utility) on money cells.
- Icons via `lucide-react` (shadcn default). No emojis.
- No comments unless explaining non-obvious *why*.

## Verification

Before claiming a change is done:

1. `pnpm typecheck` and `pnpm lint` clean.
2. `pnpm dev` and exercise the golden path in a real browser: enter balance → add income → add bill → reorder bills → toggle paid → confirm Cash Flow + Summary + Trial Balance all update.
3. Reload. State must survive.
4. Toggle OS theme light↔dark. Every surface must have readable contrast — no hardcoded colors leaking through.
5. Export JSON, reset, re-import. Lossless round-trip.
6. `pnpm build` succeeds.
7. If you cannot open a browser, say so explicitly. Never fake UI verification.

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
