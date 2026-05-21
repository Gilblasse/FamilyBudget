# Prototype data reference

Everything in `C:/Users/Nethe/Downloads/budget.jsx`'s `DEFAULT_DATA`, plus the family-budget-shaped translation that `scripts/seed-prod-template.mjs` wrote to prod on 2026-05-21.

---

## 1. Prototype `DEFAULT_DATA` (verbatim from budget.jsx, lines 51-101)

The prototype's "irregular-budget-v4" starter data. All fields blank — it's a clean canvas the user fills in. Note the prototype has its own loose shape (`planned`, `adjustment`, `spent`, `actual`, `date` all strings) that does **not** match family-budget's strict types.

### Top-level fields

| Field | Value |
|---|---|
| `monthLabel` | `'This Month'` |
| `startingBalance` | `''` (empty string) |

### Income (4 entries)

| id | name | planned | adjustment | actual | date |
|---|---|---|---|---|---|
| `i1` | Paycheck 1 | `''` | `[]` | `''` | `''` |
| `i2` | Paycheck 2 | `''` | `[]` | `''` | `''` |
| `i3` | Paycheck 3 | `''` | `[]` | `''` | `''` |
| `i4` | Paycheck 4 | `''` | `[]` | `''` | `''` |

### Categories (10 categories → 19 line items)

| Category id | Category name | Items (id · name) |
|---|---|---|
| `housing` | Housing | `h1` Rent / Mortgage · `h2` HOA Fees |
| `transportation` | Transportation / Gas | `t1` Gas |
| `food` | Food | `f1` Groceries · `f2` Restaurants |
| `utilities` | Utilities | `u1` Electricity · `u2` Water |
| `giving` | Giving | `g1` Tithe / Charity |
| `saving` | Saving | `s1` Emergency Fund |
| `debt` | Debt | `d1` Student Loans · `d2` Car Payments · `d3` Medical · `d4` Credit Cards |
| `insurance` | Insurance | `in1` Auto · `in2` Renter's · `in3` Term Life · `in4` Health |
| `misc` | Miscellaneous | `m1` Other |
| `fun` | Fun Money | `fu1` Entertainment |

Each item has the same shape as income: `planned: ''`, `adjustment: []`, `spent: ''`, `date: ''`.

**Totals**: 4 income · 19 bills · 10 categories.

### Raw JSON (the prototype's `DEFAULT_DATA` object, faithful to source)

```json
{
  "monthLabel": "This Month",
  "startingBalance": "",
  "income": [
    { "id": "i1", "name": "Paycheck 1", "planned": "", "adjustment": [], "actual": "", "date": "" },
    { "id": "i2", "name": "Paycheck 2", "planned": "", "adjustment": [], "actual": "", "date": "" },
    { "id": "i3", "name": "Paycheck 3", "planned": "", "adjustment": [], "actual": "", "date": "" },
    { "id": "i4", "name": "Paycheck 4", "planned": "", "adjustment": [], "actual": "", "date": "" }
  ],
  "categories": [
    { "id": "housing", "name": "Housing", "items": [
      { "id": "h1", "name": "Rent / Mortgage", "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "h2", "name": "HOA Fees",         "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "transportation", "name": "Transportation / Gas", "items": [
      { "id": "t1", "name": "Gas", "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "food", "name": "Food", "items": [
      { "id": "f1", "name": "Groceries",   "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "f2", "name": "Restaurants", "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "utilities", "name": "Utilities", "items": [
      { "id": "u1", "name": "Electricity", "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "u2", "name": "Water",       "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "giving", "name": "Giving", "items": [
      { "id": "g1", "name": "Tithe / Charity", "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "saving", "name": "Saving", "items": [
      { "id": "s1", "name": "Emergency Fund", "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "debt", "name": "Debt", "items": [
      { "id": "d1", "name": "Student Loans", "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "d2", "name": "Car Payments",  "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "d3", "name": "Medical",       "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "d4", "name": "Credit Cards",  "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "insurance", "name": "Insurance", "items": [
      { "id": "in1", "name": "Auto",      "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "in2", "name": "Renter's",  "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "in3", "name": "Term Life", "planned": "", "adjustment": [], "spent": "", "date": "" },
      { "id": "in4", "name": "Health",    "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "misc", "name": "Miscellaneous", "items": [
      { "id": "m1", "name": "Other", "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]},
    { "id": "fun", "name": "Fun Money", "items": [
      { "id": "fu1", "name": "Entertainment", "planned": "", "adjustment": [], "spent": "", "date": "" }
    ]}
  ]
}
```

