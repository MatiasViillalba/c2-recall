// Utilidades pequeñas: ids, fechas de «día de estudio» y formato.

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const nowIso = () => new Date().toISOString();

/** Día de estudio local (YYYY-MM-DD). El día «empieza» a las `startHour` (por defecto 4 a. m., como Anki). */
export function studyDay(date: Date | string | number, startHour = 4): string {
  const d = new Date(date);
  d.setHours(d.getHours() - startHour);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Instante en que termina el día de estudio actual. */
export function endOfStudyDay(now: Date, startHour = 4): Date {
  const end = new Date(now);
  end.setHours(startHour, 0, 0, 0);
  if (end <= now) end.setDate(end.getDate() + 1);
  return end;
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 31) return `${Math.round(d)} d`;
  const mo = d / 30.44;
  if (mo < 12) return `${mo < 10 ? mo.toFixed(1).replace('.0', '') : Math.round(mo)} m`;
  return `${(d / 365.25).toFixed(1).replace('.0', '')} a`;
}

export function relativeDue(due: string | undefined, now = new Date()): string {
  if (!due) return 'nueva';
  const ms = new Date(due).getTime() - now.getTime();
  if (ms <= 0) return 'vencida';
  return `en ${formatInterval(ms)}`;
}

export function formatDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', opts);
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n.toLocaleString('es-AR')} ${n === 1 ? one : many}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
