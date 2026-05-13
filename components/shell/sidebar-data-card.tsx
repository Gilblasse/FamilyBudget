'use client';

import { Database, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useExportBudget,
  useImportBudget,
} from '@/components/budget/data-controls';

export function SidebarDataCard() {
  const exportBudget = useExportBudget();
  const importer = useImportBudget();

  return (
    <div className="rounded-2xl border border-border-subtle bg-gradient-to-br from-nav-100 via-nav-50 to-card p-3 shadow-[var(--shadow-xs)]">
      <importer.FileInput />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-nav-500 text-nav-foreground">
            <Database className="size-4" strokeWidth={1.8} />
          </span>
          <div className="text-sm font-semibold">Data</div>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={importer.open}
                  aria-label="Import budget JSON"
                />
              }
            >
              <Upload className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Import JSON</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={exportBudget}
                  aria-label="Export budget JSON"
                />
              }
            >
              <Download className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Export JSON</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Local-first. Sync via JSON export/import.
      </p>
    </div>
  );
}
