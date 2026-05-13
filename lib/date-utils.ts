import type { DateRange } from './types';

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function clampIso(d: string, min: string, max: string): string {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

export function startOfWeekMondayIso(iso: string): string {
  const d = fromIso(iso);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

export function rangesEqual(a: DateRange | null, b: DateRange | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.start === b.start && a.end === b.end;
}
