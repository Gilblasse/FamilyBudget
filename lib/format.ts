export function fmt(n: number): string {
  return (
    '$' +
    n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fd(d: string): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseIso(d: string): { y: number; m: number; day: number } | null {
  const parts = d.split('-');
  if (parts.length < 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return null;
  return { y, m, day };
}

export function fdRange(start: string, end: string): string {
  const a = parseIso(start);
  const b = parseIso(end);
  if (!a || !b) return `${start} – ${end}`;
  const aMonth = MONTH_SHORT[a.m - 1] ?? '';
  const bMonth = MONTH_SHORT[b.m - 1] ?? '';
  if (a.y === b.y) {
    return `${aMonth} ${a.day} – ${bMonth} ${b.day}, ${a.y}`;
  }
  return `${aMonth} ${a.day}, ${a.y} – ${bMonth} ${b.day}, ${b.y}`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
