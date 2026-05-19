'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { STORE_VERSION, useBudget } from '@/lib/store';
import { useMounted } from '@/lib/use-mounted';
import { putEnvelope } from '@/lib/remote/api-client';
import { qk } from '@/lib/remote/query-keys';

const STORAGE_KEY = 'remote_migration_v1';
type Choice = 'uploaded' | 'discarded';

function readChoice(): Choice | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'uploaded' || v === 'discarded' ? v : null;
}

/**
 * First-load modal for remote-primary mode when the cloud envelope is
 * empty. Forces the user to either upload their local data to the
 * cloud or discard it and start fresh — both states would otherwise be
 * silently clobbered by the bridge once it runs.
 */
export function RemoteMigrationModal() {
  const mounted = useMounted();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'upload' | 'discard' | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Bumped after a choice is recorded so the next render re-reads
  // localStorage and the modal hides without a setState-in-effect.
  const [choiceTick, setChoiceTick] = useState(0);

  if (!mounted) return null;
  // `choiceTick` invalidates this read; readChoice() is pure and cheap.
  void choiceTick;
  const choice = readChoice();
  if (choice !== null) return null;

  const state = useBudget.getState();
  const billsCount = state.bills.length;
  const incomeCount = state.income.length;

  const handleUpload = async () => {
    setBusy('upload');
    try {
      await putEnvelope(
        {
          balance: state.balance,
          income: state.income,
          bills: state.bills,
          paid: state.paid,
          periods: state.periods,
          activePeriodId: state.activePeriodId,
          dateRange: state.dateRange,
          budgets: state.budgets,
          activeBudgetId: state.activeBudgetId,
          budgetData: state.budgetData,
        },
        STORE_VERSION,
      );
      useBudget.persist.clearStorage();
      window.localStorage.setItem(STORAGE_KEY, 'uploaded');
      setChoiceTick((n) => n + 1);
      await queryClient.invalidateQueries({ queryKey: qk.envelope() });
    } catch (err) {
      console.error('[remote-primary] upload failed', err);
      setBusy(null);
    }
  };

  const handleDiscard = () => {
    state.resetAll();
    window.localStorage.setItem(STORAGE_KEY, 'discarded');
    setChoiceTick((n) => n + 1);
  };

  return (
    // open is held true and onOpenChange swallows all close attempts so the
    // user must pick Upload or Discard. Base UI's AlertDialog already has
    // no built-in close button.
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogTitle>Cloud budget is empty</AlertDialogTitle>
          <AlertDialogDescription>
            We found {billsCount} bills and {incomeCount} income sources on this device.
            Your cloud is empty. Choose what to do — this is required before
            you can continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {confirmingDiscard ? (
            <>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => setConfirmingDiscard(false)}
              >
                Cancel
              </Button>
              <AlertDialogAction
                variant="destructive"
                disabled={busy !== null}
                onClick={handleDiscard}
              >
                Yes, discard local
              </AlertDialogAction>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => setConfirmingDiscard(true)}
              >
                Discard local and start fresh
              </Button>
              <AlertDialogAction
                disabled={busy !== null}
                onClick={handleUpload}
              >
                {busy === 'upload' ? 'Uploading…' : 'Upload local → cloud'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
