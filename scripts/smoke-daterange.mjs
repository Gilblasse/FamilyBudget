// Smoke test for the setDateRange / resetDateRange / dedupeAll fix.
// Drives the dev server at localhost:3000 (which is pointed at the local
// Supabase via .env.development.local) and verifies that:
//   1. POST /api/budget/budgets creates a budget row.
//   2. PATCH /api/budget/meta { activeBudgetId } activates it.
//   3. PATCH /api/budget/meta { dateRange } writes date_range_start/end.
//   4. PATCH /api/budget/meta { dateRange: null } clears them.
// This is the exact server path the new install-remote-actions wrappers fire.

const BASE = 'http://localhost:3000';

async function j(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function main() {
  // 1. Create a budget via POST /api/budget/budgets.
  const budgetId = 'smoke-budget-1';
  const create = await j('POST', '/api/budget/budgets', {
    id: budgetId,
    name: 'Smoke',
    createdAt: new Date().toISOString(),
    defaultRange: { start: '2026-05-01', end: '2026-05-31' },
  });
  console.log('POST /api/budget/budgets ->', create.status, JSON.stringify(create.body));
  if (create.status !== 200) process.exit(1);

  // 2. Activate it.
  const activate = await j('PATCH', '/api/budget/meta', { activeBudgetId: budgetId });
  console.log('PATCH meta { activeBudgetId } ->', activate.status, JSON.stringify(activate.body));
  if (activate.status !== 200) process.exit(1);

  // 3. Set a dateRange.
  const setRange = await j('PATCH', '/api/budget/meta', {
    dateRange: { start: '2026-05-10', end: '2026-05-25' },
  });
  console.log('PATCH meta { dateRange } ->', setRange.status, JSON.stringify(setRange.body));
  if (setRange.status !== 200) process.exit(1);

  // 4. Confirm via GET /api/budget/meta.
  const readSet = await j('GET', '/api/budget/meta');
  console.log('GET meta ->', readSet.status, JSON.stringify(readSet.body));
  if (
    readSet.body.dateRange?.start !== '2026-05-10' ||
    readSet.body.dateRange?.end !== '2026-05-25'
  ) {
    console.error('FAIL: dateRange did not persist');
    process.exit(1);
  }

  // 5. Reset to null (the resetDateRange path).
  const reset = await j('PATCH', '/api/budget/meta', { dateRange: null });
  console.log('PATCH meta { dateRange: null } ->', reset.status, JSON.stringify(reset.body));
  if (reset.status !== 200) process.exit(1);

  const readCleared = await j('GET', '/api/budget/meta');
  console.log('GET meta (cleared) ->', readCleared.status, JSON.stringify(readCleared.body));
  if (readCleared.body.dateRange !== null) {
    console.error('FAIL: dateRange did not clear');
    process.exit(1);
  }

  // 6. Cleanup: delete the smoke budget.
  await j('DELETE', `/api/budget/budgets/${budgetId}`);
  await j('PATCH', '/api/budget/meta', { activeBudgetId: '' }).catch(() => {});

  console.log('\nALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('crash:', err);
  process.exit(1);
});
