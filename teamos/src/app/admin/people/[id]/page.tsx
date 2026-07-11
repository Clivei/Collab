import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthAttendance } from "@/lib/attendance-summary";
import { weightedTotal } from "@/lib/report";
import { dateLabelID, wibMonthBounds } from "@/lib/tz";
import { formatRupiah } from "@/lib/utils";
import { maskAccount, type KpiAssignment, type KpiEntry } from "@/lib/types";
import { setWageAction, updateProfileAdminAction } from "../../actions";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile: me } = await requireManager();
  const isOwner = me.permission === "owner";
  const { id } = await params;
  const admin = createAdminClient();
  const { start, end } = wibMonthBounds();

  const { data: p } = await admin
    .from("profiles")
    .select("*, departments(name), entities(name), roles(name)")
    .eq("id", id)
    .single();
  if (!p) notFound();

  const [{ data: bankHistory }, { data: contracts }, { data: leaves }, { data: assignments }, { data: entries }, { data: onboarding }, { data: wageRows }, attendance] =
    await Promise.all([
      admin.from("bank_accounts").select("*").eq("profile_id", id).order("created_at", { ascending: false }),
      admin.from("contracts").select("*").eq("profile_id", id).order("created_at", { ascending: false }),
      admin.from("leave_requests").select("*").eq("profile_id", id).order("created_at", { ascending: false }).limit(20),
      admin.from("kpi_assignments").select("*").eq("profile_id", id).order("period_start", { ascending: false }),
      admin.from("kpi_entries").select("*"),
      admin.from("onboarding_tasks").select("*").eq("profile_id", id),
      isOwner ? admin.from("wages").select("*").eq("profile_id", id).order("effective_from", { ascending: false }) : Promise.resolve({ data: [] }),
      p.employment_status === "active" ? getMonthAttendance(admin, id, start, end) : Promise.resolve(null),
    ]);

  const entriesByAssignment = new Map<string, KpiEntry[]>();
  for (const e of (entries ?? []) as KpiEntry[]) {
    const arr = entriesByAssignment.get(e.assignment_id) ?? [];
    arr.push(e);
    entriesByAssignment.set(e.assignment_id, arr);
  }

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-neutral-400 hover:text-emerald-600">
        ← Dashboard
      </Link>
      <h1 className="text-xl font-bold">
        {p.full_name}{" "}
        {p.badge && <span className="chip bg-neutral-100 text-neutral-600">{p.badge}</span>}
      </h1>
      <p className="-mt-3 text-sm text-neutral-500">
        {p.departments?.name ?? "—"} · {p.entities?.name ?? "Both"} · {p.roles?.name ?? "role TBD"} ·{" "}
        {p.email}
      </p>

      {/* Edit basics */}
      <form action={updateProfileAdminAction} className="card grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="profile_id" value={p.id} />
        <div>
          <label className="label">Status</label>
          <select name="employment_status" className="input" defaultValue={p.employment_status}>
            {["not_started", "active", "probation", "resigned", "terminated"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tipe kerja</label>
          <select name="work_type" className="input" defaultValue={p.work_type}>
            {["fulltime", "intern_paid", "intern_unpaid", "freelance"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Badge</label>
          <input name="badge" className="input" defaultValue={p.badge ?? ""} />
        </div>
        <div>
          <label className="label">Magang mulai</label>
          <input name="intern_start" type="date" className="input" defaultValue={p.intern_start ?? ""} />
        </div>
        <div>
          <label className="label">Magang selesai (alert 14 hari sebelum)</label>
          <input name="intern_end" type="date" className="input" defaultValue={p.intern_end ?? ""} />
        </div>
        <div>
          <label className="label">Phone (WA)</label>
          <input name="phone" className="input" defaultValue={p.phone ?? ""} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Notes</label>
          <textarea name="notes" className="input" rows={2} defaultValue={p.notes ?? ""} />
        </div>
        <button className="btn-primary sm:col-span-3">Simpan</button>
      </form>

      {/* Wage (owner) */}
      {isOwner && (
        <div className="card space-y-2">
          <h2 className="font-semibold">Gaji (owner only)</h2>
          <ul className="text-sm text-neutral-600">
            {(wageRows ?? []).map((w) => (
              <li key={w.id}>
                {formatRupiah(Number(w.monthly_wage))} sejak {dateLabelID(w.effective_from)}
              </li>
            ))}
            {!wageRows?.length && <li className="text-neutral-400">Belum ada data gaji.</li>}
          </ul>
          <form action={setWageAction} className="flex gap-2">
            <input type="hidden" name="profile_id" value={p.id} />
            <input name="monthly_wage" className="input !w-40" placeholder="cth: 3500000" inputMode="numeric" />
            <input name="effective_from" type="date" className="input !w-40" />
            <button className="btn-secondary">Set gaji</button>
          </form>
        </div>
      )}

      {/* Attendance this month */}
      {attendance && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Absensi bulan ini</h2>
          <p className="text-sm text-neutral-600">
            Hadir {attendance.present} · Telat {attendance.late} · Izin {attendance.izin} · Cuti{" "}
            {attendance.annual} · Sakit {attendance.sick} · Unpaid {attendance.unpaid} · Ditolak{" "}
            {attendance.rejectedAttempts} · Avg masuk {attendance.avgClockIn ?? "—"}
          </p>
        </div>
      )}

      {/* Bank history */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Riwayat rekening</h2>
        <ul className="space-y-1 text-sm">
          {(bankHistory ?? []).map((b) => (
            <li key={b.id} className={b.is_active ? "" : "text-neutral-400 line-through"}>
              {b.bank_name} {isOwner ? b.account_number : maskAccount(b.account_number)} a.n.{" "}
              {b.account_holder_name}{" "}
              {b.is_active &&
                (b.verified_at ? (
                  <span className="chip bg-emerald-100 text-emerald-700">verified</span>
                ) : b.confirmed_by_employee ? (
                  <span className="chip bg-sky-100 text-sky-700">confirmed</span>
                ) : (
                  <span className="chip bg-amber-100 text-amber-700">unconfirmed</span>
                ))}
            </li>
          ))}
          {!bankHistory?.length && <li className="text-neutral-400">Belum ada.</li>}
        </ul>
      </div>

      {/* KPI history incl. revoked (never purged) */}
      <div className="card">
        <h2 className="mb-2 font-semibold">KPI (semua, termasuk revoked)</h2>
        <ul className="space-y-1 text-sm">
          {((assignments ?? []) as KpiAssignment[]).map((a) => {
            const latest = (entriesByAssignment.get(a.id) ?? [])[0];
            const total = weightedTotal(a, latest ?? null);
            return (
              <li key={a.id} className="flex justify-between">
                <Link href={`/admin/kpi/${a.id}`} className="hover:text-emerald-600">
                  {dateLabelID(a.period_start)} → {dateLabelID(a.period_end)}
                </Link>
                <span>
                  {total ?? "—"}{" "}
                  {a.status === "revoked" && <span className="chip bg-red-100 text-red-700">revoked</span>}
                  {a.status === "completed" && (
                    <span className="chip bg-neutral-100 text-neutral-600">completed</span>
                  )}
                </span>
              </li>
            );
          })}
          {!assignments?.length && <li className="text-neutral-400">Belum ada KPI dikirim.</li>}
        </ul>
        <Link href={`/admin/kpi/assign?profile=${p.id}`} className="btn-primary mt-3 inline-flex text-xs">
          + Kirim KPI box
        </Link>
      </div>

      {/* Leave history */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Riwayat cuti/izin</h2>
        <ul className="space-y-1 text-sm">
          {(leaves ?? []).map((l) => (
            <li key={l.id}>
              {l.type} · {dateLabelID(l.start_date)}
              {l.end_date !== l.start_date && ` → ${dateLabelID(l.end_date)}`} ·{" "}
              <span className="text-neutral-400">{l.status}</span>
            </li>
          ))}
          {!leaves?.length && <li className="text-neutral-400">Belum ada.</li>}
        </ul>
      </div>

      {/* Onboarding */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Onboarding</h2>
        <ul className="space-y-1 text-sm">
          {(onboarding ?? []).map((t) => (
            <li key={t.id}>
              {t.status === "done" ? "✅" : "⬜"} {t.title}
            </li>
          ))}
          {!onboarding?.length && <li className="text-neutral-400">Tidak ada task.</li>}
        </ul>
      </div>

      {/* Contracts */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Kontrak</h2>
        <ul className="space-y-1 text-sm">
          {(contracts ?? []).map((c) => (
            <li key={c.id}>
              {c.kind} · {c.status} · {c.start_date ? dateLabelID(c.start_date) : "—"}
              {c.end_date && ` → ${dateLabelID(c.end_date)}`}
            </li>
          ))}
          {!contracts?.length && <li className="text-neutral-400">Belum ada kontrak.</li>}
        </ul>
      </div>
    </div>
  );
}
