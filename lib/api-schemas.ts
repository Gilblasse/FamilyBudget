/**
 * Zod schemas for the per-entity remote-primary endpoints under
 * `/api/budget/{income,bills,periods,budgets,paid,meta}`. Mirrors the
 * type definitions in `lib/types.ts` but request-shaped.
 *
 * IDs are client-minted via `lib/format.ts:uid()` — the create schemas
 * accept an `id`. The Apps Script layer is not the ID authority.
 */
import { z } from 'zod';
import {
  billSchema,
  budgetMetaSchema,
  budgetPeriodSchema,
  dateRangeSchema,
  incomeSchema,
} from './ai/schemas';

const partialOmitId = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) =>
  schema.omit({ id: true } as { id: true }).partial();

export const incomeCreateSchema = incomeSchema;
export const incomeUpdateSchema = partialOmitId(incomeSchema);

export const billCreateSchema = billSchema;
export const billUpdateSchema = partialOmitId(billSchema);

export const periodCreateSchema = budgetPeriodSchema;
export const periodUpdateSchema = partialOmitId(budgetPeriodSchema);

export const budgetMetaCreateSchema = budgetMetaSchema;
export const budgetMetaUpdateSchema = partialOmitId(budgetMetaSchema);

/**
 * Paid-key regex matches:
 *   • `bill_<id>`                       — one-shot bill
 *   • `inc_<id>`                        — one-shot income (anchor)
 *   • `inc_<id>_YYYY-MM-DD`             — recurring income occurrence
 *
 * The id portion disallows underscores so the separator before the
 * date suffix is unambiguous. `uid()` (lib/format.ts) produces UUIDs
 * with dashes, and seed IDs (`seed-*`) likewise have no underscores,
 * so this is a tight match for real-world keys.
 */
export const paidKeyParamSchema = z.object({
  id: z.string().regex(/^(bill|inc)_[A-Za-z0-9-]+(?:_\d{4}-\d{2}-\d{2})?$/, 'invalid paid key'),
});

export const paidValueBodySchema = z
  .object({ value: z.boolean().optional() })
  .optional();

export const metaPatchSchema = z
  .object({
    balance: z.number(),
    activePeriodId: z.string().min(1),
    dateRange: dateRangeSchema.nullable(),
    activeBudgetId: z.string().min(1),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty patch' });

export type IncomeCreateInput = z.infer<typeof incomeCreateSchema>;
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;
export type BillCreateInput = z.infer<typeof billCreateSchema>;
export type BillUpdateInput = z.infer<typeof billUpdateSchema>;
export type PeriodCreateInput = z.infer<typeof periodCreateSchema>;
export type PeriodUpdateInput = z.infer<typeof periodUpdateSchema>;
export type BudgetMetaCreateInput = z.infer<typeof budgetMetaCreateSchema>;
export type BudgetMetaUpdateInput = z.infer<typeof budgetMetaUpdateSchema>;
export type MetaPatchInput = z.infer<typeof metaPatchSchema>;
