'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import { useBudgetSync } from '@/lib/sync';
import { BalanceCard } from './balance-card';
import { BillsTable } from './bills-table';
import { CashFlow } from './cash-flow';
import { DataControls } from './data-controls';
import { IncomeTable } from './income-table';
import { PeriodSelector } from './period-selector';
import { Summary } from './summary';
import { TrialBalance } from './trial-balance';

export function BudgetApp() {
  useBudgetSync();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-4 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Irregular income plan</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <PeriodSelector />
            <span>· Nethelbert Blasse · SkyHorizon Group / Take2</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <BalanceCard />

      <Tabs defaultValue="income">
        <TabsList className="flex w-full flex-nowrap overflow-x-auto sm:w-auto sm:flex-wrap">
          <TabsTrigger value="income">
            <span className="sm:hidden">Income</span>
            <span className="hidden sm:inline">Income sources</span>
          </TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="cashflow">
            <span className="sm:hidden">Flow</span>
            <span className="hidden sm:inline">Cash flow</span>
          </TabsTrigger>
          <TabsTrigger value="trialbal">
            <span className="sm:hidden">Ledger</span>
            <span className="hidden sm:inline">Trial balance</span>
          </TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="mt-6">
          <IncomeTable />
        </TabsContent>
        <TabsContent value="bills" className="mt-6">
          <BillsTable />
        </TabsContent>
        <TabsContent value="cashflow" className="mt-6">
          <CashFlow />
        </TabsContent>
        <TabsContent value="trialbal" className="mt-6">
          <TrialBalance />
        </TabsContent>
        <TabsContent value="summary" className="mt-6">
          <Summary />
        </TabsContent>
      </Tabs>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <span>Local-first · syncs to Google Sheets in production</span>
        <DataControls />
      </footer>
    </div>
  );
}
