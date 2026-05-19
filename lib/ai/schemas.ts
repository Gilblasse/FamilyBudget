import { z } from 'zod';
import type { BudgetSnapshot } from '../types';

export const PRIORITY_VALUES = ['crit', 'imp', 'opt', 'flex'] as const;
export const ACTION_VALUES = ['pay-full', 'partial', 'delay', 'reduce', 'skip'] as const;
export const STATUS_VALUES = ['expected', 'confirmed', 'pending', 'received'] as const;
export const CADENCE_VALUES = [
  'once',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
] as const;

export const prioritySchema = z.enum(PRIORITY_VALUES);
export const actionSchema = z.enum(ACTION_VALUES);
export const statusSchema = z.enum(STATUS_VALUES);
export const cadenceSchema = z.enum(CADENCE_VALUES);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO YYYY-MM-DD');

// ----- BudgetSnapshot canonical schema -----
//
// Replaces the duck-typed `z.custom<BudgetSnapshot>((v) => v && 'balance' in v
// && 'bills' in v)` checks that lived inline in /api/ai/chat and /api/ai/advise.
// Required because every AI endpoint accepts a snapshot from the client and
// should not trust shape claims.

export const budgetPeriodSchema = z.object({
  id: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  label: z.string().optional(),
});

export const incomeSchema = z.object({
  id: z.string().min(1),
  periodId: z.string().min(1),
  source: z.string(),
  date: isoDateSchema,
  amount: z.number(),
  status: statusSchema,
  cadence: cadenceSchema.optional(),
  secondDay: z.number().int().min(1).max(31).optional(),
  endDate: isoDateSchema.optional(),
});

export const billSchema = z.object({
  id: z.string().min(1),
  periodId: z.string().min(1),
  name: z.string(),
  date: isoDateSchema,
  amount: z.number(),
  priority: prioritySchema,
  action: actionSchema,
  tags: z.array(z.string()).optional(),
});

export const dateRangeSchema = z.object({
  start: isoDateSchema,
  end: isoDateSchema,
});

/**
 * Per-budget data slice. Matches `BudgetData` in `lib/types.ts`.
 * Extracted so the v9 envelope can reuse it for the `budgetData` map.
 */
export const budgetDataSchema = z.object({
  balance: z.number(),
  income: z.array(incomeSchema),
  bills: z.array(billSchema),
  paid: z.record(z.string(), z.boolean()),
  periods: z.array(budgetPeriodSchema),
  activePeriodId: z.string(),
  dateRange: dateRangeSchema.nullable(),
});

export const budgetMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  defaultRange: dateRangeSchema,
});

/**
 * Canonical v9 on-wire snapshot. Multi-budget fields are optional on the
 * wire so legacy v8 clients (and the local-first debounced PUT, which
 * still sends only the active-budget slice) round-trip without breaking
 * Zod parsing.
 */
export const budgetSnapshotSchema = z.object({
  balance: z.number(),
  income: z.array(incomeSchema),
  bills: z.array(billSchema),
  paid: z.record(z.string(), z.boolean()),
  periods: z.array(budgetPeriodSchema),
  activePeriodId: z.string(),
  dateRange: dateRangeSchema.nullable(),
  budgets: z.array(budgetMetaSchema).optional(),
  activeBudgetId: z.string().optional(),
  budgetData: z.record(z.string(), budgetDataSchema).optional(),
}) satisfies z.ZodType<BudgetSnapshot>;

/**
 * Envelope used by /api/budget PUT and by Apps Script storage. `version`
 * mirrors `STORE_VERSION` from `lib/store.ts` and lets the Sheets backend
 * reject writes from clients whose schema is older than the stored one.
 * Optional on input for back-compat with un-versioned clients; the server
 * fills in the current `STORE_VERSION` when missing.
 */
export const budgetEnvelopeSchema = z.object({
  version: z.number().int().nonnegative().optional(),
  data: budgetSnapshotSchema,
});

export type BudgetEnvelopeInput = z.infer<typeof budgetEnvelopeSchema>;

export const classifyResponseSchema = z.object({
  priority: prioritySchema,
  action: actionSchema,
  rationale: z.string().min(1).max(200),
});

export const billProposalSchema = z.object({
  kind: z.literal('bill'),
  name: z.string().min(1),
  date: isoDateSchema,
  amount: z.number().nonnegative(),
  priority: prioritySchema,
  action: actionSchema,
});

export const incomeProposalSchema = z.object({
  kind: z.literal('income'),
  source: z.string().min(1),
  date: isoDateSchema,
  amount: z.number().nonnegative(),
  status: statusSchema,
});

// OpenAI's structured outputs (response_format) reject `oneOf`, which is what
// z.discriminatedUnion emits in Zod 4's JSON Schema. A plain z.union emits
// `anyOf`, which OpenAI accepts. The TS inferred type is still the same
// discriminated shape, so callers can keep narrowing by `kind`.
export const proposalSchema = z.union([billProposalSchema, incomeProposalSchema]);

// OpenAI strict structured outputs require every property to be listed in
// `required`; optional fields fail validation. Keep `notes` as a plain
// (possibly empty) string instead of optional.
export const extractResponseSchema = z.object({
  items: z.array(proposalSchema),
  notes: z.string(),
});

export const adviseRecommendationSchema = z.object({
  billId: z.string(),
  suggestedAction: actionSchema,
  reasoning: z.string().min(1).max(240),
  savingsAmount: z.number().nonnegative(),
});

export const adviseResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  recommendations: z.array(adviseRecommendationSchema),
});

export type BudgetSnapshotInput = z.infer<typeof budgetSnapshotSchema>;
export type ClassifyResponse = z.infer<typeof classifyResponseSchema>;
export type BillProposal = z.infer<typeof billProposalSchema>;
export type IncomeProposal = z.infer<typeof incomeProposalSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type ExtractResponse = z.infer<typeof extractResponseSchema>;
export type AdviseRecommendation = z.infer<typeof adviseRecommendationSchema>;
export type AdviseResponse = z.infer<typeof adviseResponseSchema>;
