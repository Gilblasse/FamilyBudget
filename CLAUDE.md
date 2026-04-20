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
  layout.tsx          # ThemeProvider, TooltipProvider, Toaster, Geist fonts, metadata
  page.tsx            # Thin server component → <BudgetApp />
  globals.css         # Tailwind + shadcn tokens + app tokens (income, expense, warning, pri-*)
components/
  ui/                 # shadcn primitives — added via CLI, edit in place if needed
  theme-provider.tsx  # next-themes wrapper
  theme-toggle.tsx    # Light / Dark / System dropdown
  budget/
    budget-app.tsx    # Client root — composes BalanceCard + Tabs + DataControls
    balance-card.tsx  # Current balance input
    income-table.tsx  # Income CRUD + metrics
    bills-table.tsx   # Bills CRUD with HTML5 drag reorder + metrics
    cash-flow.tsx     # Day-by-day timeline, balance bars, running totals
    trial-balance.tsx # Running ledger with paid/received toggles
    summary.tsx       # Coverage check + priority-sorted table
    data-controls.tsx # Import / Export / Reset (AlertDialog)
    metric.tsx        # Small stat card primitive
    priority-dot.tsx  # Colored dot by Priority
lib/
  store.ts            # Zustand store + persist (key: budget_v1, version: 1)
  types.ts            # Income, Bill, PaidState, Priority, BillAction + label maps
  format.ts           # fmt(), fd(), uid()
  seed.ts             # DEFAULT_INCOME, DEFAULT_BILLS seed data
  use-mounted.ts      # useSyncExternalStore-based SSR-safe mount flag
  utils.ts            # cn() from shadcn
```

Keep feature code in `components/budget/`. Never put shadcn-modified primitives there — if a primitive needs changes, edit it in `components/ui/` directly (that is the shadcn pattern: you own the code).

## Hard constraints

- **shadcn CLI, always.** Add primitives via `pnpm dlx shadcn@latest add <name>`. Never hand-write a Button, Dialog, Select, etc. If it exists in shadcn, install it.
- **Tailwind only for styling.** No CSS modules, no styled-components, no inline `style={{}}` unless computing a dynamic value (e.g. a progress bar width). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Theme via CSS variables.** Colors come from `globals.css` tokens — both shadcn tokens (`--background`, `--foreground`, `--primary`, `--destructive`, ...) and app tokens (`--income`, `--expense`, `--warning`, `--pri-crit`, `--pri-imp`, `--pri-opt`, `--pri-flex`). Don't hardcode hex values in components.
- **Dark mode is automatic.** `next-themes` with `attribute="class"` + `defaultTheme="system"`. Every color must resolve through tokens so dark mode works for free. Add a `.dark` variant for every new token.
- **TypeScript strict.** No `any` without a `// TODO:` note and a reason. Prefer `unknown` + narrowing.
- **This is real financial data.** Never silently drop fields on schema changes. Zustand `persist` has a `version` and `migrate` — use them.

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
  // actions: setBalance, addIncome/updateIncome/removeIncome, addBill/updateBill/removeBill,
  // reorderBill, togglePaid, importData, resetAll, exportJson
}
```

IDs: use `uid()` from `lib/format.ts` (wraps `crypto.randomUUID()`, falls back on non-browser envs). Dates: ISO strings (`YYYY-MM-DD`). Money: plain `number` in dollars (not cents — legacy parity with the prototype; revisit only if rounding bugs appear). Seed-data IDs use the `seed-*` prefix; never collide with those.

### Derived values

Never store computed totals. Derive inside selectors or memoized hooks (`useMemo` + narrow Zustand selectors). Examples: running balance, net position, coverage check, timeline grouping.

### Schema changes

Bump `version` in the Zustand `persist` config and write a `migrate(persistedState, version)` branch. Never rename a field without a migration path.

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

1. `npx tsc --noEmit` and `pnpm lint` clean.
2. `pnpm build` succeeds.
3. `pnpm dev` and exercise the golden path in a real browser: enter balance → add income → add bill → reorder bills by drag → toggle paid in Trial Balance → confirm Cash Flow + Summary + Trial Balance all update.
4. Reload. All state (balance, bill order, paid toggles, theme) must survive.
5. Toggle theme light↔dark. Every surface must have readable contrast — no hardcoded colors leaking through.
6. Export JSON, reset, re-import. Lossless round-trip.
7. If you cannot open a browser, say so explicitly. Never fake UI verification. Playwright MCP tools are available — prefer them over curl-only smoke tests for any UI change.

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
