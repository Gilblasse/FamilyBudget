'use client';

import { useRef } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useBudget } from '@/lib/store';

export function DataControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const exportJson = useBudget((s) => s.exportJson);
  const importData = useBudget((s) => s.importData);
  const resetAll = useBudget((s) => s.resetAll);

  function onExport() {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  }

  function onImportPick() {
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? ''));
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.income) || !Array.isArray(parsed.bills)) {
          toast.error('Import failed — not a valid budget export.');
          return;
        }
        importData({
          balance: typeof parsed.balance === 'number' ? parsed.balance : 0,
          income: parsed.income,
          bills: parsed.bills,
          paid: parsed.paid ?? {},
          periods: Array.isArray(parsed.periods) ? parsed.periods : undefined,
          activePeriodId: typeof parsed.activePeriodId === 'string' ? parsed.activePeriodId : undefined,
        });
        toast.success(
          `Imported · ${parsed.income.length} income, ${parsed.bills.length} bills`
        );
      } catch (err) {
        toast.error(`Import failed: ${(err as Error).message}`);
      } finally {
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <Button variant="outline" size="sm" onClick={onImportPick}>
        <Upload className="h-4 w-4" /> Import
      </Button>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-4 w-4" /> Export
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="outline" size="sm" className="text-expense hover:text-expense" />
          }
        >
          <RotateCcw className="h-4 w-4" /> Reset to defaults
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset everything?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all income, bills, and paid/received markers with the seed
              defaults. Your current data will be lost. Consider exporting first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetAll();
                toast.success('Reset to defaults');
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
