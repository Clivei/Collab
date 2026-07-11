import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { weightedTotal } from "@/lib/report";
import { dateLabelID } from "@/lib/tz";
import type { KpiAssignment, KpiEntry } from "@/lib/types";

const STATUS_CHIP: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  revoked: "bg-red-100 text-red-700",
  completed: "bg-neutral-100 text-neutral-600",
};

export default async function AdminKpiPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string }>;
}) {
  await requireManager();
  const { revoked } = await searchParams;
  const includeRevoked = revoked !== "0"; // default = included, badged (§4.5)
  const admin = createAdminClient();

  const [{ data: assignments }, { data: entries }] = await Promise.all([
    admin
      .from("kpi_assignments")
      .select("*, profiles!kpi_assignments_profile_id_fkey(full_name)")
      .order("created_at", { ascending: false }),
    admin.from("kpi_entries").select("*"),
  ]);

  const entriesByAssignment = new Map<string, KpiEntry[]>();
  for (const e of (entries ?? []) as KpiEntry[]) {
    const arr = entriesByAssignment.get(e.assignment_id) ?? [];
    arr.push(e);
    entriesByAssignment.set(e.assignment_id, arr);
  }

  const list = ((assignments ?? []) as (KpiAssignment & { profiles: { full_name: string } })[]).filter(
    (a) => includeRevoked || a.status !== "revoked"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">KPI Assignments</h1>
        <div className="flex items-center gap-3">
          <Link
            href={includeRevoked ? "/admin/kpi?revoked=0" : "/admin/kpi"}
            className="text-xs text-neutral-400 hover:text-emerald-600"
          >
            {includeRevoked ? "sembunyikan revoked" : "tampilkan revoked"}
          </Link>
          <Link href="/admin/kpi/assign" className="btn-primary text-sm">
            + Kirim KPI box
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="data min-w-[640px]">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Periode</th>
              <th>Metrik</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const latest = (entriesByAssignment.get(a.id) ?? [])[0];
              return (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/kpi/${a.id}`} className="font-medium hover:text-emerald-600">
                      {a.profiles.full_name}
                    </Link>
                  </td>
                  <td>
                    {dateLabelID(a.period_start)} → {dateLabelID(a.period_end)}
                  </td>
                  <td>{a.metrics.length}</td>
                  <td>{weightedTotal(a, latest ?? null) ?? "—"}</td>
                  <td>
                    <span className={`chip ${STATUS_CHIP[a.status]}`}>{a.status}</span>
                    {latest?.status === "draft" && (
                      <span className="ml-1 chip bg-amber-100 text-amber-700">draft belum dishare</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={5} className="text-neutral-400">
                  Belum ada assignment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
