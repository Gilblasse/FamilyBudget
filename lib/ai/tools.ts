import { tool } from 'ai';
import { z } from 'zod';
import {
  actionSchema,
  isoDateSchema,
  prioritySchema,
  statusSchema,
} from './schemas';

export const budgetTools = {
  addBill: tool({
    description: 'Add a new bill to the active period. The user must approve before it is created.',
    inputSchema: z.object({
      name: z.string().min(1).describe('Human-readable bill name (e.g. "Rent")'),
      date: isoDateSchema.describe('Due date as YYYY-MM-DD'),
      amount: z.number().nonnegative().describe('Dollar amount (positive)'),
      priority: prioritySchema,
      action: actionSchema,
    }),
  }),
  addIncome: tool({
    description: 'Add a new income entry to the active period. Requires approval.',
    inputSchema: z.object({
      source: z.string().min(1),
      date: isoDateSchema,
      amount: z.number().nonnegative(),
      status: statusSchema,
    }),
  }),
  updateBill: tool({
    description: 'Patch fields on an existing bill. Provide only the fields that change.',
    inputSchema: z.object({
      id: z.string().describe('Existing bill id from the snapshot'),
      patch: z
        .object({
          name: z.string().min(1).optional(),
          date: isoDateSchema.optional(),
          amount: z.number().nonnegative().optional(),
          priority: prioritySchema.optional(),
          action: actionSchema.optional(),
        })
        .refine((p) => Object.keys(p).length > 0, 'patch must contain at least one field'),
    }),
  }),
  updateIncome: tool({
    description: 'Patch fields on an existing income entry.',
    inputSchema: z.object({
      id: z.string(),
      patch: z
        .object({
          source: z.string().min(1).optional(),
          date: isoDateSchema.optional(),
          amount: z.number().nonnegative().optional(),
          status: statusSchema.optional(),
        })
        .refine((p) => Object.keys(p).length > 0, 'patch must contain at least one field'),
    }),
  }),
  removeBill: tool({
    description: 'Delete a bill by id.',
    inputSchema: z.object({ id: z.string() }),
  }),
  removeIncome: tool({
    description: 'Delete an income entry by id.',
    inputSchema: z.object({ id: z.string() }),
  }),
  togglePaid: tool({
    description: 'Toggle the paid (or received) marker on a bill or income entry.',
    inputSchema: z.object({
      kind: z.enum(['bill', 'income']),
      id: z.string(),
    }),
  }),
  setBalance: tool({
    description: 'Set the bank balance to a specific dollar amount.',
    inputSchema: z.object({ amount: z.number() }),
  }),
  switchPeriod: tool({
    description: 'Switch the active budget period.',
    inputSchema: z.object({ periodId: z.string() }),
  }),
} as const;

export type BudgetToolName = keyof typeof budgetTools;
