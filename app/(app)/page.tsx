import { BalanceOverviewCard } from '@/components/dashboard/balance-overview-card';
import { CoverageCard } from '@/components/dashboard/coverage-card';
import { ExpenseOverviewCard } from '@/components/dashboard/expense-overview-card';
import { IncomeOverviewCard } from '@/components/dashboard/income-overview-card';
import { MoneyFlowChart } from '@/components/dashboard/money-flow-chart';
import { TransactionHistory } from '@/components/dashboard/transaction-history';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <div
        className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-5 max-[360px]:-mx-4 max-[360px]:flex max-[360px]:snap-x max-[360px]:snap-mandatory max-[360px]:overflow-x-auto max-[360px]:px-4"
      >
        <BalanceOverviewCard />
        <IncomeOverviewCard />
        <ExpenseOverviewCard />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-7">
          <MoneyFlowChart />
        </div>
        <div className="md:col-span-12 lg:col-span-5">
          <CoverageCard />
        </div>
        <div className="md:col-span-12">
          <TransactionHistory />
        </div>
      </div>
    </div>
  );
}
