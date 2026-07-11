import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthAttendanceBulk } from "@/lib/attendance-summary";
import { getLatestPublishedCycle, getPeerAverages } from "@/lib/peer";
import { weightedTotal } from "@/lib/report";
import { entityColor, entityLabel, formatRupiah } from "@/lib/utils";
import { maskAccount, BANK_OPTIONS, type KpiAssignment, type KpiEntry, type Profile } from "@/lib/types";
import { wibDateStr, wibMonthBounds } from "@/lib/tz";
import {
  adminSaveBankAction,
  verifyBankAction,
  activateEmployeeAction,
  internToFulltimeAction,
} from "./actions";

type RosterProfile = Profile & {
  departments: { name: string } | null;
  entities: { name: string } | null;
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { profile: me } = await requireManager();
  const isOwner = me.permission === "owner";
  const filters = await searchParams;
  const admin = createAdminClient();
  const today = wibDateStr();
  const { start, end } = wibMonthBounds();

  const [
    { data: profiles },
    { data: banks },
    { data: wages },
    { data: assignments },
    { data: entries },
    { data: departments },
    monthCounts,
    latestCycle,
    { count: flaggedToday },
    { count: unsharedDrafts },
    { count: unmoderated },
  ] = await Promise.all([
    admin.from("profiles").select("*, departments(name), entities(name)").neq("permission", "owner").order("full_name"),
    admin.from("bank_accounts").select("*").eq("is_active", true),
    admin.from("wages").select("*").order("effective_from", { ascending: false }),
    admin.from("kpi_assignments").select("*").order("period_start", { ascending: false }),
    admin.from("kpi_entries").select("*"),
    admin.from("departments").select("*").order("name"),
    getMonthAttendanceBulk(admin, start, end),
    getLatestPublishedCycle(admin),
    admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("work_date", today)
      .or("late.eq.true,missing_clock_out.eq.true,spoof_score.gte.50"),
    admin.from("kpi_entries").select("id", { count: "exact", head: true }).eq("status", "draft"),
    admin
      .from("peer_reviews")
      .select("id", { count: "exact", head: true })
      .eq("comment_moderation", "pending")
      .not("comment", "is", null),
  ]);

  const peerAvg = latestCycle ? await getPeerAverages(admin, latestCycle.id) : new Map<string, number>();

  const bankOf = new Map((banks ?? []).map((b) => [b.profile_id, b]));
  const wageOf = new Map<string, number>();
  for (const w of wages ?? []) if (!wageOf.has(w.profile_id)) wageOf.set(w.profile_id, Number(w.monthly_wage));

  const entriesByAssignment = new Map<string, KpiEntry[]>();
  for (const e of (entries ?? []) as KpiEntry[]) {
    const arr = entriesByAssignment.get(e.assignment_id) ?? [];
    arr.push(e);
    entriesByAssignment.set(e.assignment_id, arr);
  }
  // per person: newest→older weighted totals for trend arrows
  const kpiTotals = new Map<string, number[]>();
  for (const a of (assignments ?? []) as KpiAssignment[]) {
    const latest = (entriesByAssignment.get(a.id) ?? [])[0];
    const total = weightedTotal(a, latest ?? null);
    if (total == null) continue;
    const arr = kpiTotals.get(a.profile_id) ?? [];
    arr.push(total);
    kpiTotals.set(a.profile_id, arr);
  }

  let list = (profiles ?? []) as RosterProfile[];

  // Header stats
  const counts = {
    nora: list.filter((p) => p.entities?.name === "NoraPadel").length,
    grid: list.filter((p) => p.entities?.name === "Gridline Digital").length,
    both: list.filter((p) => !p.entity_id).length,
    active: list.filter((p) => p.employment_status === "active").length,
    notStarted: list.filter((p) => p.employment_status === "not_started").length,
    internsEnding: list.filter(
      (p) =>
        p.intern_end &&
        p.intern_end >= today &&
        (new Date(p.intern_end).getTime() - new Date(today).getTime()) / 86400000 <= 30
    ).length,
    missingBank: list.filter((p) => !bankOf.has(p.id)).length,
  };

  // Filters
  if (filters.entity === "nora") list = list.filter((p) => p.entities?.name === "NoraPadel");
  if (filters.entity === "grid") list = list.filter((p) => p.entities?.name === "Gridline Digital");
  if (filters.entity === "both") list = list.filter((p) => !p.entity_id);
  if (filters.dept) list = list.filter((p) => p.department_id === filters.dept);
  if (filters.work_type) list = list.filter((p) => p.work_type === filters.work_type);
  if (filters.status) list = list.filter((p) => p.employment_status === filters.status);
  if (filters.missing === "1")
    list = list.filter(
      (p) => !bankOf.has(p.id) || !bankOf.get(p.id)?.confirmed_by_employee || !p.phone || !wageOf.has(p.id)
    );

  const byDept = new Map<string, RosterProfile[]>();
  for (const p of list) {
    const dept = p.departments?.name ?? "—";
    const arr = byDept.get(dept) ?? [];
    arr.push(p);
    byDept.set(dept, arr);
  }

  const stat = (label: string, value: number | string, href?: string) => (
    <Link href={href ?? "/admin"} className="card !p-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Command Dashboard</h1>
        <a href="/api/admin/roster" className="btn-secondary text-xs">
          ⬇ CSV roster
        </a>
      </div>

      {/* Header stats (§4.10) */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {stat("Nora", counts.nora, "/admin?entity=nora")}
        {stat("Gridline", counts.grid, "/admin?entity=grid")}
        {stat("Both", counts.both, "/admin?entity=both")}
        {stat("Aktif / belum mulai", `${counts.active}/${counts.notStarted}`, "/admin?status=not_started")}
        {stat("Intern ≤30 hr", counts.internsEnding)}
        {stat("Tanpa bank", counts.missingBank, "/admin?missing=1")}
        {stat("Flag absen hari ini", flaggedToday ?? 0, "/admin/attendance")}
        {stat("Draft KPI / komentar", `${unsharedDrafts ?? 0}/${unmoderated ?? 0}`, "/admin/kpi")}
      </div>

      {/* Filters */}
      <form className="card flex flex-wrap items-end gap-2 !py-3" method="get">
        <select name="dept" className="input !w-auto" defaultValue={filters.dept ?? ""}>
          <option value="">Semua departemen</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select name="work_type" className="input !w-auto" defaultValue={filters.work_type ?? ""}>
          <option value="">Semua tipe</option>
          <option value="fulltime">fulltime</option>
          <option value="intern_paid">intern paid</option>
          <option value="intern_unpaid">intern unpaid</option>
          <option value="freelance">freelance</option>
        </select>
        <select name="status" className="input !w-auto" defaultValue={filters.status ?? ""}>
          <option value="">Semua status</option>
          <option value="not_started">not started</option>
          <option value="active">active</option>
          <option value="probation">probation</option>
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="missing" value="1" defaultChecked={filters.missing === "1"} />
          missing anything
        </label>
        <button className="btn-secondary text-xs">Filter</button>
        <Link href="/admin" className="text-xs text-neutral-400">
          reset
        </Link>
      </form>

      {/* Roster grouped by department */}
      {[...byDept.entries()].map(([dept, people]) => (
        <div key={dept} className="card overflow-x-auto !p-0">
          <h2 className="border-b border-neutral-100 px-4 py-2 text-sm font-semibold">{dept}</h2>
          <table className="data min-w-[900px]">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Entity</th>
                <th>Tipe</th>
                <th>Status</th>
                <th>Absen bln ini</th>
                <th>Cuti</th>
                <th>KPI</th>
                <th>Peer</th>
                <th>Bank</th>
                {isOwner && <th>Gaji</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const bank = bankOf.get(p.id);
                const att = monthCounts.get(p.id);
                const totals = kpiTotals.get(p.id) ?? [];
                const trend =
                  totals.length >= 2 ? (totals[0] > totals[1] ? "↑" : totals[0] < totals[1] ? "↓" : "→") : "";
                const wage = wageOf.get(p.id);
                const internDays =
                  p.intern_end && p.intern_end >= today
                    ? Math.round((new Date(p.intern_end).getTime() - new Date(today).getTime()) / 86400000)
                    : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/people/${p.id}`} className="font-medium hover:text-emerald-600">
                        {p.full_name}
                      </Link>{" "}
                      {p.badge && <span className="chip bg-neutral-100 text-neutral-600">{p.badge}</span>}
                    </td>
                    <td>
                      <span
                        className="chip text-white"
                        style={{ backgroundColor: entityColor(p.entities?.name ?? null) }}
                      >
                        {entityLabel(p.entities?.name ?? null)}
                      </span>
                    </td>
                    <td>
                      {p.work_type}
                      {internDays != null && (
                        <span className="ml-1 chip bg-amber-100 text-amber-700">{internDays} hr lagi</span>
                      )}
                    </td>
                    <td>
                      {p.employment_status === "not_started" ? (
                        <form action={activateEmployeeAction} className="inline">
                          <input type="hidden" name="profile_id" value={p.id} />
                          <span className="chip bg-neutral-100 text-neutral-500">not started</span>{" "}
                          <button className="text-xs text-emerald-600 underline">mulai</button>
                        </form>
                      ) : (
                        <span className="chip bg-emerald-100 text-emerald-700">{p.employment_status}</span>
                      )}
                    </td>
                    <td>
                      {att ? (
                        <span>
                          {att.present}h{att.late > 0 && <span className="text-amber-600"> · {att.late}t</span>}
                          {att.izin > 0 && <span className="text-sky-600"> · {att.izin}i</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{Number(p.leave_balance_annual) + Number(p.leave_balance_carryover)}</td>
                    <td>
                      {totals.length ? (
                        <span>
                          {totals[0]} <span className="text-neutral-400">{trend}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{peerAvg.get(p.id) ?? "—"}</td>
                    <td>
                      {bank ? (
                        bank.verified_at ? (
                          <span title={`${bank.bank_name} ${maskAccount(bank.account_number)}`}>✅</span>
                        ) : bank.confirmed_by_employee ? (
                          <form action={verifyBankAction} className="inline">
                            <input type="hidden" name="bank_id" value={bank.id} />
                            <button className="text-xs" title="Tandai terverifikasi">
                              ☑️ verifikasi
                            </button>
                          </form>
                        ) : (
                          <span title="Diinput admin — menunggu konfirmasi karyawan">🟡</span>
                        )
                      ) : (
                        <details>
                          <summary className="cursor-pointer">❌ isi</summary>
                          {/* §4.10 inline bank entry drawer */}
                          <form action={adminSaveBankAction} className="mt-2 w-56 space-y-1">
                            <input type="hidden" name="profile_id" value={p.id} />
                            <select name="bank_name" className="input !py-1 text-xs">
                              {BANK_OPTIONS.map((b) => (
                                <option key={b}>{b}</option>
                              ))}
                            </select>
                            <input name="account_number" placeholder="No. rekening" className="input !py-1 text-xs" required />
                            <input
                              name="account_holder_name"
                              placeholder="Nama pemilik"
                              defaultValue={p.full_name}
                              className="input !py-1 text-xs"
                              required
                            />
                            <button className="btn-primary !py-1 text-xs">Simpan (atas nama karyawan)</button>
                          </form>
                        </details>
                      )}
                    </td>
                    {isOwner && <td>{wage != null ? formatRupiah(wage) : <span className="text-red-500">—</span>}</td>}
                    <td className="whitespace-nowrap text-xs">
                      <Link href={`/admin/kpi/assign?profile=${p.id}`} className="text-emerald-600 hover:underline">
                        +KPI
                      </Link>{" "}
                      {p.work_type.startsWith("intern") && (
                        <form action={internToFulltimeAction} className="inline">
                          <input type="hidden" name="profile_id" value={p.id} />
                          <button className="text-sky-600 hover:underline">→FT</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
