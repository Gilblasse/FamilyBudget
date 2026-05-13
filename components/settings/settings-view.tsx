'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Database,
  Download,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ResetDialog,
  useExportBudget,
  useImportBudget,
} from '@/components/budget/data-controls';
import { useBudget } from '@/lib/store';
import { useMounted } from '@/lib/use-mounted';
import { fdRange } from '@/lib/format';
import { useAIStatusInfo } from '@/lib/ai/enabled';
import { cn } from '@/lib/utils';

export function SettingsView() {
  const mounted = useMounted();
  const importer = useImportBudget();
  const exportBudget = useExportBudget();

  return (
    <div className="grid gap-6">
      <importer.FileInput />
      <DataSection
        onImport={importer.open}
        onExport={exportBudget}
      />
      <PeriodSection mounted={mounted} />
      <AppearanceSection />
      <AISection />
    </div>
  );
}

function DataSection({
  onImport,
  onExport,
}: {
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" /> Data
        </CardTitle>
        <CardDescription>
          Local-first. Sync via JSON export/import. Reset replaces your data with the seed
          defaults — export first if you want a backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onImport}>
          <Upload className="size-4" /> Import JSON
        </Button>
        <Button variant="outline" onClick={onExport}>
          <Download className="size-4" /> Export JSON
        </Button>
        <ResetDialog>
          <Button variant="destructive">
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
        </ResetDialog>
      </CardContent>
    </Card>
  );
}

function PeriodSection({ mounted }: { mounted: boolean }) {
  const periods = useBudget((s) => s.periods);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const setActivePeriod = useBudget((s) => s.setActivePeriod);
  const addPeriod = useBudget((s) => s.addPeriod);
  const removePeriod = useBudget((s) => s.removePeriod);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');
  const [copyIncome, setCopyIncome] = useState(true);
  const [copyBills, setCopyBills] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods],
  );
  const canDelete = periods.length > 1;
  const pendingDeletePeriod = useMemo(
    () => (pendingDeleteId ? periods.find((p) => p.id === pendingDeleteId) ?? null : null),
    [periods, pendingDeleteId],
  );
  const pendingImpact = useMemo(() => {
    if (!pendingDeleteId) return { incomeCount: 0, billCount: 0 };
    return {
      incomeCount: income.filter((r) => r.periodId === pendingDeleteId).length,
      billCount: bills.filter((b) => b.periodId === pendingDeleteId).length,
    };
  }, [income, bills, pendingDeleteId]);

  function handleCreate() {
    if (!startDate || !endDate) {
      toast.error('Pick both a start and end date.');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date must be on or before end date.');
      return;
    }
    addPeriod({
      startDate,
      endDate,
      label: label.trim() || undefined,
      copyIncome,
      copyBills,
    });
    setDialogOpen(false);
    setStartDate('');
    setEndDate('');
    setLabel('');
    toast.success('Period added');
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    removePeriod(pendingDeleteId);
    setPendingDeleteId(null);
    toast.success('Period deleted');
  }

  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" /> Periods
        </CardTitle>
        <CardDescription>
          Each period scopes your income and bills. Switch the active period or create
          new ones — your data carries forward when you copy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {sortedPeriods.map((p) => {
            const active = p.id === activePeriodId;
            const incCount = income.filter((r) => r.periodId === p.id).length;
            const billCount = bills.filter((b) => b.periodId === p.id).length;
            return (
              <li
                key={p.id}
                className={cn(
                  'flex items-center justify-between gap-3 px-3 py-2.5',
                  active && 'bg-brand-50/60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium money">
                      {mounted ? fdRange(p.startDate, p.endDate) : '—'}
                    </span>
                    {p.label ? (
                      <span className="text-xs text-muted-foreground">· {p.label}</span>
                    ) : null}
                    {active ? (
                      <Badge size="sm" variant="success">
                        <CheckCircle2 className="size-3" /> Active
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {incCount} income · {billCount} bills
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActivePeriod(p.id);
                        toast.success('Active period switched');
                      }}
                    >
                      Set active
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete period"
                      onClick={() => setPendingDeleteId(p.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Add period
        </Button>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Pick start" />
            </div>
            <div className="grid gap-1.5">
              <Label>End date</Label>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="Pick end" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="period-label">Label (optional)</Label>
              <Input
                id="period-label"
                placeholder="e.g. June cycle"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="grid gap-2 rounded-md border border-border-subtle p-3">
              <p className="text-xs text-muted-foreground">
                Copy from active period
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copyIncome}
                  onCheckedChange={(v) => setCopyIncome(v === true)}
                />
                Income sources
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copyBills}
                  onCheckedChange={(v) => setCopyBills(v === true)}
                />
                Bills
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this period?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePeriod
                ? `${fdRange(pendingDeletePeriod.startDate, pendingDeletePeriod.endDate)}${pendingDeletePeriod.label ? ` · ${pendingDeletePeriod.label}` : ''} — removes ${pendingImpact.incomeCount} income and ${pendingImpact.billCount} bill entries. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              Delete period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Theme preference. System follows your OS setting and updates live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 p-1"
        >
          {options.map((opt) => {
            const active = mounted && theme === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-[var(--shadow-xs)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.8} /> {opt.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AISection() {
  const info = useAIStatusInfo();
  const enabled = info.status === 'enabled';
  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" /> AI assistant
        </CardTitle>
        <CardDescription>
          The chat, extract, and advisor flows call OpenAI via the Vercel AI Gateway.
          Set <code className="rounded bg-muted px-1 text-xs">OPENAI_API_KEY</code> (or
          a compatible <code className="rounded bg-muted px-1 text-xs">AI_GATEWAY_API_KEY</code>)
          in your environment to enable them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="text-sm">
          Current status:{' '}
          {info.status === 'unknown' ? (
            <Badge variant="neutral">Checking…</Badge>
          ) : enabled ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3" /> Enabled
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertTriangle className="size-3" /> Disabled
            </Badge>
          )}
          {info.reason ? (
            <span className="ml-2 text-xs text-muted-foreground">{info.reason}</span>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          render={
            <a
              href="https://vercel.com/docs/ai-gateway"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Setup guide
        </Button>
      </CardContent>
    </Card>
  );
}
