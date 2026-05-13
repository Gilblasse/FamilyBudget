'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/lib/ui-store';
import { useMounted } from '@/lib/use-mounted';
import { cn } from '@/lib/utils';

function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform ?? '';
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function SidebarSearch({ className }: { className?: string }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const clearSearchQuery = useUIStore((s) => s.clearSearchQuery);

  useEffect(() => {
    clearSearchQuery();
  }, [pathname, clearSearchQuery]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut =
        e.key === 's' &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey;
      if (isShortcut) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mac = mounted ? isMacLike() : true;

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Filter list…"
        aria-label="Filter list on this page"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-9 rounded-full border-sidebar-border bg-card pl-9 pr-16 text-sm placeholder:text-muted-foreground"
      />
      {searchQuery ? (
        <button
          type="button"
          aria-label="Clear filter"
          onClick={clearSearchQuery}
          className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd
          className="pointer-events-none absolute right-2 top-1/2 inline-flex h-5 -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border-subtle bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
          aria-label={mac ? 'Command S' : 'Control S'}
        >
          {mac ? <span className="text-xs">⌘</span> : <span>Ctrl</span>}
          <span>S</span>
        </kbd>
      )}
    </div>
  );
}
