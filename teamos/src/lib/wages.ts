import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankAccount, Profile } from "@/lib/types";
import { maskAccount } from "@/lib/types";
import { getMonthAttendance, type MonthAttendance } from "@/lib/attendance-summary";
import { formatRupiah } from "@/lib/utils";
import { monthLabelID, wibMonthBounds } from "@/lib/tz";

export interface WageRow {
  profile: Profile & { departments: { name: string } | null; entities: { name: string } | null };
  bank: BankAccount | null;
  monthlyWage: number | null;
  workingDays: number;
  dailyRate: number | null;
  unpaidDays: number;
  deduction: number;
  estimate: number | null;
  attendance: MonthAttendance;
}

/**
 * Owner wage dashboard rows for one month.
 * Only *approved unpaid leave* deducts; unexplained absence deducts nothing
 * until bulk-converted. intern_unpaid excluded from wage math (badged in UI).
 * No tax / BPJS / THR anywhere — the only arithmetic is wage − unpaid deduction.
 */
export async function getWageRows(admin: SupabaseClient, ym: string): Promise<WageRow[]> {
  const { start, end } = wibMonthBounds(ym);

  const [{ data: profiles }, { data: wages }, { data: banks }, { data: entities }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("*, departments(name), entities(name)")
        .neq("permission", "owner")
        .in("employment_status", ["active", "probation"])
        .order("full_name"),
      admin.from("wages").select("*").lte("effective_from", end).order("effective_from", { ascending: false }),
      admin.from("bank_accounts").select("*").eq("is_active", true),
      admin.from("entities").select("id, working_days_per_month"),
    ]);

  const wageOf = new Map<string, number>();
  for (const w of wages ?? []) {
    if (!wageOf.has(w.profile_id)) wageOf.set(w.profile_id, Number(w.monthly_wage));
  }
  const bankOf = new Map((banks ?? []).map((b) => [b.profile_id, b as BankAccount]));
  const wdOf = new Map((entities ?? []).map((e) => [e.id, e.working_days_per_month]));

  const rows: WageRow[] = [];
  for (const p of (profiles ?? []) as WageRow["profile"][]) {
    const attendance = await getMonthAttendance(admin, p.id, start, end);
    const workingDays = (p.entity_id && wdOf.get(p.entity_id)) || 22;
    const isUnpaidIntern = p.work_type === "intern_unpaid";
    const monthlyWage = isUnpaidIntern ? null : (wageOf.get(p.id) ?? null);
    const dailyRate = monthlyWage != null ? monthlyWage / workingDays : null;
    const unpaidDays = attendance.unpaid;
    const deduction = dailyRate != null ? Math.round(dailyRate * unpaidDays) : 0;
    const estimate = monthlyWage != null ? monthlyWage - deduction : null;
    rows.push({
      profile: p,
      bank: bankOf.get(p.id) ?? null,
      monthlyWage,
      workingDays,
      dailyRate,
      unpaidDays,
      deduction,
      estimate,
      attendance,
    });
  }
  return rows;
}

function pad(label: string, width = 18): string {
  return label.padEnd(width);
}

/** §4.6 WhatsApp receipt — plain text, monospace-friendly. */
export function buildReceiptText(
  row: WageRow,
  ym: string,
  opts: { includeFullAccount?: boolean } = {}
): string {
  const p = row.profile;
  const entity = p.entities?.name?.toUpperCase() ?? "NORAPADEL + GRIDLINE";
  const dept = p.departments?.name ?? "";
  const bank = row.bank;
  const acct = bank
    ? `${bank.bank_name} ${opts.includeFullAccount ? bank.account_number : maskAccount(bank.account_number)} a.n. ${bank.account_holder_name}`
    : "— (rekening belum diisi)";
  const unpaidLine =
    row.unpaidDays > 0 && row.dailyRate != null
      ? `${formatRupiah(row.deduction)} (${row.unpaidDays} × ${formatRupiah(row.dailyRate)})`
      : "Rp 0";

  return [
    `${entity} — Rincian Estimasi Gaji`,
    `Periode: ${monthLabelID(ym)}`,
    `Nama: ${p.full_name}${dept ? ` (${dept})` : ""}`,
    "--------------------------------",
    `${pad("Hadir")}: ${row.attendance.present} hari`,
    `${pad("Terlambat")}: ${row.attendance.late} hari`,
    `${pad("Cuti tahunan")}: ${row.attendance.annual} hari`,
    `${pad("Cuti tidak dibayar")}: ${row.attendance.unpaid} hari`,
    "--------------------------------",
    `${pad("Gaji bulanan")}: ${row.monthlyWage != null ? formatRupiah(row.monthlyWage) : "—"}`,
    `${pad("Potongan unpaid")}: ${unpaidLine}`,
    "--------------------------------",
    `${pad("Estimasi diterima")}: ${row.estimate != null ? formatRupiah(row.estimate) : "—"}`,
    `${pad("Transfer ke")}: ${acct}`,
    "--------------------------------",
    "Estimasi informasi — bukan slip gaji",
    "resmi. Tidak termasuk pajak/BPJS.",
  ].join("\n");
}
