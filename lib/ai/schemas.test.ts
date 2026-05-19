import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  budgetSnapshotSchema,
  budgetPeriodSchema,
  incomeSchema,
  billSchema,
  classifyResponseSchema,
  extractResponseSchema,
  adviseResponseSchema,
} from './schemas';

describe('budgetSnapshotSchema', () => {
  const EMPTY_SNAPSHOT = {
    balance: 0,
    income: [],
    bills: [],
    paid: {},
    periods: [],
    activePeriodId: '',
    dateRange: null,
    budgets: [],
    activeBudgetId: '',
    budgetData: {},
  };

  it('accepts an empty-state snapshot with empty activePeriodId and activeBudgetId', () => {
    const res = budgetSnapshotSchema.safeParse(EMPTY_SNAPSHOT);
    expect(res.success).toBe(true);
  });

  it('accepts a snapshot with empty activePeriodId but populated activeBudgetId', () => {
    const res = budgetSnapshotSchema.safeParse({
      ...EMPTY_SNAPSHOT,
      activeBudgetId: 'budget-default',
    });
    expect(res.success).toBe(true);
  });

  it('accepts a snapshot with empty activeBudgetId but populated activePeriodId', () => {
    const res = budgetSnapshotSchema.safeParse({
      ...EMPTY_SNAPSHOT,
      activePeriodId: 'seed-period-1',
    });
    expect(res.success).toBe(true);
  });

  it('still rejects an empty id on a contained budget period (regression guard)', () => {
    const res = budgetPeriodSchema.safeParse({
      id: '',
      startDate: '2026-04-09',
      endDate: '2026-05-14',
    });
    expect(res.success).toBe(false);
  });

  it('still rejects an empty id on a contained income row (regression guard)', () => {
    const res = incomeSchema.safeParse({
      id: '',
      periodId: 'p1',
      source: 'Paycheck',
      date: '2026-04-15',
      amount: 100,
      status: 'expected',
    });
    expect(res.success).toBe(false);
  });

  it('still rejects an empty id on a contained bill row (regression guard)', () => {
    const res = billSchema.safeParse({
      id: '',
      periodId: 'p1',
      name: 'Rent',
      date: '2026-05-01',
      amount: 100,
      priority: 'crit',
      action: 'pay-full',
    });
    expect(res.success).toBe(false);
  });
});

// OpenAI's structured outputs (response_format) run in strict mode:
//  - `oneOf` is rejected (use `anyOf` instead — z.union over z.discriminatedUnion).
//  - Every property on an object must appear in `required` (no `.optional()`).
//  - Objects must have `additionalProperties: false`.
// Any schema we pass to `generateText({ output: Output.object({ schema }) })`
// has to clear all three. This block fails loudly the moment someone
// reintroduces a forbidden shape.
type JsonSchemaNode = Record<string, unknown>;

function findStrictModeViolations(root: unknown): string[] {
  const violations: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as JsonSchemaNode;

    if (Array.isArray(obj.oneOf)) {
      violations.push(`${path || '<root>'}: contains oneOf (use anyOf / z.union)`);
    }

    if (obj.type === 'object') {
      const props = (obj.properties ?? {}) as Record<string, unknown>;
      const propKeys = Object.keys(props);
      const required = (obj.required ?? []) as string[];
      const missing = propKeys.filter((k) => !required.includes(k));
      if (missing.length > 0) {
        violations.push(
          `${path || '<root>'}: properties missing from required: ${missing.join(', ')}`,
        );
      }
      if (obj.additionalProperties !== false) {
        violations.push(
          `${path || '<root>'}: additionalProperties must be false (got ${JSON.stringify(obj.additionalProperties)})`,
        );
      }
    }

    for (const child of ['properties', 'patternProperties', '$defs', 'definitions'] as const) {
      const bag = obj[child] as Record<string, unknown> | undefined;
      if (bag && typeof bag === 'object') {
        for (const [k, v] of Object.entries(bag)) {
          visit(v, `${path}.${child}.${k}`);
        }
      }
    }
    for (const child of ['items', 'additionalProperties', 'not', 'if', 'then', 'else'] as const) {
      if (obj[child] !== undefined && typeof obj[child] === 'object') {
        visit(obj[child], `${path}.${child}`);
      }
    }
    for (const child of ['anyOf', 'oneOf', 'allOf'] as const) {
      const arr = obj[child] as unknown[] | undefined;
      if (Array.isArray(arr)) {
        arr.forEach((v, i) => visit(v, `${path}.${child}[${i}]`));
      }
    }
  };
  visit(root, '');
  return violations;
}

describe('AI response schemas are OpenAI strict-mode compatible', () => {
  const cases: Array<[string, z.ZodTypeAny]> = [
    ['classifyResponseSchema', classifyResponseSchema],
    ['extractResponseSchema', extractResponseSchema],
    ['adviseResponseSchema', adviseResponseSchema],
  ];

  for (const [label, schema] of cases) {
    it(`${label} has no oneOf / optional / open-object violations`, () => {
      const json = z.toJSONSchema(schema, { target: 'draft-2020-12' });
      const violations = findStrictModeViolations(json);
      expect(violations).toEqual([]);
    });
  }
});