---

## 2. Family-budget translation (what landed in prod on 2026-05-21)

The script can't write the prototype's shape directly — family-budget's schema requires `amount` (number), `date` (ISO), `status`, `cadence`, `priority`, `action`. Here's the mapping it applied. Category id becomes the bill's first tag, which is what drives the tag-grouping buckets in `bills-table.tsx`.

### Budget + period

Reused from your existing prod active budget — the template lands into the same workspace, so context is preserved.

| Field | Value |
|---|---|
| `activeBudgetId` | `dd74bb75-6e22-450f-b681-530620c4be4e` |
| Budget name | `May to June` |
| `activePeriodId` | (matched the budget's `active_period_id` in prod) |
| Period range | `2026-05-11 → 2026-06-10` |
| Anchor date for every row | `2026-05-11` |
| `balance` | `0` |
| `paid` | `{}` (cleared) |
| `dateRange` | `null` |

### Income (4 rows)

Every row: `amount: 0`, `date: 2026-05-11`, `status: expected`, `cadence: once`, fresh UUID id.

| source |
|---|
| Paycheck 1 |
| Paycheck 2 |
| Paycheck 3 |
| Paycheck 4 |

### Bills (19 rows)

Every row: `amount: 0`, `date: 2026-05-11`, `action: pay-full`, fresh UUID id, single-element `tags` array.

| Bill name | priority | tags |
|---|---|---|
| Rent / Mortgage | crit | `["housing"]` |
| HOA Fees | crit | `["housing"]` |
| Gas | imp | `["transportation"]` |
| Groceries | imp | `["food"]` |
| Restaurants | imp | `["food"]` |
| Electricity | crit | `["utilities"]` |
| Water | crit | `["utilities"]` |
| Tithe / Charity | opt | `["giving"]` |
| Emergency Fund | opt | `["saving"]` |
| Student Loans | crit | `["debt"]` |
| Car Payments | crit | `["debt"]` |
| Medical | crit | `["debt"]` |
| Credit Cards | crit | `["debt"]` |
| Auto | crit | `["insurance"]` |
| Renter's | crit | `["insurance"]` |
| Term Life | crit | `["insurance"]` |
| Health | crit | `["insurance"]` |
| Other | opt | `["misc"]` |
| Entertainment | opt | `["fun"]` |

### Priority assignment rules

The prototype has no priority field; family-budget requires one. The script assigns:

- **crit**: housing, utilities, debt, insurance (mandatory bills)
- **imp**: transportation, food (very important but flexible amounts)
- **opt**: giving, saving, misc, fun (discretionary)

### Tag-grouping behavior

`bills-table.tsx:149-184` collapses any tag with **≥2 bills** into a bucket. With this template:

- **Buckets** (collapsible): Housing (2), Food (2), Utilities (2), Debt (4), Insurance (4)
- **Flat rows**: Gas, Tithe / Charity, Emergency Fund, Other, Entertainment

---

## 3. Round-trip note

If you want to re-apply this template later (or to another budget):

- Source of truth: `scripts/seed-prod-template.mjs` constants at lines 14–29.
- The script always reads the current active budget + period and reuses their ids/dates, so re-running it against a different prod budget would land the template *there* without touching others.
- Pre-write backup is always emitted to repo root as `prod-backup-<timestamp>.json` (gitignored).

## 4. Rollback path

If you want to undo the 2026-05-21 write and restore your real data (Apr 15 paycheck, Kia Telluride, etc.):

1. Open the deployed app.
2. Sidebar → **Import budget JSON**.
3. Drag in `prod-backup-2026-05-21T00-52-35-814Z.json` (in the repo root).
4. Confirm. The pre-write state is restored.
