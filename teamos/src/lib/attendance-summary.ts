import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveRequest, Profile } from "@/lib/types";
import { countWorkingDays, timeLabelWIB } from "@/lib/tz";

/** Weekday overlap (days) of a leave request with [start, end]. */
export function leaveDaysInRange(req: LeaveRequest, start: string, end: string): number {
  const s = req.start_date > start ? req.start_date : start;
  const e = req.end_date < end ? req.end_date : end;
  if (s > e) return 0;
  if (req.type === "half_day") return 0.5;
  if (req.type === "izin_late" || req.type === "izin_early") return 0;
  return countWorkingDays(s, e);
}

export interface MonthAttendance {
  present: number;
  late: number;
  izin: number;
  halfDay: number;
  annual: number;
  sick: number;
  unpaid: number;
  missingClockOut: number;
  rejectedAttempts: number;
  spoofFlags: number;
  avgClockIn: string | null;
}

/** Per-person aggregates for one month — the numbers behind the manager grid,
 *  wage dashboard, receipt, and monthly report (single source, PRD §4.11). */
export async function getMonthAttendance(
  admin: SupabaseClient,
  profileId: string,
  start: string,
  end: string
): Promise<MonthAttendance> {
  const [{ data: records }, { data: leaves }, { count: rejected }] = await Promise.all([
    admin
      .from("attendance_records")
      .select("clock_in_at, late, missing_clock_out, spoof_score, flags")
      .eq("profile_id", profileId)
      .gte("work_date", start)
      .lte("work_date", end),
    admin
      .from("leave_requests")
      .select("*")
      .eq("profile_id", profileId)
      .eq("status", "approved")
      .lte("start_date", end)
      .gte("end_date", start),
    admin
      .from("attendance_rejected_attempts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("attempted_at", `${start}T00:00:00+07:00`)
      .lte("attempted_at", `${end}T23:59:59+07:00`),
  ]);

  const recs = records ?? [];
  const lvs = (leaves ?? []) as LeaveRequest[];
  const clockIns = recs
    .filter((r) => r.clock_in_at)
    .map((r) => timeLabelWIB(r.clock_in_at as string));
  let avgClockIn: string | null = null;
  if (clockIns.length) {
    const totalMin = clockIns.reduce((acc, t) => {
      const [h, m] = t.split(":").map(Number);
      return acc + h * 60 + m;
    }, 0);
    const avg = Math.round(totalMin / clockIns.length);
    avgClockIn = `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
  }

  return {
    present: recs.filter((r) => r.clock_in_at).length,
    late: recs.filter((r) => r.late).length,
    izin: lvs.filter((l) => l.type === "izin_late" || l.type === "izin_early").length,
    halfDay: lvs.filter((l) => l.type === "half_day").length,
    annual: lvs.filter((l) => l.type === "annual").reduce((a, l) => a + leaveDaysInRange(l, start, end), 0),
    sick: lvs.filter((l) => l.type === "sick").reduce((a, l) => a + leaveDaysInRange(l, start, end), 0),
    unpaid: lvs.filter((l) => l.type === "unpaid").reduce((a, l) => a + leaveDaysInRange(l, start, end), 0),
    missingClockOut: recs.filter((r) => r.missing_clock_out).length,
    rejectedAttempts: rejected ?? 0,
    spoofFlags: recs.filter((r) => (r.spoof_score ?? 0) >= 50).length,
    avgClockIn,
  };
}

export interface MonthCounts {
  present: number;
  late: number;
  izin: number;
}

/** Bulk per-profile month counts (present/late/izin) — one query set for the whole roster. */
export async function getMonthAttendanceBulk(
  admin: SupabaseClient,
  start: string,
  end: string
): Promise<Map<string, MonthCounts>> {
  const [{ data: records }, { data: leaves }] = await Promise.all([
    admin
      .from("attendance_records")
      .select("profile_id, clock_in_at, late")
      .gte("work_date", start)
      .lte("work_date", end),
    admin
      .from("leave_requests")
      .select("profile_id, type, status, start_date, end_date")
      .eq("status", "approved")
      .in("type", ["izin_late", "izin_early", "half_day"])
      .lte("start_date", end)
      .gte("end_date", start),
  ]);
  const map = new Map<string, MonthCounts>();
  const get = (id: string) => {
    let m = map.get(id);
    if (!m) {
      m = { present: 0, late: 0, izin: 0 };
      map.set(id, m);
    }
    return m;
  };
  for (const r of records ?? []) {
    const m = get(r.profile_id);
    if (r.clock_in_at) m.present++;
    if (r.late) m.late++;
  }
  for (const l of leaves ?? []) get(l.profile_id).izin++;
  return map;
}

export interface DaySummary {
  present: { name: string; time: string; late: boolean }[];
  late: { name: string; time: string }[];
  izin: { name: string; type: string }[];
  cuti: { name: string; type: string }[];
  absent: string[]; // tanpa keterangan
  rejected: { name: string; distance: number | null; time: string }[];
  spoofFlagged: string[];
  notClockedOut: string[];
}

/** One WIB day, all active employees — feeds both the manager grid and the
 *  daily WhatsApp recap so they can never disagree. `not_started` excluded. */
export async function getDaySummary(admin: SupabaseClient, dateStr: string): Promise<DaySummary> {
  const [{ data: profiles }, { data: records }, { data: leaves }, { data: rejects }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, employment_status, permission")
        .eq("employment_status", "active")
        .neq("permission", "owner"),
      admin
        .from("attendance_records")
        .select("profile_id, clock_in_at, clock_out_at, late, spoof_score, missing_clock_out")
        .eq("work_date", dateStr),
      admin
        .from("leave_requests")
        .select("profile_id, type, status, start_date, end_date")
        .eq("status", "approved")
        .lte("start_date", dateStr)
        .gte("end_date", dateStr),
      admin
        .from("attendance_rejected_attempts")
        .select("profile_id, distance_m, attempted_at")
        .gte("attempted_at", `${dateStr}T00:00:00+07:00`)
        .lte("attempted_at", `${dateStr}T23:59:59+07:00`),
    ]);

  const active = (profiles ?? []) as Pick<Profile, "id" | "full_name">[];
  const nameOf = new Map(active.map((p) => [p.id, p.full_name]));
  const recs = records ?? [];
  const lvs = leaves ?? [];

  const clockedIn = new Set(recs.filter((r) => r.clock_in_at).map((r) => r.profile_id));
  const onLeave = new Map<string, string>();
  const onIzin = new Map<string, string>();
  for (const l of lvs) {
    if (!nameOf.has(l.profile_id)) continue;
    if (["annual", "sick", "unpaid", "special"].includes(l.type)) onLeave.set(l.profile_id, l.type);
    else onIzin.set(l.profile_id, l.type);
  }

  const izinLabel: Record<string, string> = {
    izin_late: "telat (izin)",
    izin_early: "pulang awal",
    half_day: "half-day",
  };

  return {
    present: recs
      .filter((r) => r.clock_in_at && nameOf.has(r.profile_id))
      .map((r) => ({
        name: nameOf.get(r.profile_id)!,
        time: timeLabelWIB(r.clock_in_at as string),
        late: r.late,
      })),
    late: recs
      .filter((r) => r.late && r.clock_in_at && nameOf.has(r.profile_id))
      .map((r) => ({ name: nameOf.get(r.profile_id)!, time: timeLabelWIB(r.clock_in_at as string) })),
    izin: [...onIzin.entries()].map(([id, t]) => ({ name: nameOf.get(id)!, type: izinLabel[t] ?? t })),
    cuti: [...onLeave.entries()].map(([id, t]) => ({ name: nameOf.get(id)!, type: t })),
    absent: active
      .filter((p) => !clockedIn.has(p.id) && !onLeave.has(p.id) && !onIzin.has(p.id))
      .map((p) => p.full_name),
    rejected: (rejects ?? [])
      .filter((r) => nameOf.has(r.profile_id))
      .map((r) => ({
        name: nameOf.get(r.profile_id)!,
        distance: r.distance_m,
        time: timeLabelWIB(r.attempted_at),
      })),
    spoofFlagged: recs
      .filter((r) => (r.spoof_score ?? 0) >= 50 && nameOf.has(r.profile_id))
      .map((r) => nameOf.get(r.profile_id)!),
    notClockedOut: recs
      .filter((r) => r.clock_in_at && !r.clock_out_at && nameOf.has(r.profile_id))
      .map((r) => nameOf.get(r.profile_id)!),
  };
}
