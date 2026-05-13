'use client';

import { useCallback, useRef } from 'react';
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
import { AiChatSheet } from './ai/ai-chat-sheet';
import { AiConfigNotice } from './ai/ai-config-notice';
import { AiExtractDialog } from './ai/ai-extract-dialog';

export function useExportBudget() {
  const exportJson = useBudget((s) => s.exportJson);
  return useCallback(() => {
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
  }, [exportJson]);
}

export function useImportBudget() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importData = useBudget((s) => s.importData);

  const FileInput = useCallback(
    () => (
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const parsed = JSON.parse(String(ev.target?.result ?? ''));
              if (
                !parsed ||
                typeof parsed !== 'object' ||
                !Array.isArray(parsed.income) ||
                !Array.isArray(parsed.bills)
              ) {
                toast.error('Import failed — not a valid budget export.');
                return;
              }
              importData({
                balance: typeof parsed.balance === 'number' ? parsed.balance : 0,
                income: parsed.income,
                bills: parsed.bills,
                paid: parsed.paid ?? {},
                periods: Array.isArray(parsed.periods) ? parsed.periods : undefined,
                activePeriodId:
                  typeof parsed.activePeriodId === 'string'
                    ? parsed.activePeriodId
                    : undefined,
              });
              toast.success(
                `Imported · ${parsed.income.length} income, ${parsed.bills.length} bills`,
              );
            } catch (err) {
              toast.error(`Import failed: ${(err as Error).message}`);
            } finally {
              if (fileRef.current) fileRef.current.value = '';
            }
          };
          reader.readAsText(file);
        }}
      />
    ),
    [importData],
  );

  const open = useCallback(() => {
    fileRef.current?.click();
  }, []);

  return { open, FileInput };
}

export function ResetDialog({ children }: { children: React.ReactElement }) {
  const resetAll = useBudget((s) => s.resetAll);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={children} />
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
  );
}

export function DataControls() {
  const exportBudget = useExportBudget();
  const importer = useImportBudget();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <importer.FileInput />
      <Button
        variant="outline"
        size="sm"
        onClick={importer.open}
        className="h-10 sm:h-9"
      >
        <Upload className="h-4 w-4" /> Import
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportBudget}
        className="h-10 sm:h-9"
      >
        <Download className="h-4 w-4" /> Export
      </Button>
      <AiExtractDialog />
      <AiChatSheet />
      <ResetDialog>
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-expense hover:text-expense sm:h-9"
        >
          <RotateCcw className="h-4 w-4" /> Reset to defaults
        </Button>
      </ResetDialog>
      <AiConfigNotice />
    </div>
  );
}
