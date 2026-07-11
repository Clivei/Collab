/** WIB (Asia/Jakarta, UTC+7, no DST). Store UTC; compute day boundaries here. */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function shifted(d: Date): Date {
  return new Date(d.getTime() + WIB_OFFSET_MS);
}

/** 'YYYY-MM-DD' calendar day in WIB. */
export function wibDateStr(d: Date = new Date()): string {
  return shifted(d).toISOString().slice(0, 10);
}

/** 'HH:MM' wall-clock time in WIB. */
export function wibTimeStr(d: Date = new Date()): string {
  return shifted(d).toISOString().slice(11, 16);
}

/** 0 = Sunday … 6 = Saturday, in WIB. */
export function wibDayOfWeek(d: Date = new Date()): number {
  return shifted(d).getUTCDay();
}

export function isWeekendWIB(d: Date = new Date()): boolean {
  const dow = wibDayOfWeek(d);
  return dow === 0 || dow === 6;
}

/** First and last date strings of the WIB month containing `d` (or explicit ym 'YYYY-MM'). */
export function wibMonthBounds(ym?: string): { start: string; end: string } {
  const base = ym ?? wibDateStr().slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const start = `${base}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${base}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** '2026-07' → 'Juli 2026' */
export function monthLabelID(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

/** '2026-07-09' → '09 Jul 2026' */
export function dateLabelID(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS_ID[m - 1].slice(0, 3)} ${y}`;
}

/** UTC timestamp → 'HH:MM' WIB */
export function timeLabelWIB(iso: string): string {
  return wibTimeStr(new Date(iso));
}

/** Count Mon–Fri days in [start, end] (date strings, inclusive). */
export function countWorkingDays(start: string, end: string): number {
  let count = 0;
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
